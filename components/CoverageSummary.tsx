"use client";

import Link from "next/link";
import type { CoverageReport } from "@/lib/coverage";
import { useT } from "@/lib/i18n/LocaleProvider";
import { andJoin } from "@/lib/i18n/translate";

export function CoverageSummary({
  report,
  liveAccessLabel,
  onOpenLiveAccess,
}: {
  report: CoverageReport;
  liveAccessLabel?: string;
  onOpenLiveAccess?: () => void;
}) {
  const t = useT();
  const and = t("common.and");

  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--muted)]">
      <span>
        {t("coverage.measured", { bands: andJoin(report.measurableBands, and) })}
        {report.unmeasurableBands.length > 0 && ` ${t("coverage.notMeasurable", { bands: andJoin(report.unmeasurableBands, and) })}`}
      </span>
      <span className="flex items-center gap-3">
        {onOpenLiveAccess && (
          <button type="button" onClick={onOpenLiveAccess} className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]">
            {liveAccessLabel ?? t("toolbar.liveAccessLabelDefault")}
          </button>
        )}
        {report.lowContrastBands.length > 0 && (
          <span className="text-[color:var(--gap-accent)]">● {t("coverage.lowContrastAt", { bands: report.lowContrastBands.join(", ") })}</span>
        )}
        <a href="/api/export/zip" className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]">
          {t("coverage.exportZip")}
        </a>
        <Link href="/report" className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]">
          {t("coverage.report")}
        </Link>
        <Link href="/methods" className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]">
          {t("coverage.howWeMeasure")}
        </Link>
      </span>
    </div>
  );
}
