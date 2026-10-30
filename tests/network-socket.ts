/** Real local TCP/WebSocket smoke test. Start server/local.ts, then node --import tsx tests/network-socket.ts. */
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation";
import { WebSocket } from "ws";
const base = process.env.TEST_SERVER || "http://127.0.0.1:8787";
async function post(path: string, data: unknown) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await res.json()) as any;
  assert.equal(res.status, 200, JSON.stringify(body));
  return body;
}
function identity() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
async function socket(code: string, clientToken: string) {
  const ws = new WebSocket(base.replace("http", "ws") + "/ws?room=" + code);
  let seq = 0;
  const all: any[] = [];
  ws.on("message", (raw) => all.push(JSON.parse(raw.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  function send(kind: string, payload: unknown = {}) {
    ws.send(JSON.stringify({ v: 2, seq: seq++, kind, payload }));
  }
  async function wait(
    kind: string,
    predicate: (p: any) => boolean = () => true,
  ) {
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const index = all.findIndex(
        (m) => m.kind === kind && predicate(m.payload),
      );
      if (index !== -1) return all.splice(index, 1)[0].payload;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(
      "Timed out waiting for " + kind + ": " + JSON.stringify(all),
    );
  }
  send("hello", { clientToken });
  const welcome = await wait("welcome");
  return { ws, send, wait, welcome };
}
const hostToken = identity(),
  guestToken = identity();
const made = await post("/api/rooms", { clientToken: hostToken });
await post("/api/join", { code: made.room.code, clientToken: guestToken });
const host = await socket(made.room.code, hostToken),
  guest = await socket(made.room.code, guestToken);
try {
  host.send("ready", { ready: true });
  guest.send("ready", { ready: true });
  await host.wait("room", (p) => p.players.every((m: any) => m.ready));
  host.send("start");
  await guest.wait("started");
  guest.send("input", { input: { x: 1, z: 0, sprint: true, actions: ["jump"] } });
  const input = await host.wait("input");
  assert.equal(input.input.sprint, true);
  const simulation = new Simulation(made.save);
  simulation.command(input.role,input.input); simulation.tick(.05);
  host.send("snapshot", { snapshot: simulation.state });
  const partner = (await guest.wait("snapshot")).players.white;
  assert.equal(partner.grounded,false); assert.equal(partner.sprinting,true);
  assert.equal(partner.y,simulation.state.players.white.y);assert.equal(partner.vy,simulation.state.players.white.vy);
  const save = {
    ...made.save,
    chapterId: "ch03",
    checkpointId: "ruins",
    world: { enemyDefeated: true, bridgeBroken: true },
  };
  host.send("save", { save, expectedRevision: 0, requestId: "socket_commit" });
  assert.equal((await guest.wait("saved")).revision, 1);
  host.ws.close();
  assert.equal((await guest.wait("room", (p) => p.paused)).paused, true);
  const resumed = await socket(made.room.code, hostToken);
  assert.equal(resumed.welcome.snapshot.players.white.grounded,true);
  assert.equal(resumed.welcome.snapshot.players.white.y,simulation.state.players.white.safeY);
  await guest.wait("room", (p) => !p.paused);
  resumed.send("close");
  await guest.wait("closed");
  resumed.ws.close();
  const recreated = await post("/api/rooms", {
    clientToken: hostToken,
    resume: made.credentials,
  });
  assert.notEqual(recreated.room.code, made.room.code);
  assert.equal(recreated.save.chapterId, "ch03");
  assert.equal(recreated.save.world.enemyDefeated, true);
  const finalHost = await socket(recreated.room.code, hostToken);
  finalHost.send("close");
  await finalHost.wait("closed");
  finalHost.ws.close();
  console.log(
    "PASS: actual local HTTP + two WebSockets: room/ready/start, sprint/jump input, authoritative airborne height, durable ACK, host pause/reconnect, close/new-room chapter-three restore.",
  );
} finally {
  host.ws.close();
  guest.ws.close();
}
