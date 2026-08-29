"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n-dict";
import { formStr } from "@/lib/validation";

/** Footer language switcher (v2.1): stores the locale in a cookie for a year. */
export async function setLocale(formData: FormData) {
  const locale = formStr(formData, "locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
  revalidatePath("/", "layout");
}
