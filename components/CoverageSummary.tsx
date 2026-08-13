import Link from "next/link";
import type { CoverageReport } from "@/lib/coverage";

// "and"-joined list, matching the demo script's mandated phrasing exactly
// (e.g. "I, III, IV and VI") — never "I to VI", never "all six types".
function andJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function CoverageSummary({ report }: { report: CoverageReport }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--muted)]">
      <span>
        Eight people, measured — Fitzpatrick {andJoin(report.measurableBands)}.
        {report.unmeasurableBands.length > 0 &&
          ` Fitzpatrick ${andJoin(report.unmeasurableBands)} not measurable with this panel.`}
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
