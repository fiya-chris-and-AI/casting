"use client";

import { useEffect, useState } from "react";
import type { PanelFanoutResult } from "@/lib/youcam/fanout";

type LiveState = "idle" | "running" | "done" | "fatal";

interface LiveFanoutRunProps {
  panelIds: string[];
  /** Deliberately fails one member's real API call to prove the run survives it. Debug/verification only. */
  testFailurePanelId?: string;
}

export function LiveFanoutRun({ panelIds, testFailurePanelId }: LiveFanoutRunProps) {
  const [state, setState] = useState<LiveState>("idle");
  const [byId, setById] = useState<Record<string, PanelFanoutResult>>({});
  const [wallClockMs, setWallClockMs] = useState<number | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState("running");
      const res = await fetch("/api/fanout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testFailurePanelId ? { testFailurePanelId } : {}),
      });

      if (!res.body) {
        setFatalError("No response body (stream unsupported)");
        setState("fatal");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!cancelled) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line) as
            | { type: "progress"; result: PanelFanoutResult }
            | { type: "done"; wallClockMs: number; results: PanelFanoutResult[] }
            | { type: "fatal"; error: string };

          if (message.type === "progress") {
            setById((prev) => ({ ...prev, [message.result.panelId]: message.result }));
          } else if (message.type === "done") {
            setWallClockMs(message.wallClockMs);
            setState("done");
          } else if (message.type === "fatal") {
            setFatalError(message.error);
            setState("fatal");
          }
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const succeeded = Object.values(byId).filter((r) => r.status === "success").length;
  const failed = Object.values(byId).filter((r) => r.status === "error").length;
  const settled = succeeded + failed;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--muted)]">
        <span>
          Live fan-out: {settled} of {panelIds.length} settled
          {state === "done" && ` — ${succeeded} of ${panelIds.length} measured`}
          {wallClockMs !== null && ` · ${(wallClockMs / 1000).toFixed(1)}s`}
        </span>
        {failed > 0 && <span className="text-[color:var(--gap-accent)]">● {failed} failed, run continued</span>}
        {fatalError && <span className="text-[color:var(--gap-accent)]">fatal: {fatalError}</span>}
      </div>
      <div
        className="grid min-h-0 flex-1 gap-px"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 1fr)", backgroundColor: "var(--background)" }}
      >
        {panelIds.map((id) => {
          const result = byId[id];
          return (
            <figure key={id} className="relative m-0 flex h-full w-full min-h-0 items-center justify-center overflow-hidden bg-[var(--surface)]">
              {!result && <span className="text-xs text-[var(--muted)]">pending…</span>}
              {result?.status === "success" && result.resultImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.resultImageUrl} alt={`Live VTO result for ${id}`} className="h-full w-full object-cover object-top" />
              )}
              {result?.status === "error" && (
                <div className="p-3 text-center text-xs text-[color:var(--gap-accent)]">
                  <div className="font-medium">{id}</div>
                  <div className="mt-1 opacity-80">{result.error}</div>
                </div>
              )}
              <figcaption className="absolute bottom-0 left-0 right-0 px-3 py-1 text-[10px] text-white/90" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)" }}>
                {id}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
