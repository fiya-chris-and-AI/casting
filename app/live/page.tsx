import { LiveFanoutRun } from "@/components/LiveFanoutRun";

const PANEL_IDS = [
  "panel-fitzpatrick-I",
  "panel-fitzpatrick-II",
  "panel-fitzpatrick-III",
  "panel-fitzpatrick-III-b",
  "panel-fitzpatrick-IV",
  "panel-fitzpatrick-V",
  "panel-fitzpatrick-V-b",
  "panel-fitzpatrick-VI",
];

// Verification-only route (UNSICHTBAR): proves the fan-out survives a real
// per-member failure without aborting the run, and reports reduced n. Not
// part of the demo path. ?fail=<panel-id> forces one real API error.
export default async function LivePage({ searchParams }: { searchParams: Promise<{ fail?: string }> }) {
  const { fail } = await searchParams;
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <LiveFanoutRun panelIds={PANEL_IDS} testFailurePanelId={fail} />
    </div>
  );
}
