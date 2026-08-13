import { runPanelFanout, type PanelFanoutResult } from "@/lib/youcam/fanout";
import { getPanel } from "@/lib/panel";
import { dailyCap, isOverDailyCap, liveRunsRemaining, recordLiveRun } from "@/lib/rate-limit";

// The real fan-out call: ~28s measured wall-clock across 8 parallel Apparel
// VTO calls (see panel/vto-latency-report.json). Must outlive Vercel's
// default function timeout, hence the explicit maxDuration below.
export const maxDuration = 60;

// A single-pixel PNG — deliberately too small for the API to detect a face.
// Used only when testFailurePanelId is set, to exercise the real error path
// (not a mocked one) for one member without touching the other seven.
const INVALID_TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function fetchAsBuffer(url: URL): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

type StreamMessage =
  | { type: "progress"; result: PanelFanoutResult }
  | { type: "done"; wallClockMs: number; results: PanelFanoutResult[] }
  | { type: "capped"; message: string }
  | { type: "fatal"; error: string };

export async function POST(request: Request) {
  const startedAt = Date.now();
  const body = (await request.json().catch(() => null)) as {
    productImageBase64?: string;
    contentType?: string;
    testFailurePanelId?: string;
  } | null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (message: StreamMessage) => controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));

      // Soft daily budget guard — see lib/rate-limit.ts for the honest
      // limitations of this counter. When it trips, no YouCam call is made
      // at all: the client falls back to the precomputed seed run instead
      // of ever showing a broken or empty page.
      if (isOverDailyCap()) {
        send({
          type: "capped",
          message: `Live API budget for today is exhausted (cap: ${dailyCap()} runs/day). Showing a precomputed run instead.`,
        });
        controller.close();
        return;
      }

      try {
        const panelIds = getPanel().map((m) => m.id);

        let productBytes: Buffer;
        let productContentType = "image/png";
        if (body?.productImageBase64) {
          productBytes = Buffer.from(body.productImageBase64, "base64");
          productContentType = body.contentType ?? "image/png";
        } else {
          productBytes = await fetchAsBuffer(new URL("/panel/product-images/demo-product-tshirt.png", request.url));
        }

        const panelMembers = await Promise.all(
          panelIds.map(async (id) => ({
            panelId: id,
            bodyImageBytes:
              id === body?.testFailurePanelId
                ? Buffer.from(INVALID_TEST_IMAGE_BASE64, "base64")
                : await fetchAsBuffer(new URL(`/panel/body-images/${id}.png`, request.url)),
          })),
        );

        recordLiveRun();
        const results = await runPanelFanout(productBytes, productContentType, panelMembers, "upper_body", (result) =>
          send({ type: "progress", result }),
        );

        send({ type: "done", wallClockMs: Date.now() - startedAt, results });
      } catch (err) {
        // Any real failure (including credit exhaustion the soft counter
        // didn't catch in time) is reported as a typed fatal message, never
        // a raw 500 — the client is responsible for falling back to the
        // seed run on receiving this, per the "never a broken page" rule.
        send({ type: "fatal", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return Response.json({ liveRunsRemainingToday: liveRunsRemaining(), dailyCap: dailyCap() });
}
