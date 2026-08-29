import { Card, LinkButton } from "@/components/ui";

export const metadata = { title: "Offline" };

/** Shown by the service worker when a lesson has not been opened before and the network is down. */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Card className="p-10">
        <div className="text-5xl">📴</div>
        <h1 className="mt-4 text-2xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 text-zinc-500">Lessons you have already opened are available without a connection. This page isn&apos;t cached yet — reconnect and try again.</p>
        <div className="mt-6">
          <LinkButton href="/learn" variant="secondary">
            My Learning
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
