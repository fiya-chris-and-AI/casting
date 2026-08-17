# CASTING — cast your customers

**Show your customers someone who looks like them.** CASTING takes one product photo, runs Perfect Corp's Apparel Virtual Try-On across a reference panel of eight measured skin types, and returns a coverage board — the same garment on eight people — plus a measured answer to a question no catalogue can answer today: *who does our product page never show?*

**Live app:** https://casting-ten.vercel.app · **License:** [MIT](LICENSE)

Built for the [YouCam API Skin AI & Apparel VTO Hackathon](https://youcam-api.devpost.com/) (Perfect Corp, Devpost, August 2026).

## What it does

A brand photographs its product on two models. Its customers are everyone else. CASTING is a tool for the person who runs the catalogue — a merchandiser, not a consumer. One upload, under thirty seconds:

1. The product image is tried on all eight panel members in parallel (a real API fan-out with visible per-person progress).
2. The coverage board shows the same garment on eight measured skin tones — Fitzpatrick bands labeled per tile.
3. A coverage score reports which Fitzpatrick bands this catalogue serves, and on which measured skin tones the product's colorway loses contrast (ΔL* primary, ΔE2000 secondary — deterministic color math over measured values, no model).
4. Export: a PDP-ready image set (ZIP) and a one-page coverage report.

## The four YouCam APIs (all load-bearing)

| API | What CASTING uses it for |
|---|---|
| **AI Clothes Virtual Try-On** (Fashion) | The core fan-out: puts the uploaded garment on each of the 8 panel members, 8 parallel calls per run |
| **AI Skin Analysis** (Skin) | One-time measurement of each panel member's skin profile when the panel was built |
| **AI Fitzpatrick Skin Type Analysis** (Skin) | One-time measured Fitzpatrick band per panel member — the bands on the board are measured, not assigned |
| **AI Facial Color Tones Analyzer** (Skin) | One-time measured skin tone values per member — the basis for the ΔL*/ΔE2000 contrast diagnosis |

The three Skin API measurements were run once and frozen as JSON in the repo (`panel/panel-data.json`), so a live run spends exactly 8 Virtual Try-On calls and nothing else.

## Run it locally

```bash
# 1. Get API keys: register for the event, redeem the code in the YouCam API Console,
#    create a key: https://yce.perfectcorp.com/api-console/en/api-keys/
# 2. Configure:
cp .env.example .env.local               # then paste your YOUCAM_API_KEY
# 3. Install:
npm install
# 4. Run:
npm run dev                              # → http://localhost:3000
```

No database, no accounts. Set `DEMO_MODE=true` to serve the precomputed run with zero network calls.

## Architecture (five lines)

1. **Next.js (App Router) + TypeScript** — one screen, the board gets the whole viewport; all YouCam calls go through server routes, the API key never reaches the client.
2. **`lib/youcam/`** — Bearer-auth client with upload, task polling, timeout, retry, and a per-run call cap from `.env`.
3. **`/api/fanout`** — streams the 8-person try-on as NDJSON; one failed member never aborts the run, the UI reports "7 of 8 measured" instead of silently claiming success.
4. **`lib/coverage.ts`** — deterministic CIELAB math (ΔL* leads, ΔE2000/CIEDE2000 secondary) over the frozen panel measurements; no LLM anywhere in the product.
5. **`lib/rate-limit.ts`** — a credit circuit-breaker that checks the real account balance via the YouCam credit API before every live run and reserves budget for the judging window; when the cap is reached the app visibly falls back to the precomputed run.

## Honesty — what is measured, what is curated

This product's premise is measurement integrity, so the same standard applies to itself:

- **The panel is a curated reference panel of AI-generated people**, not real customers — chosen deliberately (no rights issues, reproducible), disclosed in the app's Methods panel ("How we measure") and here.
- **Measured coverage is Fitzpatrick I, III, IV and VI.** Our generated candidates for bands II and V measured as neighboring bands, so the panel does not cover them — the app says "not measurable with this panel" and never counts them as covered. Eight people are a sample, not a population; the product says so itself.
- **"MERIDIAN GOODS"** in the comparison view is a fictional brand; its campaign photos are AI-generated and labeled as such directly in the UI.
- **The API unit budget is capped.** A live run is only allowed if the real account balance minus the reserve for the judging window covers it; otherwise the app falls back — visibly, with a notice — to the precomputed demo run. The precomputed run is labeled as such at all times.
- The ΔL* < 15 low-contrast threshold is our own working threshold, stated as such — not a cited standard.
