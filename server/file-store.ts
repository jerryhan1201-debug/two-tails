import { mkdir, open, readFile, rename, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { isId, validateSave } from "../shared/save.js";
import type { Store, StoredAdventure, StoredRoom } from "./core.js";
/** Atomic replace, fsync, and previous known-good generation. Never ACK before rename. */
export class FileStore implements Store {
  constructor(private directory: string) {}
  private path(id: string) {
    if (!isId(id)) throw new Error("Invalid storage key");
    return join(this.directory, `${id}.json`);
  }
  private async read(path: string): Promise<unknown | null> {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }
  private async write(path: string, value: unknown, preservePrevious = true) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(value));
      await file.sync();
    } finally {
      await file.close();
    }
    if (preservePrevious) {
      try {
        const previous = await this.read(path);
        if (previous && typeof previous === "object" && "save" in previous)
          validateSave((previous as StoredAdventure).save);
        await copyFile(path, `${path}.bak`);
        const backup = await open(`${path}.bak`, "r");
        await backup.sync();
        await backup.close();
      } catch (e: any) {
        if (e.code && e.code !== "ENOENT") throw e;
      }
    }
    await rename(temporary, path);
    const dir = await open(this.directory, "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  }
  async load(id: string): Promise<StoredAdventure | null> {
    const path = this.path(id);
    const check = (v: unknown): StoredAdventure | null => {
      if (v === null) return null;
      const r = v as StoredAdventure;
      if (
        !r ||
        typeof r.tokenHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(r.tokenHash) ||
        !r.receipts ||
        typeof r.receipts !== "object"
      )
        throw new Error("Corrupt save record");
      validateSave(r.save);
      if (r.save.adventureId !== id) throw new Error("Save key mismatch");
      return r;
    };
    try {
      const primary = check(await this.read(path));
      return primary ?? check(await this.read(`${path}.bak`));
    } catch (primary) {
      const backup = check(await this.read(`${path}.bak`));
      if (!backup) throw primary;
      return backup;
    }
  }
  async save(id: string, record: StoredAdventure) {
    validateSave(record.save);
    await this.write(this.path(id), record);
  }
  async loadRooms(): Promise<StoredRoom[]> {
    try {
      const rooms = await this.read(this.path("rooms"));
      return Array.isArray(rooms) ? rooms : [];
    } catch {
      return [];
    }
  }
  async saveRooms(rooms: StoredRoom[]) {
    await this.write(this.path("rooms"), rooms, false);
  }
}
