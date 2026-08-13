import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { getPanel } from "@/lib/panel";

// Reads the bundled images directly off disk instead of self-fetching them
// over HTTP from within this same serverless function — the previous
// self-fetch pattern was the suspected cause of intermittent 503s in
// production. Direct fs reads have no network round-trip to fail.
// next.config.ts's outputFileTracingIncludes guarantees these files are
// actually bundled into the deployed function.
export async function GET() {
  const panel = getPanel();
  const zip = new JSZip();

  for (const member of panel) {
    const filePath = path.join(process.cwd(), "public", "panel", "vto-results", `${member.id}.jpg`);
    const bytes = fs.readFileSync(filePath);
    const bandLabel = member.fitzpatrickScale ?? "unmeasured";
    zip.file(`casting-fitzpatrick-${bandLabel}-${member.id}.jpg`, bytes);
  }

  zip.file(
    "README.txt",
    [
      "CASTING — PDP image set export",
      `Generated ${new Date().toISOString()}`,
      "",
      "8 images, one per measured reference panel member, sorted by Fitzpatrick band.",
      "Reference panel: AI-generated (Gemini 3.1 Flash Image), fictional people — not real individuals.",
      "Full methodology: /methods on the deployed app.",
    ].join("\n"),
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="casting-pdp-image-set.zip"',
    },
  });
}
