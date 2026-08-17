import { runPanelFanout, type PanelFanoutResult } from "@/lib/youcam/fanout";
import { getPanel } from "@/lib/panel";
import { checkLiveRunBudget, recordLiveRun } from "@/lib/rate-limit";
import { getYoucamCreditBalance } from "@/lib/youcam/client";

// The real fan-out call: ~28-34s measured wall-clock across 8 parallel
// Apparel VTO calls (see panel/vto-latency-report.json). Must outlive
// Vercel's default function timeout, hence the explicit maxDuration below.
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

// Live runs are open by default in local dev (LIVE_ACCESS_CODE unset); in
// deployed environments this gates the two live-run buttons behind a code
// given to jurors in the Devpost testing instructions. The daily unit
// budget in lib/rate-limit.ts remains the second line of defense.
function isLiveAccessAuthorized(request: Request): boolean {
  const requiredCode = process.env.LIVE_ACCESS_CODE;
  if (!requiredCode) return true;
  return request.headers.get("x-live-access-code") === requiredCode;
}

// A juror's own YouCam API key bypasses our access code AND our daily unit
// budget entirely — the budget only protects OUR account, and BYOK calls
// never touch it. The key is read from this one request header, used only
// for this request's VTO calls, and never persisted, logged, or echoed back
// (including inside error messages).
const API_KEY_HEADER = "x-youcam-api-key";

export async function POST(request: Request) {
  const byokKey = request.headers.get(API_KEY_HEADER)?.trim() || null;

  if (byokKey) {
    try {
      await getYoucamCreditBalance(byokKey);
    } catch {
      return Response.json({ error: "Perfect Corp rejected this key" }, { status: 401 });
    }
  } else if (!isLiveAccessAuthorized(request)) {
    return Response.json({ error: "Live runs require an access code. See the Devpost testing instructions." }, { status: 401 });
  }

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

      // Budget guard checked against the REAL YouCam account balance (see
      // lib/rate-limit.ts) before a single unit is spent. When it trips, no
      // YouCam call is made at all — the client falls back to the
      // precomputed seed run instead of ever showing a broken or empty page.
      // A juror's own key spends from THEIR account, not ours, so it skips
      // this guard entirely — YOUCAM_MAX_CALLS_PER_RUN (checked inside
      // runPanelFanout) remains the only cap on a BYOK run.
      if (!byokKey) {
        const budget = await checkLiveRunBudget();
        if (!budget.allowed) {
          send({ type: "capped", message: budget.reason ?? "Live API budget unavailable. Showing a precomputed run instead." });
          controller.close();
          return;
        }
      }

      try {
        const panelIds = getPanel().map((m) => m.id);

        let productBytes: Buffer;
        let productContentType = "image/png";
        if (body?.productImageBase64) {
          productBytes = Buffer.from(body.productImageBase64, "base64");
          productContentType = body.contentType ?? "image/png";
        } else {
          productBytes = await fetchAsBuffer(new URL("/panel/product-images/demo-product-navy-shirt.png", request.url));
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

        if (!byokKey) recordLiveRun();
        const results = await runPanelFanout(
          productBytes,
          productContentType,
          panelMembers,
          "upper_body",
          (result) => send({ type: "progress", result }),
          byokKey ?? undefined,
        );

        send({ type: "done", wallClockMs: Date.now() - startedAt, results });
      } catch (err) {
        // Any real failure (including credit exhaustion the budget check
        // didn't catch — e.g. a concurrent request draining the balance
        // between the check and the call) is reported as a typed fatal
        // message, never a raw 500 — the client always falls back to the
        // seed run on receiving this.
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
