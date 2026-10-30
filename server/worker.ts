/// <reference types="@cloudflare/workers-types" />
import {
  RoomHub,
  GameError,
  type Store,
  type StoredAdventure,
  type StoredRoom,
} from "./core";
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from "../shared/protocol";
import { validateSave } from "../shared/save";
import { privateAccessGate, readAccessSession, accessHeaders, internalRateRequest, parseInternalRate, advanceAccessRate, accessJson, type AccessEnv, type RateRecord, type RateDecision } from './access';
interface Env extends AccessEnv {
  ADVENTURES: DurableObjectNamespace;
  ASSETS: Fetcher;
}
interface Attachment {
  code: string;
  clientToken?: string;
  clientSeq: number;
  serverSeq: number;
  lastSeen: number;
  accessExpiresAt?:number;
}
class DurableStore implements Store {
  constructor(private storage: DurableObjectStorage) {}
  async load(id: string) {
    const result = await this.storage.get<StoredAdventure>(`save:${id}`);
    if (!result) return null;
    try {
      validateSave(result.save);
      return result;
    } catch {
      const backup = await this.storage.get<StoredAdventure>(`backup:${id}`);
      if (!backup) throw new Error("存档损坏");
      validateSave(backup.save);
      return backup;
    }
  }
  async save(id: string, record: StoredAdventure) {
    validateSave(record.save);
    await this.storage.transaction(async (tx) => {
      const prior = await tx.get<StoredAdventure>(`save:${id}`);
      if (prior) {
        try {
          validateSave(prior.save);
          await tx.put(`backup:${id}`, prior);
        } catch {}
      }
      await tx.put(`save:${id}`, record);
    });
  }
  async loadRooms() {
    return (await this.storage.get<StoredRoom[]>("rooms")) || [];
  }
  async saveRooms(rooms: StoredRoom[]) {
    await this.storage.put("rooms", rooms);
  }
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
/** One two-player service instance; hibernation avoids idle duration billing. SQLite storage via migration. */
export class AdventureService {
  private hub: RoomHub;
  private sessions = new Map<WebSocket, ReturnType<RoomHub["connect"]>>();
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {
    this.hub = new RoomHub(new DurableStore(ctx.storage));
    ctx.blockConcurrencyWhile(async () => {
      await this.hub.init();
      for (const ws of ctx.getWebSockets()) {
        const attachment = ws.deserializeAttachment() as Attachment;
        if (!attachment?.clientToken || !attachment.accessExpiresAt || attachment.accessExpiresAt<=Date.now()) {
          ws.close(4002, "请重新连接");
          continue;
        }
        try {
          const session = await this.hub.restoreConnection(
            attachment.code,
            this.peer(ws),
            attachment.clientToken,
            attachment.clientSeq,
          );
          this.sessions.set(ws, session);
        } catch {
          ws.close(4003, "房间已结束，请继续冒险");
        }
      }
    });
  }
  private peer(ws: WebSocket) {
    return {
      send: (message: string) => {
        const attachment = ws.deserializeAttachment() as Attachment;
        const data = JSON.parse(message);
        data.seq = ++attachment.serverSeq;
        ws.serializeAttachment(attachment);
        ws.send(JSON.stringify(data));
      },
      close: (code?: number, reason?: string) => ws.close(code || 1000, reason),
    };
  }
  async fetch(request: Request) {
    try {
      const url = new URL(request.url);
      if(url.pathname==='/__internal/access-rate'){
        const client=await parseInternalRate(request,this.env);
        if(!client)return accessJson({code:'FORBIDDEN'},403);
        const decision=await this.ctx.storage.transaction(async tx=>{
          const prior=await tx.get<RateRecord>('site-access-rate-v1');
          const next=advanceAccessRate(prior,client);
          if(next.changed)await tx.put('site-access-rate-v1',next.record);
          return next.decision;
        });
        return accessJson(decision);
      }
      const siteSession=await readAccessSession(request,this.env);
      if(!siteSession)return accessJson({code:'PRIVATE_ACCESS_REQUIRED'},401);
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin)
        throw new GameError("ORIGIN", "连接来源不被允许");
      if (
        url.pathname === "/ws" &&
        request.headers.get("Upgrade") === "websocket"
      ) {
        const code = url.searchParams.get("room") || "";
        if (!/^[A-F0-9]{6}$/.test(code))
          throw new GameError("ROOM", "房间码格式无效");
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({
          code,
          clientSeq: -1,
          serverSeq: 0,
          lastSeen: Date.now(),
          accessExpiresAt:siteSession.expires*1000,
        } satisfies Attachment);
        if (!(await this.ctx.storage.getAlarm()))
          await this.ctx.storage.setAlarm(Date.now() + 15000);
        this.sessions.set(server, this.hub.connect(code, this.peer(server)));
        return new Response(null, { status: 101, webSocket: client });
      }
      if (url.pathname === "/api/health")
        return json({
          ok: true,
          protocol: PROTOCOL_VERSION,
          persistence: "durable-object-sqlite",
        });
      if (request.method !== "POST")
        return json({ code: "NOT_FOUND", message: "请求不存在" }, 404);
      const text = await request.text();
      if (new TextEncoder().encode(text).length > MAX_MESSAGE_BYTES)
        throw new GameError("SIZE", "请求过大");
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new GameError("FORMAT", "请求数据损坏");
      }
      const result = await this.hub.exclusive(async () => {
        if (url.pathname === "/api/rooms")
          return this.hub.create(data.clientToken, data.resume, data.mode);
        if (url.pathname === "/api/join")
          return this.hub.join(String(data.code || ""), data.clientToken);
        if (url.pathname === "/api/adventures/load")
          return { save: (await this.hub.authorize(data.credentials)).save };
        if (url.pathname === "/api/adventures/restore")
          return { save: await this.hub.restore(data.credentials, data.save) };
        throw new GameError("NOT_FOUND", "请求不存在");
      });
      return json(result);
    } catch (e) {
      return json(
        {
          code: e instanceof GameError ? e.code : "UNAVAILABLE",
          message: e instanceof GameError ? e.message : "存档服务暂时不可用",
        },
        e instanceof GameError ? 400 : 503,
      );
    }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (
      typeof message !== "string" ||
      new TextEncoder().encode(message).length > MAX_MESSAGE_BYTES
    ) {
      ws.close(1009, "消息过大或格式无效");
      return;
    }
    const session = this.sessions.get(ws);
    if (!session) {
      ws.close(4002, "请重新连接");
      return;
    }
    try {
      const data = JSON.parse(message);
      const attachment = ws.deserializeAttachment() as Attachment;
      attachment.lastSeen = Date.now();
      ws.serializeAttachment(attachment);
      if (
        data.v === PROTOCOL_VERSION &&
        Number.isSafeInteger(data.seq) &&
        data.seq > attachment.clientSeq
      ) {
        attachment.clientSeq = data.seq;
        if (
          data.kind === "hello" &&
          !attachment.clientToken &&
          /^[a-f0-9]{64}$/.test(data.payload?.clientToken || "")
        )
          attachment.clientToken = data.payload.clientToken;
        ws.serializeAttachment(attachment);
      }
    } catch {}
    await this.hub.receive(session, message);
  }
  async alarm() {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment;
      if (Date.now() - attachment.lastSeen > 25000 || !attachment.accessExpiresAt || attachment.accessExpiresAt<=Date.now()) {
        ws.close(4004, "连接超时，请重连");
        await this.webSocketClose(ws);
      }
    }
    if (this.sessions.size) await this.ctx.storage.setAlarm(Date.now() + 15000);
  }
  async webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (session) await this.hub.disconnect(session);
  }
  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const service=()=>env.ADVENTURES.get(env.ADVENTURES.idFromName("starlight-private-pair-v1"));
    const gated=await privateAccessGate(request,env,{attempt:async client=>{
      const response=await service().fetch(await internalRateRequest(env,client));
      if(!response.ok)throw new Error('Access check unavailable');
      const result=await response.json() as RateDecision;
      if(typeof result.allowed!=='boolean'||!Number.isFinite(result.retryAfter))throw new Error('Access check invalid');
      return result;
    }});
    if(gated)return gated;
    const response=url.pathname==='/ws'||url.pathname.startsWith('/api/')?await service().fetch(request):await env.ASSETS.fetch(request);
    if(response.status===101)return response;
    const headers=new Headers(response.headers);
    for(const [key,value]of Object.entries(accessHeaders))headers.set(key,value);
    // Native same-origin logout is a POST navigation; no-referrer makes Chrome
    // send Origin:null. Only HTML needs this policy; resource/API privacy is unchanged.
    if(headers.get('Content-Type')?.includes('text/html'))headers.set('Referrer-Policy','same-origin');
    headers.set('Vary','Cookie');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
} satisfies ExportedHandler<Env>;
