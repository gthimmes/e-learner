import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { PwaRegister } from "@/components/PwaRegister";
import { darken, getBrand } from "@/lib/branding";
import { getT } from "@/lib/i18n";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n-dict";
import { setLocale } from "@/lib/actions/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "e-learner", template: "%s · e-learner" },
  description: "Create online courses and take them at your own pace.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport = { themeColor: "#4f46e5" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [brand, t] = await Promise.all([getBrand(), getT()]);
  const style = { "--brand": brand.primaryColor, "--brand-dark": darken(brand.primaryColor) } as React.CSSProperties;

  return (
    <html lang={t.locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} style={style}>
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow">
          {t("nav.skip")}
        </a>
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-zinc-200 py-6 text-xs text-zinc-500 dark:border-zinc-800">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
            <span>
              {brand.orgId ? (
                <>
                  {brand.name}
                  {brand.tagline ? ` · ${brand.tagline}` : ""} · {t("brand.poweredBy")}
                </>
              ) : (
                <>e-learner · {t("footer.tagline")}</>
              )}
            </span>
            <form action={setLocale} className="flex items-center gap-1" aria-label={t("footer.language")}>
              {LOCALES.map((l) => (
                <button
                  key={l}
                  name="locale"
                  value={l}
                  className={l === t.locale ? "rounded px-2 py-1 font-semibold text-zinc-900 dark:text-zinc-100" : "rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"}
                  aria-current={l === t.locale ? "true" : undefined}
                  lang={l}
                >
                  {LOCALE_LABELS[l]}
                </button>
              ))}
            </form>
          </div>
        </footer>
        <PwaRegister />
      </body>
    </html>
  );
}
