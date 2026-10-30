import {validSwimTransition} from '../shared/swim-transition.js';
import {validRegionStepBack} from '../shared/region-load.js';
import {validPetCommand} from '../shared/pet.js';
import {validAnimalCommand} from '../shared/animal-care.js';
import {validInputStamp} from '../shared/input-ack.js';
import {validRegionLoadCommand} from '../shared/region-load.js';
import {validFieldCommand} from '../shared/fieldbook.js';
import { validateSnapshotShape, resetSnapshotMovement, type SnapshotShape } from "../shared/snapshot.js";
import {validStoryCommand} from '../shared/story.js';
import {validDuoCommand} from '../shared/duo.js';
import {withinLiveBounds} from '../shared/world-bounds.js';
import {roomMode, type RoomMode} from '../shared/modes.js';
import {
  freshSave,
  isId,
  isJsonObject,
  migrateSave,
  validateSave,
  type AdventureCredentials,
  type AdventureSave,
  type JsonObject,
  type SaveReceipt,
} from "../shared/save.js";
import {
  MAX_MESSAGE_BYTES,
  MAX_SNAPSHOT_BYTES,
  PROTOCOL_VERSION,
  type CreateRoomResponse,
  type PlayerView,
  type RoomView,
  type ServerMessage,
} from "../shared/protocol.js";
export interface StoredAdventure {
  tokenHash: string;
  save: AdventureSave;
  receipts: Record<string, SaveReceipt>;
}
export interface Peer {
  send(message: string): void;
  close(code?: number, reason?: string): void;
}
interface Member extends PlayerView {
  tokenHash: string;
}
export interface StoredRoom {
  mode?: RoomMode;
  code: string;
  credentials: AdventureCredentials;
  hostId: string;
  members: Member[];
  started: boolean;
  hostActive: boolean;
}
interface Room extends StoredRoom {
  snapshot: JsonObject | null;
}
interface Session {
  peer: Peer;
  code: string;
  clientId: string | null;
  seq: number;
  outSeq: number;
  messages: number;
  windowStart: number;
}
export interface Store {
  load(id: string): Promise<StoredAdventure | null>;
  save(id: string, record: StoredAdventure): Promise<void>;
  loadRooms(): Promise<StoredRoom[]>;
  saveRooms(rooms: StoredRoom[]): Promise<void>;
}
export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
async function digest(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function requireToken(token: unknown): asserts token is string {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new GameError("AUTH", "身份凭证无效");
}
function requireRole(role: unknown): asserts role is "gold" | "white" {
  if (role !== "gold" && role !== "white")
    throw new GameError("ROLE", "请选择一只小狗");
}
export class RoomHub {
  private rooms = new Map<string, Room>();
  private sessions = new Set<Session>();
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private store: Store) {}
  /** All mutations are serialized, including durable writes and revision checks. */
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => {});
    return next;
  }
  async init() {
    for (const r of await this.store.loadRooms())
      this.rooms.set(r.code, {
        ...r,
        hostActive: r.hostActive ?? true,
        members: r.members.map((p) => ({ ...p, connected: false })),
        snapshot: null,
      });
  }
  private persistRooms() {
    return this.store.saveRooms(
      [...this.rooms.values()].map(({ snapshot: _, ...room }) => room),
    );
  }
  view(r: Room): RoomView {
    return {
      mode: roomMode(r),
      code: r.code,
      adventureId: r.credentials.adventureId,
      hostId: r.hostId,
      started: r.started,
      paused:
        r.started && (!r.hostActive || r.members.some((p) => !p.connected)),
      players: r.members.map(({ tokenHash: _, ...p }) => p),
    };
  }
  private send(s: Session, kind: ServerMessage["kind"], payload: unknown) {
    s.peer.send(
      JSON.stringify({ v: PROTOCOL_VERSION, seq: ++s.outSeq, kind, payload }),
    );
  }
  private broadcast(
    r: Room,
    kind: ServerMessage["kind"],
    payload: unknown,
    except?: Session,
  ) {
    for (const s of this.sessions)
      if (s !== except && s.code === r.code && s.clientId)
        this.send(s, kind, payload);
  }
  private member(r: Room, id: string | null) {
    const p = r.members.find((p) => p.clientId === id);
    if (!p) throw new GameError("AUTH", "请重新连接房间");
    return p;
  }
  async create(
    clientToken: string,
    resume?: AdventureCredentials,
    mode: RoomMode = 'adventure',
  ): Promise<CreateRoomResponse> {
    requireToken(clientToken);
    if (mode !== 'adventure' && mode !== 'coop-exploration') throw new GameError('MODE', '未知房间模式');
    let credentials: AdventureCredentials;
    let record: StoredAdventure;
    if (resume) {
      credentials = resume;
      record = await this.authorize(resume);
      if (roomMode(record.save) !== mode) throw new GameError('MODE', '不能跨模式恢复存档');
    } else {
      credentials = {
        adventureId: `a_${randomHex(12)}`,
        recoveryToken: randomHex(32),
      };
      record = {
        tokenHash: await digest(credentials.recoveryToken),
        save: {...freshSave(credentials.adventureId), ...(mode === 'coop-exploration' ? {mode} : {})},
        receipts: {},
      };
      await this.store.save(credentials.adventureId, record);
    }
    // One authoritative room per adventure; resuming rejoins its existing room.
    const old = [...this.rooms.values()].find(
      (r) => r.credentials.adventureId === credentials.adventureId,
    );
    if (old) {
      const hash = await digest(clientToken);
      if (!old.members.some((p) => p.tokenHash === hash)) {
        if (old.members.some((p) => p.connected))
          throw new GameError("ACTIVE_ROOM", "这段冒险仍在进行，请加入原房间");
        this.rooms.delete(old.code);
      } else return { room: this.view(old), credentials, save: record.save };
    }
    let code = "";
    do {
      code = randomHex(3).toUpperCase();
    } while (this.rooms.has(code));
    const hostId = `p_${randomHex(8)}`;
    const r: Room = {
      mode,
      code,
      credentials,
      hostId,
      members: [
        {
          clientId: hostId,
          tokenHash: await digest(clientToken),
          role: "gold",
          ready: false,
          connected: false,
        },
      ],
      started: false,
      hostActive: true,
      snapshot: null,
    };
    this.rooms.set(code, r);
    await this.persistRooms();
    return { room: this.view(r), credentials, save: record.save };
  }
  async join(code: string, clientToken: string): Promise<{ room: RoomView }> {
    requireToken(clientToken);
    const r = this.rooms.get(code.toUpperCase());
    if (!r) throw new GameError("ROOM_MISSING", "房间不存在或已关闭");
    const hash = await digest(clientToken);
    if (!r.members.some((p) => p.tokenHash === hash)) {
      if (r.members.length >= 2)
        throw new GameError("ROOM_FULL", "房间已有两位伙伴");
      r.members.push({
        clientId: `p_${randomHex(8)}`,
        tokenHash: hash,
        role: r.members[0].role === "gold" ? "white" : "gold",
        ready: false,
        connected: false,
      });
      await this.persistRooms();
    }
    this.broadcast(r, "room", this.view(r));
    return { room: this.view(r) };
  }
  async authorize(c: AdventureCredentials): Promise<StoredAdventure> {
    if (!c || !isId(c.adventureId)) throw new GameError("AUTH", "恢复凭证无效");
    requireToken(c.recoveryToken);
    const record = await this.store.load(c.adventureId);
    if (!record || record.tokenHash !== (await digest(c.recoveryToken)))
      throw new GameError("AUTH", "未找到冒险，或恢复凭证不正确");
    return record;
  }
  async restore(
    c: AdventureCredentials,
    rawSave: unknown,
  ): Promise<AdventureSave> {
    // A local backup never silently overwrites cloud progress. Explicit authenticated import is required.
    if (!c || !isId(c.adventureId)) throw new GameError("AUTH", "恢复凭证无效");
    requireToken(c.recoveryToken);
    const existing = await this.store.load(c.adventureId);
    const current = existing ? await this.authorize(c) : null;
    if (
      [...this.rooms.values()].some(
        (r) =>
          r.credentials.adventureId === c.adventureId &&
          r.members.some((m) => m.connected),
      )
    )
      throw new GameError("ACTIVE_ROOM", "请先离开正在进行的房间，再恢复备份");
    const save = migrateSave(rawSave);
    if (current && roomMode(current.save) !== roomMode(save)) throw new GameError('MODE', '备份不能改变存档模式');
    if (save.adventureId !== c.adventureId)
      throw new GameError("AUTH", "备份不属于这段冒险");
    save.revision = (current?.save.revision ?? save.revision) + 1;
    save.updatedAt = new Date().toISOString();
    await this.store.save(c.adventureId, {
      tokenHash: current?.tokenHash ?? (await digest(c.recoveryToken)),
      save,
      receipts: {},
    });
    for (const [code, room] of this.rooms)
      if (room.credentials.adventureId === c.adventureId)
        this.rooms.delete(code);
    await this.persistRooms();
    return save;
  }
  connect(code: string, peer: Peer): Session {
    const s: Session = {
      code: code.toUpperCase(),
      peer,
      clientId: null,
      seq: -1,
      outSeq: 0,
      messages: 0,
      windowStart: Date.now(),
    };
    this.sessions.add(s);
    return s;
  }
  /** Restores hibernated WebSockets without replaying welcome or resetting the host simulation. */
  async restoreConnection(
    code: string,
    peer: Peer,
    clientToken: string,
    seq: number,
  ) {
    requireToken(clientToken);
    const room = this.rooms.get(code);
    if (!room) throw new GameError("ROOM_MISSING", "房间已关闭");
    const hash = await digest(clientToken);
    const member = room.members.find((m) => m.tokenHash === hash);
    if (!member) throw new GameError("AUTH", "连接身份已失效");
    const session = this.connect(code, peer);
    session.clientId = member.clientId;
    session.seq = seq;
    member.connected = true;
    return session;
  }
  receive(s: Session, text: string): Promise<void> {
    return this.exclusive(async () => {
      let requestId: string | undefined;
      try {
        if (!this.sessions.has(s)) return;
        if (new TextEncoder().encode(text).length > MAX_MESSAGE_BYTES)
          throw new GameError("SIZE", "同步消息过大");
        let untrusted: unknown;
        try {
          untrusted = JSON.parse(text);
        } catch {
          throw new GameError("FORMAT", "同步消息损坏");
        }
        if (!isJsonObject(untrusted))
          throw new GameError("FORMAT", "同步消息格式错误");
        const msg = untrusted as unknown as {
          v: unknown;
          seq: number;
          kind: string;
          payload?: any;
        };
        if (msg.v !== PROTOCOL_VERSION)
          throw new GameError("VERSION", "游戏版本不一致，请双方刷新后重试");
        if (
          typeof msg.seq !== "number" ||
          !Number.isSafeInteger(msg.seq) ||
          msg.seq < 0
        )
          throw new GameError("SEQUENCE", "消息顺序无效");
        if (msg.seq <= s.seq) return; // duplicate/replay on the same authenticated connection
        s.seq = msg.seq;
        if (Date.now() - s.windowStart > 1000) {
          s.windowStart = Date.now();
          s.messages = 0;
        }
        if (++s.messages > 100) throw new GameError("RATE", "同步过于频繁");
        const r = this.rooms.get(s.code);
        if (!r)
          throw new GameError(
            "ROOM_MISSING",
            "房间已关闭，请继续冒险并建立新房间",
          );
        const p = msg.payload;
        if (msg.kind === "hello") {
          if (s.clientId) throw new GameError("AUTH", "连接已经认证");
          requireToken(p?.clientToken);
          const hash = await digest(p.clientToken);
          const member = r.members.find((p) => p.tokenHash === hash);
          if (!member) throw new GameError("AUTH", "请通过房间码加入");
          for (const old of this.sessions)
            if (
              old !== s &&
              old.code === s.code &&
              old.clientId === member.clientId
            ) {
              this.sessions.delete(old);
              if (r.snapshot) r.snapshot = resetSnapshotMovement(r.snapshot,member.role??'all') as unknown as JsonObject;
              old.peer.close(4001, "已在另一个页面连接");
            }
          s.clientId = member.clientId;
          member.connected = true;
          const record = await this.store.load(r.credentials.adventureId);
          if (!record) throw new GameError("SAVE_MISSING", "存档暂时不可用");
          await this.persistRooms();
          this.send(s, "welcome", {
            clientId: s.clientId,
            room: this.view(r),
            credentials: r.credentials,
            save: record.save,
            snapshot: r.snapshot,
          });
          this.broadcast(r, "room", this.view(r));
          return;
        }
        const member = this.member(r, s.clientId);
        const host = s.clientId === r.hostId;
        if (msg.kind === "ping") {
          this.send(s, "pong", {});
          return;
        }
        if (msg.kind === "presence") {
          if (!host) throw new GameError("HOST_ONLY", "只有房主能恢复冒险");
          if (typeof p?.active !== "boolean")
            throw new GameError("PRESENCE", "伙伴在线状态无效");
          r.hostActive = p.active;
          if (!p.active && r.snapshot) r.snapshot = resetSnapshotMovement(r.snapshot,'none') as unknown as JsonObject;
          await this.persistRooms();
          this.broadcast(r, "room", this.view(r));
          return;
        }
        if (msg.kind === "role") {
          if (r.started)
            throw new GameError("STARTED", "进入冒险后不能更换小狗");
          requireRole(p?.role);
          if (r.members.some((m) => m !== member && m.role === p.role))
            throw new GameError("ROLE_TAKEN", "这只小狗已有伙伴选择");
          member.role = p.role;
          member.ready = false;
          await this.persistRooms();
          this.broadcast(r, "room", this.view(r));
          return;
        }
        if (msg.kind === "ready") {
          if (r.started || typeof p?.ready !== "boolean")
            throw new GameError("READY", "无法更改准备状态");
          member.ready = p.ready;
          await this.persistRooms();
          this.broadcast(r, "room", this.view(r));
          return;
        }
        if (msg.kind === "start") {
          if (!host) throw new GameError("HOST_ONLY", "等待房主开始冒险");
          if (r.started) return;
          if (
            r.members.length !== 2 ||
            r.members.some((m) => !m.connected || !m.ready || !m.role)
          )
            throw new GameError("NOT_READY", "需要两位伙伴都准备好");
          r.started = true;
          await this.persistRooms();
          const record = await this.store.load(r.credentials.adventureId);
          this.broadcast(r, "started", {
            save: record!.save,
            snapshot: r.snapshot,
          });
          this.broadcast(r, "room", this.view(r));
          return;
        }
        if (msg.kind === "close") {
          if (!host) throw new GameError("HOST_ONLY", "只有房主能结束房间");
          this.rooms.delete(r.code);
          await this.persistRooms();
          this.broadcast(r, "closed", {
            message: "房间已结束，冒险存档仍然保留",
          });
          for (const c of this.sessions)
            if (c.code === r.code) {
              this.sessions.delete(c);
              c.peer.close(1000, "房间已结束");
            }
          return;
        }
        if (!r.started)
          throw new GameError("NOT_STARTED", "请先准备并开始冒险");
        if (this.view(r).paused && msg.kind !== "save")
          throw new GameError("PAUSED", "伙伴暂时离开，等待恢复");
        if (msg.kind === "input") {
          if (
            host ||
            !member.role ||
            !isJsonObject(p?.input) ||
            JSON.stringify(p.input).length > 4096
          )
            throw new GameError("INPUT", "操作数据无效");
          const input = p.input;
          if(input.net!==undefined&&!validInputStamp(input.net))throw new GameError('INPUT','输入序号无效');
          if(input.regionStepBack!==undefined&&!validRegionStepBack(input.regionStepBack))throw new GameError('INPUT','返回已载入位置指令无效');
          if(input.regionLoad!==undefined&&!validRegionLoadCommand(input.regionLoad))throw new GameError('INPUT','区域准备指令无效');
          if(input.field!==undefined&&!validFieldCommand(input.field))throw new GameError('INPUT','探索活动操作无效');
          if(input.pet!==undefined&&!validPetCommand(input.pet))throw new GameError('INPUT','宠物操作无效');
          if(input.animal!==undefined&&!validAnimalCommand(input.animal))throw new GameError('INPUT','动物互动操作无效');
          if(input.duo!==undefined&&!validDuoCommand(input.duo))throw new GameError('INPUT','伙伴互动操作无效');
          const duo=r.snapshot?.duo as {phase?:string;type?:string}|undefined;
          // Role is authenticated by membership, never supplied by the input packet.
          if(duo?.phase==='active'&&duo.type==='ride'&&member.role==='white'){input.x=0;input.z=0;input.sprint=false;input.lift=0;}
          if(input.homeLights!==undefined&&(typeof input.homeLights!=='boolean'||r.snapshot?.regionId!=='player-home-villa'))throw new GameError('INPUT','家园灯光操作无效');
          if(input.story!==undefined&&!validStoryCommand(input.story))throw new GameError('INPUT','故事阅读指令无效');
          if (typeof input.x !== "number" || !Number.isFinite(input.x) || typeof input.z !== "number" || !Number.isFinite(input.z) ||
              !Array.isArray(input.actions) || input.actions.length > 10 ||
              !input.actions.every((a: unknown) => typeof a === "string" && ["attack","skill1","skill2","dodge","jump","interact","ping","mount","toggleWeapon"].includes(a)) ||
              (input.sprint !== undefined && typeof input.sprint !== "boolean") ||
              (input.lift !== undefined && (typeof input.lift !== "number" || !Number.isFinite(input.lift) || Math.abs(input.lift)>1)) ||
              (input.travelResponse !== undefined && !["accept","cancel"].includes(String(input.travelResponse))) ||
              (input.travel !== undefined && (!isJsonObject(input.travel) || !isId(input.travel.regionId) || !["map","walk","fly"].includes(String(input.travel.method)) || Object.keys(input.travel).some(key=>!["regionId","method"].includes(key)))))
            throw new GameError("INPUT", "移动操作数据无效");
          const target = [...this.sessions].find(
            (c) => c.code === r.code && c.clientId === r.hostId,
          );
          if (target)
            this.send(target, "input", {
              clientId: member.clientId,
              role: member.role,
              input: p.input,
            });
          return;
        }
        if (msg.kind === "snapshot") {
          if (!host) throw new GameError("HOST_ONLY", "只有房主能更新世界");
          if (
            !isJsonObject(p?.snapshot) ||
            new TextEncoder().encode(JSON.stringify(p.snapshot)).length >
              MAX_SNAPSHOT_BYTES
          )
            throw new GameError("SNAPSHOT", "世界同步数据无效");
          try { validateSnapshotShape(p.snapshot); } catch { throw new GameError("SNAPSHOT", "世界高度或移动状态无效"); }
          const live=p.snapshot as unknown as SnapshotShape;
          if(Object.values(live.players).some(player=>!['land','surface','underwater'].includes(player.swim??'')))throw new GameError('SNAPSHOT','水陆状态缺失，请双方刷新后重新同步');
          if(!validSwimTransition(r.snapshot as unknown as SnapshotShape|null,live))throw new GameError('SWIM_SPEED','水中移动超出合法速度，请重新同步');
          if(Object.values(live.players).some(player=>!withinLiveBounds(live.regionId??live.chapterId,player)))throw new GameError('BOUNDS','角色超出当前区域，请回到安全位置');
          if (p.snapshot.v !== 2) throw new GameError("VERSION", "场景版本不一致，请双方刷新后重试");
          if ((p.snapshot.mode ?? 'adventure') !== roomMode(r)) throw new GameError('MODE', '场景模式与房间不一致');
          if (p.snapshot.progress && p.snapshot.progress.adventureId !== r.credentials.adventureId)
            throw new GameError('AUTH','实时进度不属于这个房间');
          r.snapshot = p.snapshot;
          this.broadcast(r, "snapshot", r.snapshot, s);
          return;
        }
        if (msg.kind === "save") {
          if (!host) throw new GameError("HOST_ONLY", "只有房主能确认进度");
          if (!isId(p?.requestId)) throw new GameError("SAVE", "保存请求无效");
          requestId = p.requestId;
          const current = await this.store.load(r.credentials.adventureId);
          if (!current) throw new GameError("SAVE_MISSING", "存档暂时不可用");
          if (current.receipts[requestId!]) {
            this.send(s, "saved", {
              ...current.receipts[requestId!],
              save: current.save,
            });
            return;
          }
          if (p.expectedRevision !== current.save.revision)
            throw new GameError(
              "CONFLICT",
              "进度版本已变化，请重新连接以读取最新存档",
            );
          const save = validateSave(p.save);
          if (roomMode(save) !== roomMode(current.save)) throw new GameError('MODE', '不能跨模式保存');
          if (save.adventureId !== r.credentials.adventureId)
            throw new GameError("AUTH", "存档不属于这个房间");
          save.revision = current.save.revision + 1;
          save.updatedAt = new Date().toISOString();
          const receipt = {
            requestId: requestId!,
            revision: save.revision,
            updatedAt: save.updatedAt,
          };
          const receipts = Object.fromEntries(
            [...Object.entries(current.receipts), [requestId!, receipt]].slice(
              -128,
            ),
          );
          await this.store.save(save.adventureId, {
            ...current,
            save,
            receipts,
          }); // ACK strictly after durability
          this.broadcast(r, "saved", { ...receipt, save });
          return;
        }
        throw new GameError("MESSAGE", "不支持的同步消息");
      } catch (e) {
        const known = e instanceof GameError;
        this.send(s, "error", {
          code: known ? e.code : "SAVE_FAILED",
          message: known ? e.message : "保存或同步暂时失败，请保留页面稍后重试",
          ...(requestId ? { requestId } : {}),
        });
      }
    });
  }
  disconnect(s: Session): Promise<void> {
    return this.exclusive(async () => {
      if (!this.sessions.delete(s)) return;
      const r = this.rooms.get(s.code);
      if (!r || !s.clientId) return;
      const member = r.members.find((m) => m.clientId === s.clientId);
      if (member) member.connected = false;
      if (r.snapshot) r.snapshot = resetSnapshotMovement(r.snapshot,member?.role??'all') as unknown as JsonObject;
      await this.persistRooms();
      this.broadcast(r, "room", this.view(r));
    });
  }
}
