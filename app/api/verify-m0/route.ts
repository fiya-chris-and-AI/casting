import { NextResponse } from "next/server";
import { analyzeSkin } from "@/lib/youcam/endpoints";
import { YouCamApiError } from "@/lib/youcam/client";

// M0 verification only — proves the real S2S auth + task/poll flow against
// AI Skin Analysis. Not part of the demo path.
const SAMPLE_IMAGE_URL =
  "https://plugins-media.makeupar.com/strapi/assets/skin_analysis_01_5b5defd339.png";

export async function GET() {
  try {
    const result = await analyzeSkin({ src_file_url: SAMPLE_IMAGE_URL });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), details: err instanceof YouCamApiError ? err.body : undefined },
      { status: 500 },
    );
  }
}
