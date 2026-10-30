import {
  makeBackup,
  parseBackup,
  validateSave,
  type AdventureCredentials,
  type AdventureSave,
  type DogRole,
  type JsonObject,
  type SaveReceipt,
} from "../shared/save";
import {NetworkMetrics} from './network-metrics';
import {InputOutbox} from './input-transport';
import {validInputAcks} from '../shared/input-ack';
import { PROTOCOL_VERSION } from "../shared/protocol";
import {credentialKey, roomMode, type RoomMode} from '../shared/modes';
import type {
  CreateRoomResponse,
  RoomView,
  ServerMessage,
  WelcomePayload,
} from "../shared/protocol";
export type NetworkState =
  | "connecting"
  | "online"
  | "reconnecting"
  | "offline"
  | "paused";
interface PendingSave {
  requestId: string;
  save: AdventureSave;
  expectedRevision: number;
}
const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
      return localStorage.getItem(key) === value;
    } catch {
      return false;
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
/** No cloud credentials in URLs. Each browser retains a stable player token. */
export class GameNetwork extends EventTarget {
  mode: RoomMode = 'adventure';
  savedMode(mode: RoomMode) {
    try {
      const credentials = JSON.parse(storage.get(credentialKey(mode)) || 'null') as AdventureCredentials | null;
      const save = credentials ? validateSave(JSON.parse(storage.get(`starlight-save:${credentials.adventureId}`) || 'null')) : null;
      return save && roomMode(save) === mode ? {credentials, save} : {credentials: null, save: null};
    } catch { return {credentials: null, save: null}; }
  }
  selectMode(mode: RoomMode) {
    this.cancelTransport(); this.mode = mode;
    const saved = this.savedMode(mode); this.credentials = saved.credentials; this.save = saved.save;
    this.pending = null; this.pendingDurable = false; this.room = null;
  }
  room: RoomView | null = null;
  save: AdventureSave | null = null;
  credentials: AdventureCredentials | null = null;
  clientId: string | null = null;
  state: NetworkState = "offline";
  private clientToken: string;
  private ws: WebSocket | null = null;
  readonly metrics=new NetworkMetrics();
  private inputOutbox=new InputOutbox();
  private inputTimer=0;private inputEpoch=0;private inputSeq=0;private inputAt=0;
  get diagnostics(){return{state:this.state,host:this.isHost,...this.metrics.snapshot(this.ws?.bufferedAmount??0),queuedInputs:this.inputOutbox.length};}
  private resetInputs(){clearTimeout(this.inputTimer);this.inputTimer=0;this.inputOutbox.clear();this.inputAt=0;this.metrics.resetTransport();}
  private seq = 0;
  private serverSeq = -1;
  private desired = false;
  private reconnectAttempt = 0;
  private reconnectTimer = 0;
  private heartbeatTimer = 0;
  private roomCode = "";
  private lastReceivedAt = 0;
  private generation = 0;
  private requests = new Set<AbortController>();
  private pending: PendingSave | null = null;
  private pendingDurable = false;
  private waiters = new Map<
    string,
    {
      resolve: (r: SaveReceipt) => void;
      reject: (e: Error) => void;
      timer: number;
    }
  >();
  private saveQueue: Promise<unknown> = Promise.resolve();
  constructor(private baseUrl = "") {
    super();
    this.clientToken = storage.get("starlight-player") || token();
    storage.set("starlight-player", this.clientToken);
    try {
      this.credentials = JSON.parse(
        storage.get("starlight-adventure") || "null",
      );
    } catch {}
    if (this.credentials) {
      try {
        this.save = validateSave(
          JSON.parse(
            storage.get(`starlight-save:${this.credentials.adventureId}`) ||
              "null",
          ),
        );
      } catch {}
    }
    window.addEventListener("online", () => {
      if (this.desired) this.reconnect();
    });
    document.addEventListener("visibilitychange", () => {
      const active = document.visibilityState === "visible";
      if (this.desired && this.ws?.readyState === WebSocket.OPEN && this.isHost)
        this.send("presence", { active });
      if (active && this.desired && this.ws?.readyState !== WebSocket.OPEN)
        this.reconnect();
    });
  }
  get isHost() {
    return !!this.room && this.clientId === this.room.hostId;
  }
  get role(): DogRole | null {
    return (
      this.room?.players.find((p) => p.clientId === this.clientId)?.role || null
    );
  }
  /** Only a successful write and exact read-back qualify as a local recovery record. */
  get pendingStatus(): "none" | "local" | "memory" {
    return !this.pending ? "none" : this.pendingDurable ? "local" : "memory";
  }
  private persistPending() {
    if (!this.pending || !this.credentials) return;
    const previous = this.pendingStatus;
    this.pendingDurable =
      storage.set("starlight-player", this.clientToken) &&
      storage.set(credentialKey(this.mode), JSON.stringify(this.credentials)) &&
      storage.set(
        `starlight-pending:${this.credentials.adventureId}`,
        JSON.stringify(this.pending),
      );
    if (previous !== this.pendingStatus || this.pendingStatus === "memory")
      this.emit("save-status", { status: this.pendingStatus });
  }
  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
  private status(state: NetworkState, message: string) {
    this.state = state;
    this.emit("status", { state, message });
  }
  private assertCurrent(generation: number) {
    if (generation !== this.generation) throw new Error("已取消上一次联机操作");
  }
  private cancelTransport() {
    this.generation++;
    this.resetInputs();
    this.desired = false;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
    for (const request of this.requests) request.abort();
    this.requests.clear();
    const old = this.ws;
    this.ws = null;
    old?.close();
    // Keep pending in memory too: local storage may have rejected the recovery record.
  }
  private async post<T>(
    path: string,
    body: unknown,
    generation = this.generation,
  ): Promise<T> {
    this.assertCurrent(generation);
    const controller = new AbortController();
    this.requests.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      // Check before any room creation/restore can write to a different server version.
      const health = await fetch(`${this.baseUrl}/api/health`, {
        cache: "no-store", signal: controller.signal,
      });
      const identity = await health.json().catch(() => null);
      this.assertCurrent(generation);
      if (!health.ok || identity?.protocol !== PROTOCOL_VERSION)
        throw new Error(`联机服务版本不匹配（需要协议 ${PROTOCOL_VERSION}），请双方刷新到同一版本，再继续原有冒险；存档仍保留。`);
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json();
      this.assertCurrent(generation);
      if (!response.ok) throw new Error(data.message || "连接未成功");
      return data as T;
    } finally {
      clearTimeout(timeout);
      this.requests.delete(controller);
    }
  }
  async createRoom(resume?: AdventureCredentials): Promise<RoomView> {
    this.cancelTransport();
    const generation = this.generation;
    this.status("connecting", "正在建立冒险房间");
    const data = await this.post<CreateRoomResponse>(
      "/api/rooms",
      {
        clientToken: this.clientToken,
        resume,
        mode: this.mode,
      },
      generation,
    );
    this.assertCurrent(generation);
    this.acceptProgress(data.credentials, data.save);
    this.room = data.room;
    this.roomCode = data.room.code;
    this.desired = true;
    this.connect();
    return data.room;
  }
  async joinRoom(code: string): Promise<RoomView> {
    this.cancelTransport();
    const generation = this.generation;
    this.status("connecting", "正在寻找伙伴");
    const data = await this.post<{ room: RoomView }>(
      "/api/join",
      {
        clientToken: this.clientToken,
        code: code.trim().toUpperCase(),
      },
      generation,
    );
    this.assertCurrent(generation);
    this.room = data.room;
    this.roomCode = data.room.code;
    this.desired = true;
    this.connect();
    return data.room;
  }
  async loadAdventure(credentials = this.credentials): Promise<AdventureSave> {
    if (!credentials) throw new Error("还没有冒险恢复凭证");
    const generation = this.generation;
    const data = await this.post<{ save: AdventureSave }>(
      "/api/adventures/load",
      { credentials },
      generation,
    );
    this.assertCurrent(generation);
    this.acceptProgress(credentials, data.save);
    return data.save;
  }
  private acceptProgress(
    credentials: AdventureCredentials,
    save: AdventureSave,
  ) {
    if (this.credentials?.adventureId !== credentials.adventureId) {
      this.pending = null;
      this.pendingDurable = false;
    }
    this.credentials = credentials;
    this.save = validateSave(save);
    this.mode = roomMode(save);
    storage.set(credentialKey(this.mode), JSON.stringify(credentials));
    storage.set(
      `starlight-save:${credentials.adventureId}`,
      JSON.stringify(save),
    );
  }
  private connect() {
    if (!this.desired) return;
    this.resetInputs();this.inputEpoch=crypto.getRandomValues(new Uint32Array(1))[0];this.inputSeq=0;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    const address = new URL(`${this.baseUrl || location.origin}/ws`);
    address.protocol = address.protocol === "https:" ? "wss:" : "ws:";
    address.searchParams.set("room", this.roomCode);
    this.seq = 0;
    this.serverSeq = -1;
    const generation = this.generation;
    const socket = new WebSocket(address);
    this.ws = socket;
    const current = () =>
      generation === this.generation && this.ws === socket && this.desired;
    socket.onopen = () => {
      if (!current()) return;
      this.lastReceivedAt = Date.now();
      this.send("hello", { clientToken: this.clientToken });
      this.heartbeatTimer = window.setInterval(() => {
        if (!current()) return;
        if (Date.now() - this.lastReceivedAt > 15000) {
          this.ws?.close();
          return;
        }
        this.send("ping", {});
        if (this.isHost && this.pending) {
          this.persistPending();
          this.send("save", this.pending);
        }
      }, 5000);
    };
    socket.onmessage = (event) => {
      if (!current()) return;
      this.lastReceivedAt = Date.now();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.v !== PROTOCOL_VERSION) {
        const message = "联机服务版本不匹配，请双方使用同一版本的私人地址；原有进度仍保留。";
        this.cancelTransport();
        this.status("offline", message);
        this.emit("error", { code: "VERSION", message });
        return;
      }
      if (msg.seq <= this.serverSeq) return;
      this.serverSeq = msg.seq;
      this.metrics.received(msg.kind,new TextEncoder().encode(event.data).length,msg.seq);
      const p = msg.payload as any;
      if (msg.kind === "welcome") {
        const welcome = p as WelcomePayload;
        this.clientId = welcome.clientId;
        this.room = welcome.room;
        this.reconnectAttempt = 0;
        this.acceptProgress(welcome.credentials, welcome.save);
        if (this.isHost && !this.pending) {
          try {
            const pending = JSON.parse(
              storage.get(
                `starlight-pending:${welcome.credentials.adventureId}`,
              ) || "null",
            );
            if (
              pending &&
              pending.save?.adventureId === welcome.credentials.adventureId
            ) {
              validateSave(pending.save);
              this.pending = pending;
              this.pendingDurable = true;
            }
          } catch {}
        }
        // Recover an unacknowledged durable checkpoint before starting simulation after a refresh.
        const pendingResume =
          this.isHost &&
          this.pending?.expectedRevision === welcome.save.revision
            ? this.pending.save
            : null;
        this.status(
          welcome.room.paused ? "paused" : "online",
          welcome.room.paused
            ? "等待伙伴回到冒险，世界已暂停"
            : "伙伴连接已就绪",
        );
        this.emit("room", this.room);
        if (welcome.room.started)
          this.emit("started", {
            save: pendingResume || welcome.save,
            snapshot: pendingResume ? null : welcome.snapshot,
          });
        if (welcome.snapshot && !pendingResume)
          this.emit("snapshot", welcome.snapshot);
        if (this.isHost)
          this.send("presence", {
            active: document.visibilityState === "visible",
          });
        if (this.isHost && this.pending) {
          this.persistPending();
          this.send("save", this.pending);
        }
        return;
      }
      if (msg.kind === "room") {
        this.room = p;
        this.status(
          p.paused ? "paused" : "online",
          p.paused ? "等待伙伴回到冒险，世界已暂停" : "已连接伙伴",
        );
        this.emit("room", p);
        return;
      }
      if (msg.kind === "saved") {
        if (p.save?.adventureId !== this.credentials?.adventureId) return;
        if (this.credentials && p.save)
          this.acceptProgress(this.credentials, p.save);
        const waiter = this.waiters.get(p.requestId);
        if (waiter) {
          clearTimeout(waiter.timer);
          waiter.resolve(p);
          this.waiters.delete(p.requestId);
        }
        if (this.pending?.requestId === p.requestId) {
          this.pending = null;
          this.pendingDurable = false;
          if (this.credentials)
            storage.remove(`starlight-pending:${this.credentials.adventureId}`);
        }
        this.emit("saved", p);
        return;
      }
      if (msg.kind === "closed") {
        this.desired = false;
        this.room = null;
        this.status("offline", p.message);
        this.emit("closed", p);
        return;
      }
      if (msg.kind === "error") {
        const waiter = this.waiters.get(p.requestId);
        if (waiter) {
          clearTimeout(waiter.timer);
          waiter.reject(new Error(p.message));
          this.waiters.delete(p.requestId);
        }
        if (
          p.code === "VERSION" ||
          p.code === "ROOM_MISSING" ||
          p.code === "AUTH"
        ) {
          this.desired = false;
          this.ws?.close();
        }
        this.emit("error", p);
        return;
      }
      if(msg.kind==='snapshot'&&validInputAcks(p?.inputAcks)){const ack=this.role?p.inputAcks[this.role]:null;if(ack?.epoch===this.inputEpoch)this.metrics.confirm(ack.seq);}
      this.emit(msg.kind, p);
    };
    socket.onclose = (event) => {
      if (!current()) return;
      clearInterval(this.heartbeatTimer);this.resetInputs();
      if (event.code === 4001) {
        this.desired = false;
        this.status("offline", "这只小狗已在另一个页面连接");
        return;
      }
      if (!this.desired) {
        this.status("offline", "已离开房间，确认的进度已保留");
        return;
      }
      this.metrics.reconnects++;
      this.status("reconnecting", "连接中断，冒险暂停 · 正在重连");
      this.reconnectTimer = window.setTimeout(
        () => this.connect(),
        Math.min(10000, 700 * 2 ** this.reconnectAttempt++)*(.8+Math.random()*.4),
      );
    };
    socket.onerror = () => {
      if (!current()) return;
      this.status("reconnecting", "暂时连接不上，正在等待网络");
    };
  }
  reconnect() {
    if (this.roomCode) {
      this.desired = true;
      this.status("reconnecting", "正在恢复伙伴连接");
      this.connect();
    }
  }
  private send(kind: string, payload: unknown) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    const data=JSON.stringify({v:PROTOCOL_VERSION,seq:++this.seq,kind,payload});
    this.metrics.sent(kind,new TextEncoder().encode(data).length,this.seq,this.ws.bufferedAmount??0);
    this.ws.send(data);
    return true;
  }
  selectRole(role: DogRole) {
    this.send("role", { role });
  }
  ready(ready = true) {
    this.send("ready", { ready });
  }
  start() {
    this.send("start", {});
  }
  sendInput(input: JsonObject) {
    if(this.isHost||this.state!=='online'||this.ws?.readyState!==WebSocket.OPEN)return;
    if(!this.inputOutbox.offer(input,performance.now())){this.resetInputs();this.ws?.close();return;}
    this.flushInput();
  }
  private flushInput(){
    if(this.inputTimer)return;
    const item=this.inputOutbox.peek();if(!item)return;
    const now=performance.now();
    if(now-item.at>2000){this.resetInputs();this.ws?.close();return;}
    if(this.state!=='online'||this.ws?.readyState!==WebSocket.OPEN){this.resetInputs();return;}
    if(now-this.inputAt<60||(this.ws.bufferedAmount??0)>65536){this.inputTimer=window.setTimeout(()=>{this.inputTimer=0;this.flushInput();},Math.max(16,60-(now-this.inputAt)));return;}
    const stamp={epoch:this.inputEpoch,seq:++this.inputSeq};
    if(this.send('input',{input:{...item.input,net:stamp}})){this.inputAt=now;this.inputOutbox.shift();this.metrics.inputSent(stamp.seq,now);this.emit('input-sent',{stamp,at:now});}
    if(this.inputOutbox.length)this.inputTimer=window.setTimeout(()=>{this.inputTimer=0;this.flushInput();},60);
  }
  sendSnapshot(snapshot: JsonObject|(()=>JsonObject)) {
    if(!this.isHost||this.ws?.readyState!==WebSocket.OPEN)return;
    // A snapshot supersedes older snapshots; never queue stale worlds or build them under backpressure.
    if((this.ws.bufferedAmount??0)>98304){this.metrics.coalescedSnapshots++;return;}
    this.send('snapshot',{snapshot:typeof snapshot==='function'?snapshot():snapshot});
  }
  checkpoint(save: AdventureSave): Promise<SaveReceipt> {
    const operation = this.saveQueue.then(() => this.saveOne(save));
    this.saveQueue = operation.catch(() => {});
    return operation;
  }
  private async saveOne(save: AdventureSave): Promise<SaveReceipt> {
    if (!this.isHost || !this.credentials || !this.save)
      throw new Error("需要由房主确认保存");
    if (save.adventureId !== this.credentials.adventureId)
      throw new Error("不能将上一段冒险的进度保存到当前冒险");
    // Retry the identical request before saving the newer captured state. A receipt for
    // the older checkpoint must never be reported as confirmation of the newer one.
    if (this.pending) await this.submitPending(this.pending);
    if (!this.isHost || save.adventureId !== this.credentials?.adventureId)
      throw new Error("不能将上一段冒险的进度保存到当前冒险");
    const pending: PendingSave = {
      requestId: `s_${crypto.randomUUID().replaceAll("-", "")}`,
      save: validateSave(save),
      expectedRevision: this.save.revision,
    };
    this.pending = pending;
    this.pendingDurable = false;
    return this.submitPending(pending);
  }
  private submitPending(pending: PendingSave): Promise<SaveReceipt> {
    this.persistPending();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.waiters.delete(pending.requestId);
        reject(new Error(this.pendingDurable
          ? "服务器尚未确认；待同步记录已写入本机，请重试或导出当前进度"
          : "服务器尚未确认，本机写入也失败；最新进度仅在当前页面，请勿刷新，先重试或导出备份"));
      }, 15000);
      this.waiters.set(pending.requestId, { resolve, reject, timer });
      if (!this.send("save", pending))
        this.status("reconnecting", "进度等待同步，网络恢复后将重试");
    });
  }
  closeRoom() {
    if (this.isHost) this.send("close", {});
  }
  disconnect() {
    this.cancelTransport();
    this.status("offline", "已离开房间");
  }
  exportBackup(current?: AdventureSave): string {
    if (!this.credentials || !this.save)
      throw new Error("尚无可导出的已确认存档");
    const save = current || this.pending?.save || this.save;
    if (save.adventureId !== this.credentials.adventureId)
      throw new Error("不能导出其他冒险的进度");
    return makeBackup(this.credentials, save);
  }
  async importBackup(text: string): Promise<AdventureSave> {
    const backup = parseBackup(text);
    this.cancelTransport();
    const generation = this.generation;
    const result = await this.post<{ save: AdventureSave }>(
      "/api/adventures/restore",
      { credentials: backup.credentials, save: backup.save },
      generation,
    );
    this.assertCurrent(generation);
    this.acceptProgress(backup.credentials, result.save);
    return result.save;
  }
}
