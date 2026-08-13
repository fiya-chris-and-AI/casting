import Link from "next/link";
import type { CoverageReport } from "@/lib/coverage";

export function CoverageSummary({ report }: { report: CoverageReport }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--muted)]">
      <span>
        Coverage: {report.measurableBands.length} of 6 Fitzpatrick bands measurable with this panel
        {report.measurableBands.length > 0 && ` (${report.measurableBands.join(", ")})`}
        {report.unmeasurableBands.length > 0 && ` — not measurable: ${report.unmeasurableBands.join(", ")}`}
      </span>
      <span className="flex items-center gap-3">
        {report.lowContrastBands.length > 0 && (
          <span className="text-[color:var(--gap-accent)]">● low contrast at {report.lowContrastBands.join(", ")}</span>
        )}
        <a href="/api/export/zip" className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]">
          Export image set (ZIP)
        </a>
        <Link href="/report" className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]">
          Coverage report
        </Link>
        <Link href="/methods" className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]">
          How we measure
        </Link>
      </span>
    </div>
  );
}
