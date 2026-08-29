import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/engage";
import { markAllNotificationsRead } from "@/lib/actions/engage";
import { SubmitButton } from "@/components/SubmitButton";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

function timeAgo(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const items = await getNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread ? (
            <form action={markAllNotificationsRead}>
              <SubmitButton variant="secondary" size="sm" pendingText="Marking…">
                Mark all read
              </SubmitButton>
            </form>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Announcements from your courses, badges you earn and grades will show up here." />
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {items.map((n) => {
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={n.readAt ? "text-zinc-700 dark:text-zinc-300" : "font-semibold"}>{n.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{timeAgo(n.createdAt)}</span>
                </div>
                {n.body ? <p className="mt-1 line-clamp-3 text-sm text-zinc-500">{n.body}</p> : null}
              </>
            );
            return (
              <li key={n.id} className={`px-4 py-3 ${n.readAt ? "" : "bg-indigo-50/50 dark:bg-indigo-950/20"}`}>
                {n.href ? (
                  <Link href={n.href} className="block hover:underline">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
