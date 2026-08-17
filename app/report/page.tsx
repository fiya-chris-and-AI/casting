"use client";

import { getPanel } from "@/lib/panel";
import { computeCoverage, LOW_CONTRAST_DELTA_L_THRESHOLD } from "@/lib/coverage";
import { vtoResultPath } from "@/lib/panel";
import { useT } from "@/lib/i18n/LocaleProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function ReportPage() {
  const t = useT();
  const panel = getPanel();
  const coverage = computeCoverage(panel);
  const generatedAt = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[8.5in] bg-white p-10 text-black print:p-6">
      <header className="mb-6 flex items-baseline justify-between border-b border-black/20 pb-3">
        <h1 className="text-xl font-semibold">{t("report.title")}</h1>
        <span className="flex items-center gap-3 text-xs text-black/60">
          {t("report.generated", { date: generatedAt })}
          <LanguageSwitcher className="underline decoration-dotted underline-offset-2 bg-transparent text-black/60 hover:text-black" />
        </span>
      </header>

      <section className="mb-6">
        <p className="text-sm">
          <strong>
            {coverage.measurableBands.length} {t("report.measurableOf6")}
          </strong>{" "}
          {t("report.measurableBandsBody", { bands: coverage.measurableBands.join(", ") || "none" })}
          {coverage.unmeasurableBands.length > 0 && ` ${t("report.notMeasurableWithPanel", { bands: coverage.unmeasurableBands.join(", ") })}`}
        </p>
        {coverage.lowContrastBands.length > 0 && (
          <p className="mt-1 text-sm">
            {t("report.lowLuminanceAt", { threshold: LOW_CONTRAST_DELTA_L_THRESHOLD })} <strong>{coverage.lowContrastBands.join(", ")}</strong>.
          </p>
        )}
      </section>

      <section className="mb-6 grid grid-cols-4 gap-2">
        {panel.map((member) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={member.id}
            src={vtoResultPath(member.id)}
            alt={`Fitzpatrick ${member.fitzpatrickScale}`}
            className="aspect-[3/4] w-full object-cover object-top"
          />
        ))}
      </section>

      <section className="mb-6">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-black/30 text-left">
              <th className="py-1 pr-2">{t("report.tableHeaderPanelId")}</th>
              <th className="py-1 pr-2">{t("report.tableHeaderFitzpatrick")}</th>
              <th className="py-1 pr-2">{t("report.tableHeaderSkinColor")}</th>
              <th className="py-1 pr-2">{t("report.tableHeaderDeltaL")}</th>
              <th className="py-1 pr-2">{t("report.tableHeaderDeltaE")}</th>
              <th className="py-1">{t("report.tableHeaderDiagnosis")}</th>
            </tr>
          </thead>
          <tbody>
            {coverage.perMember.map((d) => (
              <tr key={d.panelId} className="border-b border-black/10">
                <td className="py-1 pr-2 font-mono">{d.panelId}</td>
                <td className="py-1 pr-2">{d.band}</td>
                <td className="py-1 pr-2 font-mono">{d.skinColorHex}</td>
                <td className="py-1 pr-2">{d.deltaL.toFixed(1)}</td>
                <td className="py-1 pr-2">{d.deltaE2000.toFixed(1)}</td>
                <td className="py-1">{d.lowContrast ? t("report.diagnosisLowContrast") : t("report.diagnosisClearSeparation")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="text-[11px] leading-relaxed text-black/70">
        <p>{t("report.footnote")}</p>
      </section>
    </div>
  );
}
