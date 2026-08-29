import "server-only";
import { promises as fs, createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { EMPTY_SHA256, sha256Hex, signRequest } from "./s3sig";
import { log } from "./log";

/**
 * Storage adapter boundary. Local disk in development; S3-compatible object storage (AWS S3,
 * MinIO, R2, …) when `S3_BUCKET` is set. Same interface, chosen once at startup.
 */
export interface StoredObject {
  size: number;
  contentType: string;
}

export interface StorageAdapter {
  readonly kind: "local" | "s3";
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  stat(key: string): Promise<StoredObject | null>;
  /** Stream a byte range (inclusive) of the object. */
  stream(key: string, start?: number, end?: number): Promise<Readable>;
  delete(key: string): Promise<void>;
  /** Public URL to redirect to instead of proxying (CDN / public bucket); undefined = proxy through the app. */
  publicUrl?(key: string): string | undefined;
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

function assertSafeKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) throw new Error("Invalid storage key");
}

// ---------- Local disk ----------

class LocalStorage implements StorageAdapter {
  readonly kind = "local" as const;
  constructor(private root: string) {}

  private resolve(key: string) {
    assertSafeKey(key);
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

  async stream(key: string, start?: number, end?: number) {
    return createReadStream(this.resolve(key), start !== undefined ? { start, end } : undefined);
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

// ---------- S3-compatible ----------

export type S3Config = {
  bucket: string;
  region: string;
  endpoint: string; // e.g. https://s3.us-east-1.amazonaws.com or http://localhost:9000
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicUrl?: string;
};

export class S3Storage implements StorageAdapter {
  readonly kind = "s3" as const;
  constructor(private cfg: S3Config) {}

  objectUrl(key: string) {
    assertSafeKey(key);
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const base = new URL(this.cfg.endpoint);
    if (this.cfg.forcePathStyle) return new URL(`${base.origin}/${this.cfg.bucket}/${encodedKey}`);
    return new URL(`${base.protocol}//${this.cfg.bucket}.${base.host}/${encodedKey}`);
  }

  private async request(method: string, key: string, opts: { body?: Buffer; headers?: Record<string, string> } = {}) {
    const url = this.objectUrl(key);
    const payloadHash = opts.body ? sha256Hex(opts.body) : EMPTY_SHA256;
    const headers = signRequest({
      method,
      url,
      headers: opts.headers ?? {},
      payloadHash,
      accessKeyId: this.cfg.accessKeyId,
      secretAccessKey: this.cfg.secretAccessKey,
      region: this.cfg.region,
    });
    const res = await fetch(url, { method, headers, body: opts.body ? new Uint8Array(opts.body) : undefined });
    return res;
  }

  async put(key: string, data: Buffer, contentType: string) {
    const res = await this.request("PUT", key, { body: data, headers: { "content-type": contentType, "content-length": String(data.length) } });
    if (!res.ok) throw new Error(`S3 PUT failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  async stat(key: string) {
    const res = await this.request("HEAD", key);
    if (res.status === 404) return null;
    if (!res.ok) {
      log.warn("S3 HEAD failed", { key, status: res.status });
      return null;
    }
    return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") || contentTypeFor(key) };
  }

  async stream(key: string, start?: number, end?: number) {
    const headers: Record<string, string> = {};
    if (start !== undefined) headers.range = `bytes=${start}-${end ?? ""}`;
    const res = await this.request("GET", key, { headers });
    if (!res.ok || !res.body) throw new Error(`S3 GET failed: ${res.status}`);
    return Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
  }

  async delete(key: string) {
    const res = await this.request("DELETE", key);
    if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE failed: ${res.status}`);
  }

  publicUrl(key: string) {
    if (!this.cfg.publicUrl) return undefined;
    return `${this.cfg.publicUrl.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}

export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  if (!env.S3_BUCKET) return null;
  const region = env.S3_REGION || "us-east-1";
  return {
    bucket: env.S3_BUCKET,
    region,
    endpoint: env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`,
    accessKeyId: env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "1" || env.S3_FORCE_PATH_STYLE === "true",
    publicUrl: env.S3_PUBLIC_URL || undefined,
  };
}

const s3cfg = s3ConfigFromEnv();
export const storage: StorageAdapter = s3cfg ? new S3Storage(s3cfg) : new LocalStorage(process.env.UPLOAD_DIR || "./uploads");

/** Builds a collision-free, path-safe key like `2026/08/ab12cd34-my-video.mp4`. */
export function makeStorageKey(originalName: string) {
  const ext = path.extname(originalName).toLowerCase().slice(0, 10);
  const base =
    path
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
