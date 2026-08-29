import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokeApiKey } from "@/lib/actions/apikeys";
import { deleteWebhook, retryDelivery, testWebhook, toggleWebhook } from "@/lib/actions/webhooks";
import { ApiKeyForm, WebhookForm } from "@/components/SettingsForms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Integrations" };

/** API keys and webhooks for instructors/admins (v0.9 interop). */
export default async function SettingsPage() {
  const user = await requireRole("/settings", "INSTRUCTOR", "ADMIN");
  const [keys, hooks] = await Promise.all([
    db.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.webhook.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: 8 } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Integrations"
        subtitle={
          <>
            Use the REST API with a key (<code>Authorization: Bearer elk_…</code>) — see <a href="/api/v1/openapi.json" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">/api/v1/openapi.json</a>. Webhooks receive signed JSON for course events.
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">API keys</h2>
          <Card>
            <ApiKeyForm />
          </Card>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {keys.length === 0 ? <li className="px-4 py-3 text-zinc-500">No keys yet.</li> : null}
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium">
                    {k.name} <code className="ml-1 text-xs text-zinc-500">{k.prefix}…</code>
                  </div>
                  <div className="text-xs text-zinc-500">
                    created {formatDate(k.createdAt)} · last used {k.lastUsedAt ? formatDate(k.lastUsedAt) : "never"}
                  </div>
                </div>
                {k.revokedAt ? (
                  <Badge>Revoked</Badge>
                ) : (
                  <form action={revokeApiKey}>
                    <input type="hidden" name="keyId" value={k.id} />
                    <button className="text-xs text-zinc-500 hover:text-red-600">Revoke</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <Card>
            <WebhookForm />
          </Card>
          <ul className="space-y-3">
            {hooks.length === 0 ? <li className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">No webhooks yet.</li> : null}
            {hooks.map((h) => (
              <li key={h.id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{h.url}</div>
                    <div className="text-xs text-zinc-500">
                      events: <code>{h.events}</code> · added {formatDate(h.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={h.active ? "success" : "neutral"}>{h.active ? "Active" : "Paused"}</Badge>
                    <form action={testWebhook}>
                      <input type="hidden" name="webhookId" value={h.id} />
                      <button className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800">Send test</button>
                    </form>
                    <form action={toggleWebhook}>
                      <input type="hidden" name="webhookId" value={h.id} />
                      <button className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800">{h.active ? "Pause" : "Resume"}</button>
                    </form>
                    <form action={deleteWebhook}>
                      <input type="hidden" name="webhookId" value={h.id} />
                      <button className="text-xs text-zinc-500 hover:text-red-600">Delete</button>
                    </form>
                  </div>
                </div>
                {h.deliveries.length ? (
                  <ul className="mt-2 space-y-1">
                    {h.deliveries.map((d) => {
                      const tone =
                        d.state === "DELIVERED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : d.state === "DEAD"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
                      const label = d.state === "DELIVERED" ? "Delivered" : d.state === "DEAD" ? "Dead-lettered" : d.state === "FAILED" ? "Retrying" : "Queued";
                      return (
                        <li key={d.id} className="flex flex-wrap items-center gap-2 text-[11px]" title={d.lastError || formatDate(d.createdAt)}>
                          <span className={`rounded px-1.5 py-0.5 ${tone}`}>{label}</span>
                          <span>
                            {d.event} → {d.status || "ERR"} · {d.durationMs} ms · attempt {d.attempt}
                          </span>
                          {d.state === "FAILED" && d.nextAttemptAt ? <span className="text-zinc-500">next {d.nextAttemptAt.toLocaleTimeString()}</span> : null}
                          {d.state !== "DELIVERED" ? (
                            <form action={retryDelivery}>
                              <input type="hidden" name="deliveryId" value={d.id} />
                              <button className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">Retry now</button>
                            </form>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            Each POST carries <code>X-Elearner-Event</code> and <code>X-Elearner-Signature: sha256=HMAC(secret, body)</code>. Verify the signature before trusting the payload. Failed deliveries are retried with backoff (1 m → 12 h, 6 attempts) and then dead-lettered; retry them here or via <code>/api/cron/webhooks</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
