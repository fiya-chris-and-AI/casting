"use client";

import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
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

// Live runs spend real YouCam units — gated behind a short access code (or
// a juror's own YouCam API key) so a stray link can't drain the
// judging-window budget (see lib/rate-limit.ts, the second line of defense
// behind this one). Session-scoped so a juror only enters it once.
// Server-side truth lives in LIVE_ACCESS_CODE; these keys only cache what
// the user already proved works. Only one credential is ever stored at a
// time — confirming one clears the other, so "the active mode" is unambiguous.
const ACCESS_CODE_STORAGE_KEY = "casting-live-access-code";
const API_KEY_STORAGE_KEY = "casting-live-api-key";
const ACCESS_CODE_HEADER = "x-live-access-code";
const API_KEY_HEADER = "x-youcam-api-key";

type LiveAuth = { kind: "code"; value: string } | { kind: "key"; value: string };

function getStoredAuth(): LiveAuth | null {
  if (typeof window === "undefined") return null;
  const key = sessionStorage.getItem(API_KEY_STORAGE_KEY);
  if (key) return { kind: "key", value: key };
  const code = sessionStorage.getItem(ACCESS_CODE_STORAGE_KEY);
  if (code) return { kind: "code", value: code };
  return null;
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
  const [liveAccessPopoverOpen, setLiveAccessPopoverOpen] = useState(false);
  const [activeAuthMode, setActiveAuthMode] = useState<"code" | "key" | null>(() => getStoredAuth()?.kind ?? null);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [budgetCappedHint, setBudgetCappedHint] = useState(false);
  // Below ~1100px the right link group would wrap; shorten the "Live runs"
  // label instead of letting it break onto a second line.
  const [isNarrowLinkGroup, setIsNarrowLinkGroup] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1099px)");
    const update = () => setIsNarrowLinkGroup(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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
    const auth = getStoredAuth();
    if (auth) {
      if (action === "upload") fileInputRef.current?.click();
      else startRun(null, auth);
      return;
    }
    setAccessError(null);
    setApiKeyError(null);
    setPendingLiveAction(action);
    setLiveAccessPopoverOpen(true);
  }

  function openLiveAccessPopover(action: "upload" | "demo" | null = null) {
    setAccessError(null);
    setApiKeyError(null);
    setPendingLiveAction(action);
    setLiveAccessPopoverOpen(true);
  }

  function closeLiveAccessPopover() {
    setLiveAccessPopoverOpen(false);
    setPendingLiveAction(null);
    setAccessError(null);
    setApiKeyError(null);
  }

  function runOrClosePopover(auth: LiveAuth) {
    const action = pendingLiveAction;
    setPendingLiveAction(null);
    setLiveAccessPopoverOpen(false);
    if (action === "upload") fileInputRef.current?.click();
    else if (action === "demo") startRun(null, auth);
  }

  function confirmAccessCode() {
    const code = accessCodeInput.trim();
    if (!code) return;
    sessionStorage.setItem(ACCESS_CODE_STORAGE_KEY, code);
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    setActiveAuthMode("code");
    setAccessCodeInput("");
    setAccessError(null);
    runOrClosePopover({ kind: "code", value: code });
  }

  function confirmApiKey() {
    const key = apiKeyInput.trim();
    if (!key) return;
    sessionStorage.setItem(API_KEY_STORAGE_KEY, key);
    sessionStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
    setActiveAuthMode("key");
    setApiKeyInput("");
    setApiKeyError(null);
    runOrClosePopover({ kind: "key", value: key });
  }

  async function startRun(file: File | null, auth: LiveAuth) {
    setHasRevealedOnce(true);
    setMode("running");
    setLiveResults({});
    setFallbackNotice(null);
    setBudgetCappedHint(false);

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
        headers: {
          "Content-Type": "application/json",
          [auth.kind === "code" ? ACCESS_CODE_HEADER : API_KEY_HEADER]: auth.value,
        },
        body: JSON.stringify(productImageBase64 ? { productImageBase64, contentType } : {}),
      });

      if (res.status === 401) {
        if (auth.kind === "code") {
          sessionStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
          setAccessError("That access code didn't work. Jurors: check the Devpost testing instructions.");
        } else {
          sessionStorage.removeItem(API_KEY_STORAGE_KEY);
          setApiKeyError("Perfect Corp rejected this key.");
        }
        setActiveAuthMode(null);
        setMode("seed");
        setPendingLiveAction(file ? "upload" : "demo");
        setLiveAccessPopoverOpen(true);
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
            fallBackToSeed(message.message, { budgetCapped: auth.kind !== "key" });
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

  function fallBackToSeed(message: string, opts?: { budgetCapped?: boolean }) {
    setFallbackNotice(message);
    setBudgetCappedHint(!!opts?.budgetCapped);
    setMode("capped");
  }

  const isLive = mode === "running" || mode === "live-done";
  const showingCoverage = isLive ? liveCoverage : seedCoverage;
  const diagnosisByPanelId = isLive ? liveDiagnosisByPanelId : seedDiagnosisByPanelId;
  const selected = selectedId ? diagnosisByPanelId[selectedId] : null;

  const liveAccessLabel =
    activeAuthMode === "key"
      ? "Live runs · own key"
      : activeAuthMode === "code"
        ? "Live runs · access code"
        : isNarrowLinkGroup
          ? "Live runs — code or own key"
          : "Live runs — access code or your own YouCam key";

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="grid grid-cols-1 items-center gap-2 px-4 py-2 text-xs min-[900px]:grid-cols-3">
        <Link
          href="/"
          aria-label="CASTING — home"
          className="flex h-8 items-center gap-2.5 justify-self-start min-[900px]:col-start-2 min-[900px]:justify-self-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/casting-mark-light.svg" alt="" aria-hidden className="h-[13px] w-auto" />
          <span className="font-semibold" style={{ fontSize: 14, letterSpacing: "0.15em", color: "#111111" }}>
            CASTING
          </span>
        </Link>

        <div className="flex items-center gap-3 min-[900px]:col-start-1">
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
              const auth = getStoredAuth();
              if (file && auth) startRun(file, auth);
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

        {fallbackNotice && (
          <span
            className="justify-self-start text-[color:var(--gap-accent)] min-[900px]:col-start-3 min-[900px]:justify-self-end min-[900px]:text-right"
          >
            {fallbackNotice}
            {budgetCappedHint && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => openLiveAccessPopover("demo")}
                  className="underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]"
                >
                  …or run it on your own YouCam API key
                </button>
              </>
            )}
          </span>
        )}
      </div>

      {liveAccessPopoverOpen && (
        <div className="absolute right-4 top-10 z-20 w-80 rounded-md border border-[var(--muted)] bg-[var(--surface)] p-3 text-xs shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-[var(--foreground)]">Live runs</span>
            <button type="button" onClick={closeLiveAccessPopover} className="text-[var(--muted)] hover:text-[var(--foreground)]">
              close
            </button>
          </div>

          <form
            className="mb-3 flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              confirmAccessCode();
            }}
          >
            <span className="font-medium text-[var(--foreground)]">Use CASTING&apos;s budget</span>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="password"
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value)}
                placeholder="access code"
                className="min-w-0 flex-1 rounded border border-[var(--muted)] bg-transparent px-2 py-1 text-[var(--foreground)] outline-none"
              />
              <button
                type="submit"
                disabled={!accessCodeInput.trim()}
                className="rounded border border-[var(--muted)] px-2 py-1 text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
            <span className="text-[var(--muted)]">
              Jurors: the code is in the Devpost testing instructions. Live runs spend real API units; the app caps them per day.
            </span>
            {accessError && <span className="text-[var(--muted)]">{accessError}</span>}
          </form>

          <form
            className="flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              confirmApiKey();
            }}
          >
            <span className="font-medium text-[var(--foreground)]">Use your own YouCam API key</span>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="API key"
                className="min-w-0 flex-1 rounded border border-[var(--muted)] bg-transparent px-2 py-1 text-[var(--foreground)] outline-none"
              />
              <button
                type="submit"
                disabled={!apiKeyInput.trim()}
                className="rounded border border-[var(--muted)] px-2 py-1 text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
            <span className="text-[var(--muted)]">
              Sent with each run straight to Perfect Corp through our server. Never stored, never logged; kept only in this
              browser tab.
            </span>
            {apiKeyError && <span className="text-[var(--muted)]">{apiKeyError}</span>}
          </form>
        </div>
      )}

      {showingCoverage && (
        <CoverageSummary report={showingCoverage} liveAccessLabel={liveAccessLabel} onOpenLiveAccess={() => openLiveAccessPopover()} />
      )}

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
