"use client";

import { useState } from "react";
import type { PanelMember } from "@/lib/panel";
import { vtoResultPath } from "@/lib/panel";
import type { MemberDiagnosis } from "@/lib/coverage";

interface CoverageBoardProps {
  panel: PanelMember[];
  diagnosisByPanelId: Record<string, MemberDiagnosis>;
  /** ms between each tile's fill-in — the staggered reveal is the demo's core beat */
  staggerMs?: number;
}

export function CoverageBoard({ panel, diagnosisByPanelId, staggerMs = 950 }: CoverageBoardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? diagnosisByPanelId[selectedId] : null;

  return (
    <div className="relative h-full w-full">
      <div
        className="grid h-full w-full gap-px"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          backgroundColor: "var(--background)",
        }}
      >
        {panel.map((member, index) => {
          const diagnosis = diagnosisByPanelId[member.id];
          const isGap = diagnosis?.lowContrast ?? false;
          return (
            <figure
              key={member.id}
              className="relative m-0 h-full w-full min-h-0 cursor-pointer overflow-hidden bg-[var(--surface)]"
              style={{
                opacity: 0,
                animation: `tile-fill-in 0.6s ease-out forwards`,
                animationDelay: `${index * staggerMs}ms`,
                boxShadow: isGap ? "inset 0 -4px 0 0 var(--gap-accent)" : undefined,
              }}
              onClick={() => setSelectedId(member.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={vtoResultPath(member.id)}
                alt={`Product on a reference person, Fitzpatrick skin type ${member.fitzpatrickScale ?? "unmeasured"}`}
                className="h-full w-full object-cover object-top"
              />
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
