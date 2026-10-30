import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { resolve } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { FileStore } from "./file-store.js";
import { RoomHub, GameError } from "./core.js";
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from "../shared/protocol.js";
const port = Number(process.env.PORT || 8787);
const hub = new RoomHub(
  new FileStore(resolve(process.env.SAVE_DIR || ".game-data")),
);
await hub.init();
async function body(req: IncomingMessage) {
  let result = "";
  for await (const chunk of req) {
    result += chunk.toString();
    if (Buffer.byteLength(result) > MAX_MESSAGE_BYTES)
      throw new GameError("SIZE", "请求过大");
  }
  try {
    return JSON.parse(result || "{}");
  } catch {
    throw new GameError("FORMAT", "请求数据损坏");
  }
}
function reply(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
function allowedOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const permitted = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .filter(Boolean);
    return (
      url.host === req.headers.host ||
      ((url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        ["5173", "4173", String(port)].includes(url.port)) ||
      permitted.includes(origin)
    );
  } catch {
    return false;
  }
}
const server = createServer(async (req, res) => {
  try {
    if (!allowedOrigin(req)) throw new GameError("ORIGIN", "连接来源不被允许");
    const path = new URL(req.url!, "http://localhost").pathname;
    if (path === "/api/health" && req.method === "GET") {
      reply(res, 200, { ok: true, protocol: PROTOCOL_VERSION, persistence: "atomic-file" });
      return;
    }
    if (req.method !== "POST") {
      reply(res, 404, { code: "NOT_FOUND", message: "请求不存在" });
      return;
    }
    const data = await body(req);
    const result = await hub.exclusive(async () => {
      if (path === "/api/rooms")
        return hub.create(data.clientToken, data.resume, data.mode);
      if (path === "/api/join")
        return hub.join(String(data.code || ""), data.clientToken);
      if (path === "/api/adventures/load")
        return { save: (await hub.authorize(data.credentials)).save };
      if (path === "/api/adventures/restore")
        return { save: await hub.restore(data.credentials, data.save) };
      throw new GameError("NOT_FOUND", "请求不存在");
    });
    reply(res, 200, result);
  } catch (e) {
    reply(res, e instanceof GameError ? 400 : 503, {
      code: e instanceof GameError ? e.code : "UNAVAILABLE",
      message: e instanceof GameError ? e.message : "存档服务暂时不可用",
    });
  }
});
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_MESSAGE_BYTES,
});
const alive = new WeakMap<WebSocket, boolean>();
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 10000);
server.on("close", () => clearInterval(heartbeat));
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url!, "http://localhost");
  if (
    url.pathname !== "/ws" ||
    !allowedOrigin(req) ||
    !/^[A-F0-9]{6}$/.test(url.searchParams.get("room") || "")
  ) {
    socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    alive.set(ws, true);
    ws.on("pong", () => alive.set(ws, true));
    const session = hub.connect(url.searchParams.get("room")!, {
      send: (message) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
      },
      close: (code, reason) => ws.close(code, reason),
    });
    const helloTimer = setTimeout(() => ws.close(4002, "连接认证超时"), 15000);
    ws.on("message", (data, binary) => {
      if (binary) {
        ws.close(1003, "仅支持文本消息");
        return;
      }
      clearTimeout(helloTimer);
      void hub.receive(session, data.toString());
    });
    ws.on("close", () => {
      clearTimeout(helloTimer);
      void hub.disconnect(session);
    });
    ws.on("error", () => {});
  });
});
server.listen(port, process.env.HOST || "0.0.0.0", () =>
  console.log(`Two Tails联机服务 http://localhost:${port} （本地，未部署云端）`),
);
