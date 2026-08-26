import { db } from "@/lib/db";
import { deleteComment, postComment } from "@/lib/actions/comments";
import type { SessionUser } from "@/lib/auth";
import { formatDate, initials } from "@/lib/utils";
import { Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";

type CommentRow = { id: string; body: string; createdAt: Date; deletedAt: Date | null; parentId: string | null; user: { id: string; name: string } };

/** Per-lesson discussion thread with one level of replies (LEARN-13). */
export async function Discussion({
  lessonId,
  user,
  canPost,
  isModerator,
}: {
  lessonId: string;
  user: SessionUser;
  canPost: boolean;
  isModerator: boolean;
}) {
  const comments: CommentRow[] = await db.comment.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });
  const top = comments.filter((c) => !c.parentId);
  const replies = new Map<string, CommentRow[]>();
  for (const c of comments) if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
  const visibleCount = comments.filter((c) => !c.deletedAt).length;

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="discussion-heading">
      <h2 id="discussion-heading" className="text-lg font-semibold">
        Discussion {visibleCount ? <span className="text-sm font-normal text-zinc-500">· {visibleCount}</span> : null}
      </h2>

      {top.length === 0 ? <p className="mt-2 text-sm text-zinc-500">No comments yet. Ask a question or share a takeaway.</p> : null}

      <ul className="mt-4 space-y-5">
        {top.map((c) => (
          <li key={c.id}>
            <CommentView c={c} user={user} isModerator={isModerator} />
            {(replies.get(c.id) ?? []).length ? (
              <ul className="mt-3 space-y-3 border-l-2 border-zinc-100 pl-4 dark:border-zinc-800">
                {replies.get(c.id)!.map((r) => (
                  <li key={r.id}>
                    <CommentView c={r} user={user} isModerator={isModerator} />
                  </li>
                ))}
              </ul>
            ) : null}
            {canPost && !c.deletedAt ? (
              <details className="mt-2 pl-10">
                <summary className="cursor-pointer text-xs text-indigo-600 hover:underline">Reply</summary>
                <form action={postComment} className="mt-2 space-y-2">
                  <input type="hidden" name="lessonId" value={lessonId} />
                  <input type="hidden" name="parentId" value={c.id} />
                  <Textarea name="body" rows={2} required maxLength={5000} placeholder="Write a reply…" />
                  <SubmitButton size="sm" variant="secondary" pendingText="Posting…">
                    Post reply
                  </SubmitButton>
                </form>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      {canPost ? (
        <form action={postComment} className="mt-6 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <input type="hidden" name="lessonId" value={lessonId} />
          <label htmlFor="comment-body" className="text-sm font-medium">
            Add a comment
          </label>
          <Textarea id="comment-body" name="body" rows={3} required maxLength={5000} placeholder="Ask a question about this lesson…" />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingText="Posting…">
              Post comment
            </SubmitButton>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">Enroll in the course to join the discussion.</p>
      )}
    </section>
  );
}

function CommentView({ c, user, isModerator }: { c: CommentRow; user: SessionUser; isModerator: boolean }) {
  const mayDelete = !c.deletedAt && (c.user.id === user.id || isModerator);
  return (
    <div className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100" aria-hidden>
        {initials(c.user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.user.name}</span>
          <span>{formatDate(c.createdAt)}</span>
          {mayDelete ? (
            <form action={deleteComment} className="ml-auto">
              <input type="hidden" name="commentId" value={c.id} />
              <button className="text-xs text-zinc-400 hover:text-red-600">Delete</button>
            </form>
          ) : null}
        </div>
        {c.deletedAt ? <p className="mt-1 text-sm italic text-zinc-400">Comment removed.</p> : <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>}
      </div>
    </div>
  );
}
