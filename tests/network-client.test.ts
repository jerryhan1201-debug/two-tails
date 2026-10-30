import {PROTOCOL_VERSION} from '../shared/protocol';
import test from "node:test";
import assert from "node:assert/strict";
import { GameNetwork } from "../src/network";
import {
  freshSave,
  makeBackup,
  type AdventureCredentials,
  type AdventureSave,
} from "../shared/save";
import type { CreateRoomResponse } from "../shared/protocol";

/** A delayed transport, not fake game state: exercise HTTP/WS races at the client boundary. */
function harness() {
  const original = new Map<string, PropertyDescriptor | undefined>();
  const replace = (key: string, value: unknown) => {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  };
  const values = new Map<string, string>();
  const failure = { pending: "none" as "none" | "throw" | "drop", protocol: PROTOCOL_VERSION as number };
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k.startsWith("starlight-pending:") && failure.pending !== "none") {
        if (failure.pending === "throw") throw new DOMException("Quota exceeded", "QuotaExceededError");
        return;
      }
      values.set(k, v);
    },
    removeItem: (k: string) => values.delete(k),
  };
  const requests: {
    signal: AbortSignal;
    body: any;
    respond(value: unknown): void;
  }[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const timeoutCallbacks: { callback: () => void; ms: number; timer: ReturnType<typeof setTimeout> }[] = [];
  const win = Object.assign(new EventTarget(), {
    setTimeout: (callback: () => void, ms: number) => {
      const timer = setTimeout(callback, ms);
      timer.unref();
      timers.add(timer);
      timeoutCallbacks.push({ callback, ms, timer });
      return timer;
    },
    setInterval: (callback: () => void, ms: number) => {
      const timer = setInterval(callback, ms);
      timer.unref();
      timers.add(timer);
      return timer;
    },
  });
  class Socket {
    static OPEN = 1;
    static sockets: Socket[] = [];
    readyState = 0;
    sent: any[] = [];
    onopen: (() => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly url: string) {
      Socket.sockets.push(this);
    }
    open() {
      this.readyState = 1;
      this.onopen?.();
    }
    close() {
      this.readyState = 3;
      this.onclose?.({ code: 1000 });
    }
    send(text: string) {
      this.sent.push(JSON.parse(text));
    }
    receive(kind: string, payload: unknown, seq: number) {
      this.onmessage?.({ data: JSON.stringify({ v: PROTOCOL_VERSION, seq, kind, payload }) });
    }
  }
  replace("localStorage", storage);
  replace("window", win);
  replace(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  replace("location", { origin: "https://test.example" });
  replace("WebSocket", Socket);
  // Deliberately ignore AbortSignal in the response promise: generation must also reject already-in-flight completion.
  replace(
    "fetch",
    (_url: string, options: RequestInit) => _url.endsWith("/api/health")
      ? Promise.resolve(new Response(JSON.stringify({ok: true, protocol: failure.protocol}), {status: 200}))
      : new Promise((resolve) =>
        requests.push({
          signal: options.signal!,
          body: JSON.parse(options.body as string),
          respond: (value) =>
            resolve(new Response(JSON.stringify(value), { status: 200 })),
        }),
      ),
  );
  return {
    values,
    failure,
    expireSaveTimeout() {
      const timeout = [...timeoutCallbacks].reverse().find(t => t.ms === 15000)!;
      clearTimeout(timeout.timer);
      timeout.callback();
    },
    requests,
    sockets: Socket.sockets,
    cleanup() {
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
      for (const [key, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
function fixture(id = "a_first"): CreateRoomResponse {
  return {
    credentials: { adventureId: id, recoveryToken: "a".repeat(64) },
    save: freshSave(id),
    room: {
      code: "AABBCC",
      adventureId: id,
      hostId: "p_host",
      players: [
        { clientId: "p_host", role: "gold", ready: true, connected: true },
        { clientId: "p_guest", role: "white", ready: true, connected: true },
      ],
      started: true,
      paused: false,
    },
  };
}
function seed(
  h: ReturnType<typeof harness>,
  credentials: AdventureCredentials,
  save: AdventureSave,
) {
  h.values.set("starlight-adventure", JSON.stringify(credentials));
  h.values.set(`starlight-save:${save.adventureId}`, JSON.stringify(save));
}
async function connect(
  h: ReturnType<typeof harness>,
  network: GameNetwork,
  data = fixture(),
) {
  const operation = network.createRoom(data.credentials);
  await new Promise(resolve => setImmediate(resolve));
  h.requests.at(-1)!.respond(data);
  await operation;
  const socket = h.sockets.at(-1)!;
  socket.open();
  socket.receive("welcome", { ...data, clientId: "p_host", snapshot: null }, 1);
  return socket;
}

test("disconnect cancels delayed create/join, including response promises that ignore abort", async () => {
  const h = harness();
  try {
    const network = new GameNetwork(),
      before = new Map(h.values);
    for (const kind of ["create", "join"]) {
      const operation =
        kind === "create" ? network.createRoom() : network.joinRoom("AABBCC");
      const rejected = assert.rejects(operation, /取消/);
      await new Promise(resolve => setImmediate(resolve));
      const request = h.requests.at(-1)!;
      network.disconnect();
      assert.equal(request.signal.aborted, true);
      request.respond(kind === "create" ? fixture() : { room: fixture().room });
      await rejected;
      assert.equal(network.state, "offline");
      assert.equal(network.credentials, null);
      assert.equal(h.sockets.length, 0);
      assert.deepEqual(h.values, before);
    }
  } finally {
    h.cleanup();
  }
});

test("a late load cannot overwrite an adventure imported after it", async () => {
  const h = harness();
  try {
    const first = fixture(),
      second = fixture("a_second");
    seed(h, first.credentials, first.save);
    const network = new GameNetwork(),
      operation = network.loadAdventure();
    const rejected = assert.rejects(operation, /取消/);
    await new Promise(resolve => setImmediate(resolve));
    const old = h.requests.at(-1)!;
    const restore = network.importBackup(
      makeBackup(second.credentials, second.save),
    );
    await new Promise(resolve => setImmediate(resolve));
    h.requests.at(-1)!.respond({ save: second.save });
    await restore;
    old.respond({ save: { ...first.save, revision: 42 } });
    await rejected;
    assert.equal(network.credentials?.adventureId, second.save.adventureId);
    assert.equal(network.save?.revision, 0);
    assert.equal(
      h.values.get("starlight-adventure"),
      JSON.stringify(second.credentials),
    );
    assert.equal(
      h.values.get(`starlight-save:${first.save.adventureId}`),
      JSON.stringify(first.save),
    );
    assert.equal(h.sockets.length, 0);
  } finally {
    h.cleanup();
  }
});

test("stale socket save receipts cannot update caches; unconfirmed checkpoint survives disconnect and retries on reconnect", async () => {
  const h = harness();
  try {
    const data = fixture(),
      network = new GameNetwork(),
      socket = await connect(h, network, data);
    const save = structuredClone(data.save);
    save.quests["first-light"] = true;
    const saving = network.checkpoint(save);
    await Promise.resolve();
    const pending = socket.sent.find((m) => m.kind === "save").payload;
    const pendingKey = `starlight-pending:${save.adventureId}`,
      originalPending = h.values.get(pendingKey);
    assert.ok(originalPending);
    network.disconnect();
    const accepted = { ...save, revision: 1 },
      receipt = {
        requestId: pending.requestId,
        revision: 1,
        updatedAt: accepted.updatedAt,
        save: accepted,
      };
    socket.receive("saved", receipt, 2);
    assert.equal(network.save?.revision, 0);
    assert.equal(
      h.values.get(pendingKey),
      originalPending,
      "late receipt after leave must not silently commit",
    );
    const resumed = await connect(h, network, data);
    assert.equal(
      resumed.sent.find((m) => m.kind === "save").payload.requestId,
      pending.requestId,
      "retry keeps the exact durable request identity",
    );
    resumed.receive("saved", receipt, 2);
    await saving;
    assert.equal(network.save?.revision, 1);
    assert.equal(h.values.has(pendingKey), false);
    assert.equal(network.save?.quests["first-light"], true);
    network.disconnect();
  } finally {
    h.cleanup();
  }
});

test("old socket and queued wrong-adventure checkpoint cannot replace newly selected adventure", async () => {
  const h = harness();
  try {
    const first = fixture(),
      second = fixture("a_second"),
      network = new GameNetwork();
    const stale = await connect(h, network, first);
    await connect(h, network, second);
    const before = new Map(h.values);
    stale.receive(
      "welcome",
      { ...first, clientId: "p_host", snapshot: null },
      2,
    );
    stale.receive(
      "saved",
      { requestId: "stale", save: first.save, revision: 30 },
      3,
    );
    stale.receive("closed", { message: "old room closed" }, 4);
    assert.equal(network.credentials?.adventureId, second.save.adventureId);
    assert.equal(network.state, "online");
    assert.deepEqual(h.values, before);
    await assert.rejects(network.checkpoint(first.save), /上一段冒险/);
    assert.deepEqual(h.values, before);
    network.disconnect();
  } finally {
    h.cleanup();
  }
});

test("quota failure and silently dropped writes never claim a durable pending save; latest recovery export remains available", async () => {
  for (const fault of ["throw", "drop"] as const) {
    const h = harness();
    try {
      const data = fixture(), network = new GameNetwork(), socket = await connect(h, network, data);
      const healthy = h.values.get(`starlight-save:${data.save.adventureId}`);
      h.failure.pending = fault;
      const save = structuredClone(data.save);
      save.quests["first-light"] = true;
      const statuses: string[] = [];
      network.addEventListener("save-status", event => statuses.push((event as CustomEvent).detail.status));
      const saving = network.checkpoint(save);
      const rejected = assert.rejects(saving, /本机写入也失败.*仅在当前页面/);
      await Promise.resolve();
      assert.equal(network.pendingStatus, "memory");
      assert.equal(h.values.has(`starlight-pending:${save.adventureId}`), false);
      assert.equal(h.values.get(`starlight-save:${save.adventureId}`), healthy);
      assert.deepEqual(statuses, ["memory"]);
      assert.ok(socket.sent.some(m => m.kind === "save"), "server can still acknowledge despite local failure");
      const backup = JSON.parse(network.exportBackup());
      assert.equal(backup.save.quests["first-light"], true);
      assert.equal(network.save?.quests["first-light"], undefined, "export never marks unconfirmed progress as saved");
      h.expireSaveTimeout();
      await rejected;
      assert.equal(network.pendingStatus, "memory");
      network.disconnect();
    } finally { h.cleanup(); }
  }
});

test("retry first acknowledges the identical failed pending request, then saves the newer live state", async () => {
  const h = harness();
  try {
    const data = fixture(), network = new GameNetwork(), socket = await connect(h, network, data);
    h.failure.pending = "throw";
    const first = structuredClone(data.save);
    first.quests["first-light"] = true;
    const saving = network.checkpoint(first), rejected = assert.rejects(saving, /仅在当前页面/);
    await Promise.resolve();
    const pending = socket.sent.find(m => m.kind === "save").payload;
    h.expireSaveTimeout(); await rejected;
    h.failure.pending = "none";
    const latest = structuredClone(first);
    latest.quests["forest-gate"] = true;
    const retry = network.checkpoint(latest);
    let resolved = false; void retry.then(() => { resolved = true; });
    await Promise.resolve();
    const durable = JSON.parse(h.values.get(`starlight-pending:${first.adventureId}`)!);
    assert.equal(durable.requestId, pending.requestId);
    assert.equal(network.pendingStatus, "local");
    socket.receive("saved", { requestId: pending.requestId, revision: 1, updatedAt: first.updatedAt, save: { ...first, revision: 1 } }, 2);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(resolved, false, "the old receipt is not confirmation of newer state");
    const next = socket.sent.filter(m => m.kind === "save").at(-1).payload;
    assert.notEqual(next.requestId, pending.requestId);
    assert.equal(next.expectedRevision, 1);
    assert.equal(next.save.quests["forest-gate"], true);
    socket.receive("saved", { requestId: next.requestId, revision: 2, updatedAt: latest.updatedAt, save: { ...latest, revision: 2 } }, 3);
    assert.equal((await retry).revision, 2);
    assert.equal(network.pendingStatus, "none");
    assert.equal(h.values.has(`starlight-pending:${first.adventureId}`), false);
    assert.equal(network.save?.quests["forest-gate"], true);
    network.disconnect();
  } finally { h.cleanup(); }
});

test("a server receipt succeeds despite a local quota error, while a refreshed client cannot invent an absent pending checkpoint", async () => {
  const h = harness();
  try {
    const data = fixture(), network = new GameNetwork(), socket = await connect(h, network, data);
    h.failure.pending = "throw";
    const save = structuredClone(data.save); save.quests["first-light"] = true;
    const saving = network.checkpoint(save);
    await Promise.resolve();
    const pending = socket.sent.find(m => m.kind === "save").payload;
    assert.equal(network.pendingStatus, "memory");
    const refreshed = new GameNetwork();
    assert.equal(refreshed.save?.quests["first-light"], undefined);
    assert.equal(refreshed.pendingStatus, "none");
    socket.receive("saved", { requestId: pending.requestId, revision: 1, updatedAt: save.updatedAt, save: { ...save, revision: 1 } }, 2);
    assert.equal((await saving).revision, 1);
    assert.equal(network.pendingStatus, "none");
    assert.equal(network.save?.quests["first-light"], true);
    assert.throws(() => network.exportBackup(freshSave("a_wrong")), /其他冒险/);
    network.disconnect();
  } finally { h.cleanup(); }
});


test("v1 service is rejected before a room write or credential change", async () => {
  const h = harness();
  try {
    h.failure.protocol = 1;
    const network = new GameNetwork(), before = new Map(h.values);
    await assert.rejects(network.createRoom(), new RegExp('服务版本不匹配.*需要协议 '+PROTOCOL_VERSION));
    assert.equal(h.requests.length, 0);
    assert.equal(h.sockets.length, 0);
    assert.equal(network.credentials, null);
    assert.deepEqual(h.values, before);
  } finally { h.cleanup(); }
});

test("a socket switched to an older protocol stops reconnecting with a clear error", async () => {
  const h = harness();
  try {
    const network = new GameNetwork(), socket = await connect(h, network);
    let message = "";
    network.addEventListener("error", e => { message = (e as CustomEvent).detail.message; });
    const before = new Map(h.values);
    socket.onmessage?.({ data: JSON.stringify({v:1,seq:2,kind:"error",payload:{code:"VERSION"}}) });
    assert.equal(network.state, "offline");
    assert.match(message, /同一版本的私人地址/);
    assert.equal(socket.readyState, 3);
    assert.deepEqual(h.values, before);
  } finally { h.cleanup(); }
});

test('backpressure skips snapshot construction; diagnostics never expose credentials or messages',async()=>{
 const h=harness();try{const n=new GameNetwork(),s=await connect(h,n);let builds=0;(s as any).bufferedAmount=100000;n.sendSnapshot(()=>{builds++;return{synthetic:true};});assert.equal(builds,0);assert.equal(n.diagnostics.coalescedSnapshots,1);(s as any).bufferedAmount=0;n.sendSnapshot(()=>{builds++;return{synthetic:true};});assert.equal(builds,1);const diag=JSON.stringify(n.diagnostics);assert(!diag.includes('recoveryToken'));assert(!diag.includes('a_first'));assert(!diag.includes('synthetic'));n.disconnect();}finally{h.cleanup();}
});
test('guest backpressure preserves stop/action order and reconnect discards unsent old movement',async()=>{
 const h=harness();try{const n=new GameNetwork(),s=await connect(h,n);n.clientId='p_guest';(s as any).bufferedAmount=70000;n.sendInput({x:0,z:1,actions:[]});n.sendInput({x:0,z:0,actions:[]});n.sendInput({x:0,z:1,actions:['toggleWeapon']});assert.equal(n.diagnostics.queuedInputs,2);assert.equal(s.sent.filter(m=>m.kind==='input').length,0);(s as any).bufferedAmount=0;await new Promise(r=>setTimeout(r,145));const sent=s.sent.filter(m=>m.kind==='input');assert.equal(sent.length,2);assert.equal(sent[0].payload.input.z,0);assert.deepEqual(sent[1].payload.input.actions,['toggleWeapon']);assert(sent[1].payload.input.net.seq>sent[0].payload.input.net.seq);(s as any).bufferedAmount=70000;n.sendInput({x:0,z:1,actions:[]});assert(n.diagnostics.queuedInputs>0);n.disconnect();assert.equal(n.diagnostics.queuedInputs,0);}finally{h.cleanup();}
});
