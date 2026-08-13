import { LiveFanoutRun } from "@/components/LiveFanoutRun";
import { getPanel } from "@/lib/panel";

// Verification-only route (UNSICHTBAR): proves the fan-out survives a real
// per-member failure without aborting the run, and reports reduced n. Not
// part of the demo path — the demo path's live run lives at `/`.
// ?fail=<panel-id> forces one real API error.
export default async function LivePage({ searchParams }: { searchParams: Promise<{ fail?: string }> }) {
  const { fail } = await searchParams;
  const panelIds = getPanel().map((m) => m.id);
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <LiveFanoutRun panelIds={panelIds} testFailurePanelId={fail} />
    </div>
  );
}
