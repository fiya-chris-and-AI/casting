"use client";

import { useRef, useState } from "react";
import type { PanelMember } from "@/lib/panel";
import { getSeedRevealDelayMs, vtoResultPath } from "@/lib/panel";
import { computeCoverage, type CoverageReport, type MemberDiagnosis } from "@/lib/coverage";
import { extractDominantColorFromFile, fileToBase64 } from "@/lib/client-color";
import type { PanelFanoutResult } from "@/lib/youcam/fanout";
import { CoverageSummary } from "./CoverageSummary";

interface CastingAppProps {
  panel: PanelMember[];
  seedDiagnosisByPanelId: Record<string, MemberDiagnosis>;
  seedCoverage: CoverageReport;
}

type Mode = "seed" | "running" | "live-done" | "capped";

type LiveResultsById = Record<string, PanelFanoutResult>;

export function CastingApp({ panel, seedDiagnosisByPanelId, seedCoverage }: CastingAppProps) {
  const [mode, setMode] = useState<Mode>("seed");
  const [liveResults, setLiveResults] = useState<LiveResultsById>({});
  const [liveDiagnosisByPanelId, setLiveDiagnosisByPanelId] = useState<Record<string, MemberDiagnosis>>({});
  const [liveCoverage, setLiveCoverage] = useState<CoverageReport | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The staggered fade-in is the dramatic first-load "Oh!" moment — it must
  // never replay when falling back to seed after a failed/capped live run,
  // or every tile resets to opacity:0 and waits out its delay again (up to
  // 28s), landing on a blank grid right when the fallback notice appears.
  const [hasRevealedOnce, setHasRevealedOnce] = useState(false);

  async function startRun(file: File | null) {
    setHasRevealedOnce(true);
    setMode("running");
    setLiveResults({});
    setFallbackNotice(null);

    let productImageBase64: string | undefined;
    let contentType = "image/png";
    let garmentHex = seedCoverage.garmentColorHex;

    if (file) {
      try {
        [productImageBase64, garmentHex] = await Promise.all([fileToBase64(file), extractDominantColorFromFile(file)]);
        contentType = file.type || "image/png";
      } catch {
        // Color extraction or file reading failed client-side — fall back to
        // the known demo garment color rather than blocking the run.
        garmentHex = seedCoverage.garmentColorHex;
      }
    }

    const coverage = computeCoverage(panel, garmentHex);
    setLiveDiagnosisByPanelId(Object.fromEntries(coverage.perMember.map((d) => [d.panelId, d])));
    setLiveCoverage(coverage);

    try {
      const res = await fetch("/api/fanout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productImageBase64 ? { productImageBase64, contentType } : {}),
      });

      if (!res.ok || !res.body) {
        fallBackToSeed("Live run couldn't start. Showing a precomputed run instead.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line) as
            | { type: "progress"; result: PanelFanoutResult }
            | { type: "done" }
            | { type: "capped"; message: string }
            | { type: "fatal"; error: string };

          if (message.type === "progress") {
            setLiveResults((prev) => ({ ...prev, [message.result.panelId]: message.result }));
          } else if (message.type === "done") {
            setMode("live-done");
          } else if (message.type === "capped") {
            fallBackToSeed(message.message);
            return;
          } else if (message.type === "fatal") {
            fallBackToSeed("Live run hit an error. Showing a precomputed run instead.");
            return;
          }
        }
      }
    } catch {
      fallBackToSeed("Network error during the live run. Showing a precomputed run instead.");
    }
  }

  function fallBackToSeed(message: string) {
    setFallbackNotice(message);
    setMode("capped");
  }

  const isLive = mode === "running" || mode === "live-done";
  const showingCoverage = isLive ? liveCoverage : seedCoverage;
  const diagnosisByPanelId = isLive ? liveDiagnosisByPanelId : seedDiagnosisByPanelId;
  const selected = selectedId ? diagnosisByPanelId[selectedId] : null;

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex items-center justify-between gap-4 px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={mode === "running"}
            className="rounded border border-[var(--muted)] px-2 py-1 text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
          >
            Upload a product photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) startRun(file);
            }}
          />
          <button
            onClick={() => startRun(null)}
            disabled={mode === "running"}
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)] disabled:opacity-50"
          >
            {mode === "running" ? "Running…" : "Run live with the demo product"}
          </button>
        </div>
        {fallbackNotice && <span className="text-[color:var(--gap-accent)]">{fallbackNotice}</span>}
      </div>

      {showingCoverage && <CoverageSummary report={showingCoverage} />}

      <div
        className="grid min-h-0 flex-1 gap-px"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 1fr)", backgroundColor: "var(--background)" }}
      >
        {panel.map((member, index) => {
          const diagnosis = diagnosisByPanelId[member.id];
          const isGap = diagnosis?.lowContrast ?? false;
          const live = liveResults[member.id];

          let imageSrc: string | null;
          let statusLabel: string | null = null;
          if (isLive) {
            imageSrc = live?.status === "success" ? live.resultImageUrl : null;
            if (!live) statusLabel = "pending…";
            if (live?.status === "error") statusLabel = live.error;
          } else {
            imageSrc = vtoResultPath(member.id);
          }

          return (
            <figure
              key={member.id}
              className="relative m-0 flex h-full w-full min-h-0 cursor-pointer items-center justify-center overflow-hidden bg-[var(--surface)]"
              style={
                !isLive && !hasRevealedOnce
                  ? { opacity: 0, animation: "tile-fill-in 0.6s ease-out forwards", animationDelay: `${getSeedRevealDelayMs(member.id)}ms`, boxShadow: isGap ? "inset 0 -4px 0 0 var(--gap-accent)" : undefined }
                  : { boxShadow: isGap ? "inset 0 -4px 0 0 var(--gap-accent)" : undefined }
              }
              onClick={() => diagnosis && setSelectedId(member.id)}
            >
              {imageSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageSrc} alt={`Product on a reference person, Fitzpatrick ${member.fitzpatrickScale ?? "unmeasured"}`} className="h-full w-full object-cover object-top" />
              )}
              {!imageSrc && statusLabel && <span className="px-3 text-center text-xs text-[var(--muted)]">{statusLabel}</span>}
              <figcaption
                className="absolute bottom-0 left-0 right-0 flex items-baseline justify-between px-3 py-2 text-xs text-white/90"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)" }}
              >
                <span className="font-medium tracking-wide">
                  Fitzpatrick {member.fitzpatrickScale ?? "—"}
                  {isGap && <span className="ml-1 text-[color:var(--gap-accent)]">● low contrast</span>}
                </span>
                <span className="font-mono opacity-80">{member.skinColorHex}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {selected && (
        <div
          className="absolute bottom-6 left-1/2 z-10 w-[min(90vw,32rem)] -translate-x-1/2 rounded-md bg-[var(--surface)] p-4 text-sm shadow-lg"
          onClick={() => setSelectedId(null)}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium">Fitzpatrick {selected.band}</span>
            <span className="font-mono text-[var(--muted)]">{selected.skinColorHex}</span>
          </div>
          <p className="text-[var(--muted)]">{selected.plainLanguage}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            ΔL* {selected.deltaL.toFixed(1)} (primary) · ΔE2000 {selected.deltaE2000.toFixed(1)} (secondary)
          </p>
        </div>
      )}
    </div>
  );
}
