import { Readable } from "node:stream";
import { storage } from "@/lib/storage";

/**
 * GET /api/media/<key> — streams an uploaded object with HTTP Range support so
 * <video>/<audio> can seek. Uploaded media is readable by anyone with the URL
 * (keys are unguessable); tighten to enrolled-users-only if courses become paid.
 */
export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (key.includes("..")) return new Response("Bad request", { status: 400 });

  const meta = await storage.stat(key);
  if (!meta) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": meta.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), meta.size - 1) : meta.size - 1;
      if (start >= meta.size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${meta.size}` } });
      }
      headers["Content-Range"] = `bytes ${start}-${end}/${meta.size}`;
      headers["Content-Length"] = String(end - start + 1);
      const stream = Readable.toWeb(storage.stream(key, start, end)) as ReadableStream;
      return new Response(stream, { status: 206, headers });
    }
  }

  headers["Content-Length"] = String(meta.size);
  const stream = Readable.toWeb(storage.stream(key)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
}
