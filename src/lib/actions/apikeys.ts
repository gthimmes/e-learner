"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor } from "@/lib/auth";
import { generateApiKey } from "@/lib/apikeys";
import { formStr } from "@/lib/validation";

export type ApiKeyState = { error?: string; plaintext?: string; name?: string };

/** Creates a key and returns the plaintext once (it is never stored). */
export async function createApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const user = await actionAuthor();
  const name = formStr(formData, "name").trim().slice(0, 60) || "API key";
  const count = await db.apiKey.count({ where: { userId: user.id, revokedAt: null } });
  if (count >= 10) return { error: "You already have 10 active keys. Revoke one first." };
  const { plaintext } = await generateApiKey(user.id, name);
  revalidatePath("/settings");
  return { plaintext, name };
}

export async function revokeApiKey(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "keyId");
  await db.apiKey.updateMany({ where: { id, userId: user.id }, data: { revokedAt: new Date() } });
  revalidatePath("/settings");
}
