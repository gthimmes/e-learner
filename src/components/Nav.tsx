import Link from "next/link";
import { getCurrentUser, canAuthor, isAdmin } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { initials } from "@/lib/utils";

export async function Nav() {
  const user = await getCurrentUser();
  const link = "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-sm text-white">e</span>
            e-learner
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link href="/" className={link}>Catalog</Link>
            {user ? <Link href="/learn" className={link}>My Learning</Link> : null}
            {canAuthor(user) ? <Link href="/author" className={link}>Author</Link> : null}
            {user?.orgAdmin ? <Link href="/org" className={link}>Organization</Link> : null}
            {canAuthor(user) ? <Link href="/settings" className={link}>Integrations</Link> : null}
            {isAdmin(user) ? <Link href="/admin/users" className={link}>Admin</Link> : null}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 sm:flex">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                  {initials(user.name)}
                </span>
                {user.name}
              </span>
              <form action={logout}>
                <button className={link}>Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={link}>Sign in</Link>
              <Link href="/register" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
      {user ? (
        <nav className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-2 py-1 sm:hidden dark:border-zinc-800">
          <Link href="/" className={link}>Catalog</Link>
          <Link href="/learn" className={link}>My Learning</Link>
          {canAuthor(user) ? <Link href="/author" className={link}>Author</Link> : null}
          {isAdmin(user) ? <Link href="/admin/users" className={link}>Admin</Link> : null}
        </nav>
      ) : null}
    </header>
  );
}
