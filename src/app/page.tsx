import Link from "next/link";
import { getCatalogTags, getPublishedPaths, searchCourses } from "@/lib/discovery";
import { getCurrentUser, canAuthor } from "@/lib/auth";
import { formatMoney } from "@/lib/payments";
import { CourseCard } from "@/components/CourseCard";
import { Badge, EmptyState, LinkButton, PageHeader, Alert, Input, Select } from "@/components/ui";
import { CATALOG_SORTS, CATALOG_SORT_LABELS, COURSE_LEVELS, COURSE_LEVEL_LABELS } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import { getT } from "@/lib/i18n";

type Search = { denied?: string; q?: string; tag?: string; level?: string; sort?: string };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, user, t] = await Promise.all([searchParams, getCurrentUser(), getT()]);
  const [{ courses, query }, tags, paths] = await Promise.all([searchCourses(user, sp), getCatalogTags(user), getPublishedPaths(user)]);
  const filtering = !!(query.q || query.tag || query.level);

  const tagHref = (tag: string) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.level) p.set("level", query.level);
    if (query.sort !== "newest") p.set("sort", query.sort);
    if (tag && tag !== query.tag) p.set("tag", tag);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {sp.denied ? (
        <div className="mb-6">
          <Alert>{t("catalog.denied")}</Alert>
        </div>
      ) : null}
      <PageHeader
        title={t("catalog.title")}
        subtitle={t("catalog.subtitle")}
        actions={canAuthor(user) ? <LinkButton href="/author/new">{t("catalog.create")}</LinkButton> : null}
      />

      {paths.length > 0 && !filtering ? (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{t("catalog.paths")}</h2>
            <Link href="/paths" className="text-sm text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
              {t("catalog.allPaths")}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paths.slice(0, 3).map((p) => (
              <Link
                key={p.id}
                href={`/paths/${p.slug}`}
                className="group rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-indigo-900 dark:from-indigo-950/40 dark:to-zinc-900"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-indigo-600">Path · {p.stats.courseCount} course{p.stats.courseCount === 1 ? "" : "s"}</div>
                <div className="mt-1 font-semibold group-hover:text-indigo-600">{p.title}</div>
                {p.summary ? <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{p.summary}</p> : null}
                <div className="mt-2 text-xs text-zinc-500">
                  {p.stats.lessonCount} lessons · {formatDuration(p.stats.durationMin)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <form method="get" action="/" className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <Input name="q" type="search" defaultValue={query.q} placeholder={t("catalog.searchPlaceholder")} aria-label={t("catalog.searchLabel")} className="sm:max-w-sm" />
        {query.tag ? <input type="hidden" name="tag" value={query.tag} /> : null}
        <Select name="level" defaultValue={query.level || "ALL"} aria-label={t("catalog.level")}>
          {COURSE_LEVELS.map((l) => (
            <option key={l} value={l}>
              {COURSE_LEVEL_LABELS[l]}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={query.sort} aria-label={t("catalog.sort")}>
          {CATALOG_SORTS.map((s) => (
            <option key={s} value={s}>
              {CATALOG_SORT_LABELS[s]}
            </option>
          ))}
        </Select>
        <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
          {t("catalog.search")}
        </button>
        {filtering ? (
          <Link href="/" className="self-center px-2 text-sm text-zinc-500 hover:underline">
            {t("catalog.clear")}
          </Link>
        ) : null}
      </form>

      {tags.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter by tag">
          {tags.map(({ tag, count }) => (
            <Link
              key={tag}
              href={tagHref(tag)}
              className={
                tag === query.tag
                  ? "rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:border-indigo-400 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-300"
              }
            >
              #{tag} <span className="opacity-60">{count}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {filtering ? (
        <p className="mb-4 text-sm text-zinc-500">
          {courses.length} course{courses.length === 1 ? "" : "s"}
          {query.q ? <> matching &ldquo;{query.q}&rdquo;</> : null}
          {query.tag ? <> tagged #{query.tag}</> : null}
        </p>
      ) : null}

      {courses.length === 0 ? (
        <EmptyState
          title={filtering ? t("catalog.noMatch") : t("catalog.empty")}
          body={
            filtering
              ? t("catalog.noMatchBody")
              : canAuthor(user)
                ? "Create your first course and publish it to see it here."
                : user
                  ? "Check back soon — instructors are still writing."
                  : "Sign in or create an account to get started."
          }
          action={
            filtering ? (
              <LinkButton href="/" variant="secondary">
                {t("catalog.clearFilters")}
              </LinkButton>
            ) : canAuthor(user) ? (
              <LinkButton href="/author/new">{t("catalog.create")}</LinkButton>
            ) : !user ? (
              <LinkButton href="/register">{t("nav.getStarted")}</LinkButton>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              href={`/courses/${c.slug}`}
              title={c.title}
              summary={c.summary}
              coverUrl={c.coverUrl}
              instructor={c.instructor.name}
              lessonCount={c.stats.lessonCount}
              durationMin={c.stats.durationMin}
              rating={c.rating}
              tags={c.tagList}
              level={c.level}
              featured={c.featured}
              priceLabel={c.priceCents > 0 ? formatMoney(c.priceCents, c.currency) : undefined}
              footer={c.organization ? <Badge tone="info">🔒 {c.organization.name} only</Badge> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
