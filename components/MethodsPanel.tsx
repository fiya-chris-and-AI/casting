"use client";

import { LOW_CONTRAST_DELTA_L_THRESHOLD } from "@/lib/coverage";
import { useT } from "@/lib/i18n/LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";

function useEndpoints() {
  const t = useT();
  return [
    { path: "/s2s/v2.1/task/skin-analysis", name: t("methods.endpoint.skinAnalysis.name"), use: t("methods.endpoint.skinAnalysis.use") },
    { path: "/s2s/v2.0/task/fitzpatrick-scale-analyzer", name: t("methods.endpoint.fitzpatrick.name"), use: t("methods.endpoint.fitzpatrick.use") },
    { path: "/s2s/v2.0/task/skin-tone-analysis", name: t("methods.endpoint.colorTones.name"), use: t("methods.endpoint.colorTones.use") },
    { path: "/s2s/v2.0/task/cloth-v4", name: t("methods.endpoint.vto.name"), use: t("methods.endpoint.vto.use") },
  ];
}

export function MethodsPanel() {
  const t = useT();
  const endpoints = useEndpoints();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-sm leading-relaxed">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">{t("methods.title")}</h1>
        <LanguageSwitcher />
      </div>
      <p className="mb-6 text-[var(--muted)]">{t("methods.intro")}</p>

      <h2 className="mb-2 font-medium">{t("methods.endpointsHeading")}</h2>
      <ul className="mb-6 space-y-2">
        {endpoints.map((e) => (
          <li key={e.path}>
            <div className="font-mono text-xs text-[var(--muted)]">{e.path}</div>
            <div>
              <span className="font-medium">{e.name}</span> — {e.use}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 font-medium">{t("methods.sampleHeading")}</h2>
      <p className="mb-2">
        {t("methods.sampleP1Lead")} <strong>{t("methods.sampleP1Measured")}</strong>
        {t("methods.sampleP1Mid")}{" "}
        <strong className="text-[color:var(--gap-accent)]">{t("methods.sampleP1Gap")}</strong> {t("methods.sampleP1Tail")}
      </p>
      <p className="mb-6">
        <strong>{t("methods.sampleP2Bold")}</strong> {t("methods.sampleP2Tail")}
      </p>

      <h2 className="mb-2 font-medium">{t("methods.provenanceHeading")}</h2>
      <p className="mb-6">{t("methods.provenanceBody")}</p>

      <h2 className="mb-2 font-medium">{t("methods.thresholdHeading")}</h2>
      <p className="mb-2">
        {t("methods.thresholdP1Lead")} <strong>{t("methods.thresholdP1Bold")}</strong> {t("methods.thresholdP1Tail")}
      </p>
      <p className="mb-6">
        {t("methods.thresholdP2Lead")}{" "}
        <strong>{t("methods.thresholdP2Bold", { threshold: LOW_CONTRAST_DELTA_L_THRESHOLD })}</strong> {t("methods.thresholdP2Mid")}{" "}
        {t("methods.thresholdRationale")} {t("methods.thresholdP2Tail")}
      </p>

      <h2 className="mb-2 font-medium">{t("methods.garmentHeading")}</h2>
      <p className="mb-6">{t("methods.garmentBody")}</p>

      <h2 className="mb-2 font-medium">{t("methods.limitsHeading")}</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>{t("methods.limit1")}</li>
        <li>{t("methods.limit2")}</li>
        <li>{t("methods.limit3")}</li>
      </ul>
    </div>
  );
}
