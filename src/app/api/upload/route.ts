import { NextResponse } from "next/server";
import { getCurrentUser, canAuthor } from "@/lib/auth";
import { ALLOWED_UPLOAD_TYPES } from "@/lib/constants";
import { makeStorageKey, mediaUrlFor, storage } from "@/lib/storage";

const ALL_ALLOWED = new Set(Object.values(ALLOWED_UPLOAD_TYPES).flat());

/** POST multipart/form-data { file } → { url, key, contentType, size } (AUTHOR-5, NFR-3). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!canAuthor(user)) return NextResponse.json({ error: "Instructor access required." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const maxMb = Number(process.env.MAX_UPLOAD_MB || 200);
  if (file.size > maxMb * 1024 * 1024) {
    return NextResponse.json({ error: `File exceeds the ${maxMb} MB limit.` }, { status: 413 });
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALL_ALLOWED.has(contentType)) {
    return NextResponse.json({ error: `Unsupported file type: ${contentType}` }, { status: 415 });
  }

  const key = makeStorageKey(file.name || "upload");
  await storage.put(key, Buffer.from(await file.arrayBuffer()), contentType);
  return NextResponse.json({ url: mediaUrlFor(key), key, contentType, size: file.size });
}
