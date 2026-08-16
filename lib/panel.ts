import panelDataRaw from "@/panel/panel-data.json";

export interface PanelMember {
  id: string;
  intendedBand: string;
  ageRange: string;
  gender: string;
  imageProvenance: string;
  measuredAt: string;
  fitzpatrickScale: "I" | "II" | "III" | "IV" | "V" | "VI" | null;
  skinColorHex: string | null;
  eyeColorHex: string | null;
  lipColorHex: string | null;
  hairColorHex: string | null;
  faceQuality: unknown;
  skinTypeScore: { rawScore: number; uiScore: number } | null;
  measuredViaAccount?: string;
  error?: string;
}

const BAND_RANK: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

export function getPanel(): PanelMember[] {
  const panel = (panelDataRaw as unknown as { panel: PanelMember[] }).panel;
  return [...panel].sort((a, b) => (BAND_RANK[a.fitzpatrickScale ?? ""] ?? 99) - (BAND_RANK[b.fitzpatrickScale ?? ""] ?? 99));
}

export function getPanelCoverageNote(): string | undefined {
  return (panelDataRaw as { coverageNote?: string }).coverageNote;
}

export function vtoResultPath(id: string): string {
  return `/panel/vto-results/${id}.jpg`;
}

const SEED_REVEAL_STEP_MS = 140;
const BOARD_ORDER: string[] = getPanel().map((m) => m.id);

/**
 * Seed run reveal is a fast stagger (the "one image becomes eight" gesture);
 * real per-person latency is only shown on live runs.
 */
export function getSeedRevealDelayMs(panelId: string): number {
  const index = BOARD_ORDER.indexOf(panelId);
  return index === -1 ? 0 : index * SEED_REVEAL_STEP_MS;
}
