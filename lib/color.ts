import { converter, differenceCiede2000, parse } from "culori";

const toLab = converter("lab");

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

export function hexToLab(hex: string): LabColor {
  const parsed = parse(hex);
  if (!parsed) throw new Error(`Could not parse color: ${hex}`);
  const lab = toLab(parsed);
  return { l: lab.l ?? 0, a: lab.a ?? 0, b: lab.b ?? 0 };
}

/** Absolute L* (luminance) difference — the primary contrast-legibility metric. */
export function deltaL(a: LabColor, b: LabColor): number {
  return Math.abs(a.l - b.l);
}

/** CIEDE2000 total color difference — secondary/supporting metric, not the lead claim. */
export function deltaE2000(hexA: string, hexB: string): number {
  const diff = differenceCiede2000();
  return diff(hexA, hexB);
}
