import { getPanel } from "@/lib/panel";
import { computeCoverage } from "@/lib/coverage";
import { CoverageBoard } from "@/components/CoverageBoard";
import { CoverageSummary } from "@/components/CoverageSummary";

export default function Home() {
  const panel = getPanel();
  const coverage = computeCoverage(panel);
  const diagnosisByPanelId = Object.fromEntries(coverage.perMember.map((d) => [d.panelId, d]));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <CoverageSummary report={coverage} />
      <div className="min-h-0 flex-1">
        <CoverageBoard panel={panel} diagnosisByPanelId={diagnosisByPanelId} />
      </div>
    </div>
  );
}
