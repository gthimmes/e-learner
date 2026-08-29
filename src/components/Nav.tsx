import Link from "next/link";
import { getCurrentUser, canAuthor, isAdmin } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { initials } from "@/lib/utils";
import { unreadCount } from "@/lib/engage";
import { getBrand } from "@/lib/branding";
import { getT } from "@/lib/i18n";

export async function Nav() {
  const [user, brand, t] = await Promise.all([getCurrentUser(), getBrand(), getT()]);
  const unread = user ? await unreadCount(user.id) : 0;
  const link = "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight" aria-label={`${brand.name} home`}>
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="h-7 w-7 rounded-md object-contain" />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-md text-sm text-white" style={{ background: "var(--brand)" }} aria-hidden>
                {brand.orgId ? brand.name.charAt(0).toUpperCase() : "e"}
              </span>
            )}
            {brand.name}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
            <Link href="/" className={link}>{t("nav.catalog")}</Link>
            <Link href="/paths" className={link}>{t("nav.paths")}</Link>
            {user ? <Link href="/learn" className={link}>{t("nav.myLearning")}</Link> : null}
            {canAuthor(user) ? <Link href="/author" className={link}>{t("nav.author")}</Link> : null}
            {user?.orgAdmin ? <Link href="/org" className={link}>{t("nav.organization")}</Link> : null}
            {canAuthor(user) ? <Link href="/settings" className={link}>{t("nav.integrations")}</Link> : null}
            {isAdmin(user) ? <Link href="/admin/users" className={link}>{t("nav.admin")}</Link> : null}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/notifications" className={`${link} relative`} aria-label={unread ? t("nav.unread", { n: unread }) : t("nav.notifications")}>
                <span aria-hidden>🔔</span>
                {unread ? <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white" aria-hidden>{unread}</span> : null}
              </Link>
              <Link href="/me" className="hidden items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:flex">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100" aria-hidden>
                  {initials(user.name)}
                </span>
                {user.name}
              </Link>
              <form action={logout}>
                <button className={link}>{t("nav.signOut")}</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={link}>{t("nav.signIn")}</Link>
              <Link href="/register" className="rounded-md px-3 py-1.5 text-sm font-medium text-white hover:brightness-110" style={{ background: "var(--brand)" }}>
                {t("nav.getStarted")}
              </Link>
            </>
          )}
        </div>
      </div>
      {user ? (
        <nav className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-2 py-1 sm:hidden dark:border-zinc-800" aria-label="Primary (mobile)">
          <Link href="/" className={link}>{t("nav.catalog")}</Link>
          <Link href="/learn" className={link}>{t("nav.myLearning")}</Link>
          {canAuthor(user) ? <Link href="/author" className={link}>{t("nav.author")}</Link> : null}
          {isAdmin(user) ? <Link href="/admin/users" className={link}>{t("nav.admin")}</Link> : null}
        </nav>
      ) : null}
    </header>
  );
}
