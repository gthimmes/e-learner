import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, negotiateLocale, translate, type Locale } from "./i18n-dict";

export const LOCALE_COOKIE = "el_locale";

/** Cookie wins, then Accept-Language, then English. Cached per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return negotiateLocale((await headers()).get("accept-language"));
});

/** `const t = await getT(); t("catalog.title")` */
export async function getT() {
  const locale = await getLocale();
  return Object.assign((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), { locale });
}
