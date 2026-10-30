import type {
  AdventureCredentials,
  AdventureSave,
  DogRole,
  JsonObject,
  SaveReceipt,
} from "./save.js";
export const PROTOCOL_VERSION = 13 as const;
export const MAX_MESSAGE_BYTES = 230_000;
export const MAX_SNAPSHOT_BYTES = 150_000;
export interface PlayerView {
  clientId: string;
  role: DogRole | null;
  ready: boolean;
  connected: boolean;
}
export interface RoomView {
  mode?: import('./modes').RoomMode;
  code: string;
  adventureId: string;
  hostId: string;
  players: PlayerView[];
  started: boolean;
  paused: boolean;
}
export type ClientMessage =
  | { v: typeof PROTOCOL_VERSION; seq: number; kind: "hello"; payload: { clientToken: string } }
  | { v: typeof PROTOCOL_VERSION; seq: number; kind: "role"; payload: { role: DogRole } }
  | { v: typeof PROTOCOL_VERSION; seq: number; kind: "ready"; payload: { ready: boolean } }
  | { v: typeof PROTOCOL_VERSION; seq: number; kind: "presence"; payload: { active: boolean } }
  | {
      v: typeof PROTOCOL_VERSION;
      seq: number;
      kind: "start" | "close" | "ping";
      payload?: JsonObject;
    }
  | { v: typeof PROTOCOL_VERSION; seq: number; kind: "input"; payload: { input: JsonObject } }
  | { v: typeof PROTOCOL_VERSION; seq: number; kind: "snapshot"; payload: { snapshot: JsonObject } }
  | {
      v: typeof PROTOCOL_VERSION;
      seq: number;
      kind: "save";
      payload: {
        save: AdventureSave;
        expectedRevision: number;
        requestId: string;
      };
    };
export interface WelcomePayload {
  clientId: string;
  room: RoomView;
  credentials: AdventureCredentials;
  save: AdventureSave;
  snapshot: JsonObject | null;
}
export interface InputPayload {
  clientId: string;
  role: DogRole;
  input: JsonObject;
}
export type ServerMessage = {
  v: typeof PROTOCOL_VERSION;
  seq: number;
  kind:
    | "welcome"
    | "room"
    | "started"
    | "input"
    | "snapshot"
    | "saved"
    | "error"
    | "closed"
    | "pong";
  payload: unknown;
};
export interface CreateRoomResponse {
  room: RoomView;
  credentials: AdventureCredentials;
  save: AdventureSave;
}
export interface ErrorPayload {
  code: string;
  message: string;
  requestId?: string;
}
export type {
  AdventureCredentials,
  AdventureSave,
  DogRole,
  JsonObject,
  SaveReceipt,
};
