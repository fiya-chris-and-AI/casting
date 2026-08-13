import { getPanel } from "@/lib/panel";
import { computeCoverage } from "@/lib/coverage";
import { CastingApp } from "@/components/CastingApp";

export default function Home() {
  const panel = getPanel();
  const seedCoverage = computeCoverage(panel);
  const seedDiagnosisByPanelId = Object.fromEntries(seedCoverage.perMember.map((d) => [d.panelId, d]));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <CastingApp panel={panel} seedDiagnosisByPanelId={seedDiagnosisByPanelId} seedCoverage={seedCoverage} />
    </div>
  );
}
