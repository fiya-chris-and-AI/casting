import { NextResponse } from "next/server";
import { runPanelFanout } from "@/lib/youcam/fanout";

// The real fan-out call: ~28s measured wall-clock across 8 parallel Apparel
// VTO calls (see panel/vto-latency-report.json). Must outlive Vercel's
// default function timeout, hence the explicit maxDuration below.
export const maxDuration = 60;

const PANEL_IDS = [
  "panel-fitzpatrick-I",
  "panel-fitzpatrick-II",
  "panel-fitzpatrick-III",
  "panel-fitzpatrick-III-b",
  "panel-fitzpatrick-IV",
  "panel-fitzpatrick-V",
  "panel-fitzpatrick-V-b",
  "panel-fitzpatrick-VI",
];

async function fetchAsBuffer(url: URL): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    let productBytes: Buffer;
    let productContentType = "image/png";

    const body = (await request.json().catch(() => null)) as { productImageBase64?: string; contentType?: string } | null;
    if (body?.productImageBase64) {
      productBytes = Buffer.from(body.productImageBase64, "base64");
      productContentType = body.contentType ?? "image/png";
    } else {
      productBytes = await fetchAsBuffer(new URL("/panel/product-images/demo-product-tshirt.png", request.url));
    }

    const panelMembers = await Promise.all(
      PANEL_IDS.map(async (id) => ({
        panelId: id,
        bodyImageBytes: await fetchAsBuffer(new URL(`/panel/body-images/${id}.png`, request.url)),
      })),
    );

    const results = await runPanelFanout(productBytes, productContentType, panelMembers, "upper_body");
    const wallClockMs = Date.now() - startedAt;

    return NextResponse.json({ ok: true, wallClockMs, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, wallClockMs: Date.now() - startedAt, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
