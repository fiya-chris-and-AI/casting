"use client";

import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
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

// Live runs spend real YouCam units — gated behind a short access code so a
// stray link can't drain the judging-window budget (see lib/rate-limit.ts,
// the second line of defense behind this one). Session-scoped so a juror
// only types it once. Server-side truth lives in LIVE_ACCESS_CODE; this key
// only caches what the user already proved works.
const ACCESS_CODE_STORAGE_KEY = "casting-live-access-code";
const ACCESS_CODE_HEADER = "x-live-access-code";

function getStoredAccessCode(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ACCESS_CODE_STORAGE_KEY) ?? "";
}

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
  // A tile must never read as broken on a cold visit. Two things can leave it
  // visibly empty: the staggered reveal hasn't reached it yet (delays run up
  // to 28s — previously the whole figure sat at opacity 0, a bare white hole
  // in the grid), or the image bytes are still in flight when its turn comes
  // (observed live at t≈32s on a cold cache). So the tile FRAME (caption +
  // measured-skin-tone swatch) is visible from the first paint, and only the
  // IMAGE fades in — once its reveal delay has elapsed AND it has actually
  // decoded. Keyed by src so seed and live results track independently.
  const [loadedSrcs, setLoadedSrcs] = useState<Record<string, boolean>>({});
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [pendingLiveAction, setPendingLiveAction] = useState<"upload" | "demo" | null>(null);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);

  // Fetch all 8 seed images from the first byte of the page, in parallel with
  // the staggered reveal — not when each tile happens to mount.
  for (const member of panel) {
    ReactDOM.preload(vtoResultPath(member.id), { as: "image" });
  }

  useEffect(() => {
    // The staggered reveal follows the real measured per-person VTO latency.
    const timers = panel.map((member) =>
      setTimeout(() => setRevealedIds((prev) => ({ ...prev, [member.id]: true })), getSeedRevealDelayMs(member.id))
    );
    return () => timers.forEach(clearTimeout);
  }, [panel]);

  function markLoaded(src: string) {
    setLoadedSrcs((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
  }

  function requestLiveRun(action: "upload" | "demo") {
    const storedCode = getStoredAccessCode();
    if (storedCode) {
      if (action === "upload") fileInputRef.current?.click();
      else startRun(null, storedCode);
      return;
    }
    setAccessError(null);
    setPendingLiveAction(action);
  }

  function confirmAccessCode() {
    const code = accessCodeInput.trim();
    if (!code) return;
    sessionStorage.setItem(ACCESS_CODE_STORAGE_KEY, code);
    setAccessCodeInput("");
    const action = pendingLiveAction;
    setPendingLiveAction(null);
    if (action === "upload") fileInputRef.current?.click();
    else if (action === "demo") startRun(null, code);
  }

  async function startRun(file: File | null, accessCode: string) {
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
        headers: { "Content-Type": "application/json", [ACCESS_CODE_HEADER]: accessCode },
        body: JSON.stringify(productImageBase64 ? { productImageBase64, contentType } : {}),
      });

      if (res.status === 401) {
        sessionStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
        setMode("seed");
        setAccessError("That access code didn't work. Jurors: check the Devpost testing instructions.");
        setPendingLiveAction(file ? "upload" : "demo");
        return;
      }

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
          <span
            className="rounded px-2 py-0.5 font-medium"
            style={
              isLive
                ? { backgroundColor: "var(--gap-accent)", color: "white" }
                : { border: "1px solid var(--muted)", color: "var(--muted)" }
            }
          >
            {isLive ? "● live run — real API calls" : "precomputed demo run"}
          </span>
          <button
            onClick={() => requestLiveRun("upload")}
            disabled={mode === "running"}
            className="rounded border border-[var(--muted)] px-2 py-1 text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
          >
            Upload your own product — runs live
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) startRun(file, getStoredAccessCode());
            }}
          />
          <button
            onClick={() => requestLiveRun("demo")}
            disabled={mode === "running"}
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)] disabled:opacity-50"
          >
            {mode === "running" ? "Running…" : "Run it live with the demo product"}
          </button>
        </div>
        {fallbackNotice && <span className="text-[color:var(--gap-accent)]">{fallbackNotice}</span>}
      </div>

      {pendingLiveAction && (
        <div className="flex flex-col gap-1 px-4 pb-2 text-xs">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              confirmAccessCode();
            }}
          >
            <input
              autoFocus
              type="password"
              value={accessCodeInput}
              onChange={(e) => setAccessCodeInput(e.target.value)}
              placeholder="access code"
              className="rounded border border-[var(--muted)] bg-transparent px-2 py-1 text-[var(--foreground)] outline-none"
            />
            <button
              type="submit"
              disabled={!accessCodeInput.trim()}
              className="rounded border border-[var(--muted)] px-2 py-1 text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingLiveAction(null);
                setAccessCodeInput("");
                setAccessError(null);
              }}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              cancel
            </button>
          </form>
          <span className="text-[var(--muted)]">
            Live runs spend real API units. Jurors: the code is in the Devpost testing instructions.
          </span>
          {accessError && <span className="text-[var(--muted)]">{accessError}</span>}
        </div>
      )}

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

          const imgVisible =
            imageSrc != null && !!loadedSrcs[imageSrc] && (isLive || hasRevealedOnce || !!revealedIds[member.id]);

          return (
            <figure
              key={member.id}
              className="relative m-0 flex h-full w-full min-h-0 cursor-pointer items-center justify-center overflow-hidden bg-[var(--surface)]"
              style={{ boxShadow: isGap ? "inset 0 -4px 0 0 var(--gap-accent)" : undefined }}
              onClick={() => diagnosis && setSelectedId(member.id)}
            >
              {!imgVisible && !statusLabel && (
                // Deliberate pre-image state: the member's measured skin tone,
                // never a bare white surface.
                <span aria-hidden className="h-6 w-6 rounded-full opacity-60" style={{ backgroundColor: member.skinColorHex ?? "var(--muted)" }} />
              )}
              {imageSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  ref={(el) => {
                    // Cache hit: the image can be complete before onLoad ever fires.
                    if (el && el.complete && el.naturalWidth > 0) markLoaded(imageSrc);
                  }}
                  onLoad={() => markLoaded(imageSrc)}
                  alt={`Product on a reference person, Fitzpatrick ${member.fitzpatrickScale ?? "unmeasured"}`}
                  className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ease-out ${imgVisible ? "opacity-100" : "opacity-0"}`}
                />
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
