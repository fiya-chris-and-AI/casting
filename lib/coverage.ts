import { deltaE2000, deltaL, hexToLab } from "./color";
import type { PanelMember } from "./panel";
import garmentColorData from "@/panel/garment-color.json";

export const ALL_FITZPATRICK_BANDS = ["I", "II", "III", "IV", "V", "VI"] as const;
export type FitzpatrickBand = (typeof ALL_FITZPATRICK_BANDS)[number];

/**
 * Operational threshold, not a cited external standard: below this ΔL*, we
 * call the garment "low luminance separation" against that skin tone — the
 * product photo relies on the eye reading garment-vs-skin edges, and edge
 * legibility tracks luminance contrast far more than hue or chroma difference.
 * Disclosed here and in the Methods Panel; not attributed to any WCAG/ISO
 * figure we have not read.
 */
export const LOW_CONTRAST_DELTA_L_THRESHOLD = 15;
export const THRESHOLD_RATIONALE =
  "We call a pairing \"low luminance separation\" below ΔL* 15 — a threshold we set for this product, not a cited external standard. Below it, in our own viewing of the rendered images, the garment silhouette starts reading as a value-match to the skin rather than a distinct shape.";

export const GARMENT_COLOR_HEX = garmentColorData.hex;

export interface MemberDiagnosis {
  panelId: string;
  band: FitzpatrickBand;
  skinColorHex: string;
  garmentColorHex: string;
  deltaL: number;
  deltaE2000: number;
  lowContrast: boolean;
  plainLanguage: string;
}

export interface CoverageReport {
  garmentColorHex: string;
  measurableBands: FitzpatrickBand[];
  unmeasurableBands: FitzpatrickBand[];
  perMember: MemberDiagnosis[];
  coverageScore: number; // measurable bands / 6, as a percentage — never counts unmeasurable bands as covered
  lowContrastBands: FitzpatrickBand[];
}

function diagnoseMember(member: PanelMember, garmentHex: string): MemberDiagnosis | null {
  if (!member.fitzpatrickScale || !member.skinColorHex) return null;

  const skinLab = hexToLab(member.skinColorHex);
  const garmentLab = hexToLab(garmentHex);
  const dl = deltaL(skinLab, garmentLab);
  const de = deltaE2000(member.skinColorHex, garmentHex);
  const lowContrast = dl < LOW_CONTRAST_DELTA_L_THRESHOLD;

  const plainLanguage = lowContrast
    ? `On Fitzpatrick ${member.fitzpatrickScale} (measured skin tone ${member.skinColorHex}), this colorway has a luminance difference of only ΔL* ${dl.toFixed(1)} — low separation, the garment risks reading as a value-match to the skin rather than a distinct shape (ΔE2000 ${de.toFixed(1)}).`
    : `On Fitzpatrick ${member.fitzpatrickScale} (measured skin tone ${member.skinColorHex}), this colorway separates clearly from the skin at ΔL* ${dl.toFixed(1)} (ΔE2000 ${de.toFixed(1)}).`;

  return {
    panelId: member.id,
    band: member.fitzpatrickScale,
    skinColorHex: member.skinColorHex,
    garmentColorHex: garmentHex,
    deltaL: dl,
    deltaE2000: de,
    lowContrast,
    plainLanguage,
  };
}

export function computeCoverage(panel: PanelMember[], garmentHex: string = GARMENT_COLOR_HEX): CoverageReport {
  const perMember = panel
    .map((m) => diagnoseMember(m, garmentHex))
    .filter((d): d is MemberDiagnosis => d !== null);

  const measurableBands = ALL_FITZPATRICK_BANDS.filter((band) => perMember.some((d) => d.band === band));
  const unmeasurableBands = ALL_FITZPATRICK_BANDS.filter((band) => !measurableBands.includes(band));
  const lowContrastBands = Array.from(new Set(perMember.filter((d) => d.lowContrast).map((d) => d.band)));

  return {
    garmentColorHex: garmentHex,
    measurableBands,
    unmeasurableBands,
    perMember,
    coverageScore: Math.round((measurableBands.length / ALL_FITZPATRICK_BANDS.length) * 100),
    lowContrastBands,
  };
}
