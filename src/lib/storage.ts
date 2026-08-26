import "server-only";
import { promises as fs, createReadStream, type ReadStream } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Storage adapter boundary. Local disk in development; implement the same interface
 * against S3 (put/statFile/stream → signed URL redirect) for production.
 */
export interface StoredObject {
  size: number;
  contentType: string;
}

export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  stat(key: string): Promise<StoredObject | null>;
  /** Stream a byte range (inclusive) of the object. */
  stream(key: string, start?: number, end?: number): ReadStream;
  delete(key: string): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".zip": "application/zip",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function contentTypeFor(key: string) {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

class LocalStorage implements StorageAdapter {
  constructor(private root: string) {}

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    const rootAbs = path.resolve(this.root);
    if (!full.startsWith(rootAbs + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async stat(key: string) {
    try {
      const s = await fs.stat(this.resolve(key));
      if (!s.isFile()) return null;
      return { size: s.size, contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }

  stream(key: string, start?: number, end?: number) {
    return createReadStream(this.resolve(key), start !== undefined ? { start, end } : undefined);
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

export const storage: StorageAdapter = new LocalStorage(process.env.UPLOAD_DIR || "./uploads");

/** Builds a collision-free, path-safe key like `2026/08/ab12cd34-my-video.mp4`. */
export function makeStorageKey(originalName: string) {
  const ext = path.extname(originalName).toLowerCase().slice(0, 10);
  const base = path
    .basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "file";
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}/${randomBytes(6).toString("hex")}-${base}${ext}`;
}

export const mediaUrlFor = (key: string) => `/api/media/${key}`;
