import JSZip from "jszip";
import { getPanel } from "@/lib/panel";

async function fetchAsBuffer(url: URL): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function GET(request: Request) {
  const panel = getPanel();
  const zip = new JSZip();

  await Promise.all(
    panel.map(async (member) => {
      const bytes = await fetchAsBuffer(new URL(`/panel/vto-results/${member.id}.jpg`, request.url));
      const bandLabel = member.fitzpatrickScale ?? "unmeasured";
      zip.file(`casting-fitzpatrick-${bandLabel}-${member.id}.jpg`, bytes);
    }),
  );

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
