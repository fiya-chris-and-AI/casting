import { THRESHOLD_RATIONALE, LOW_CONTRAST_DELTA_L_THRESHOLD } from "@/lib/coverage";

const ENDPOINTS = [
  { name: "AI Skin Analysis", path: "/s2s/v2.1/task/skin-analysis", use: "Used to establish this is a genuine, distinct face per panel member (baseline skin-condition scores)." },
  { name: "AI Fitzpatrick Skin Type Analyzer", path: "/s2s/v2.0/task/fitzpatrick-scale-analyzer", use: "Measures each panel member's Fitzpatrick band (I-VI). This is the band shown on every tile — measured, not assigned." },
  { name: "AI Facial Color Tones Analyzer", path: "/s2s/v2.0/task/skin-tone-analysis", use: "Measures each panel member's skin color as a hex value — the reference color the garment's contrast is checked against." },
  { name: "AI Clothes Virtual Try-On", path: "/s2s/v2.0/task/cloth-v4", use: "Renders the actual product on each panel member. This is the image in every tile." },
];

export function MethodsPanel() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-sm leading-relaxed">
      <h1 className="mb-1 text-lg font-medium">How we measure</h1>
      <p className="mb-6 text-[var(--muted)]">
        Every claim on this page traces back to a real API response. Where we made a judgment call instead of
        measuring, it&rsquo;s named below.
      </p>

      <h2 className="mb-2 font-medium">YouCam endpoints used</h2>
      <ul className="mb-6 space-y-2">
        {ENDPOINTS.map((e) => (
          <li key={e.path}>
            <div className="font-mono text-xs text-[var(--muted)]">{e.path}</div>
            <div>
              <span className="font-medium">{e.name}</span> — {e.use}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 font-medium">Sample</h2>
      <p className="mb-6">
        Eight reference people, one per tile. <strong>Eight people are a sample, not a population</strong> — this
        product measures whether a colorway separates from these eight measured skin tones, not what any population
        of customers looks like. We say this here so nobody has to ask.
      </p>

      <h2 className="mb-2 font-medium">Panel image provenance</h2>
      <p className="mb-6">
        All eight reference images are AI-generated (Gemini 3.1 Flash Image) — fictional people, not real
        individuals, not photographs of anyone. We chose this over sourcing real photos to avoid a likeness/consent
        problem entirely rather than manage one. Marked <code>[GEMOCKT/KURATIERT]</code> in the build brief.
      </p>

      <h2 className="mb-2 font-medium">Contrast diagnosis: how the threshold was chosen</h2>
      <p className="mb-2">
        The lead metric is <strong>ΔL*</strong> — the CIELAB luminance difference between the garment color and a
        panel member&rsquo;s measured skin tone. CIEDE2000 (ΔE) is shown alongside as a secondary, supporting
        number; the &ldquo;loses contrast&rdquo; claim is driven by ΔL*, not ΔE, because luminance separation is
        what the eye reads as an edge between garment and skin — hue or chroma difference alone doesn&rsquo;t
        guarantee that.
      </p>
      <p className="mb-6">
        We call anything below <strong>ΔL* {LOW_CONTRAST_DELTA_L_THRESHOLD}</strong> low contrast. {THRESHOLD_RATIONALE}{" "}
        We are not citing an external standard (WCAG, ISO, or otherwise) — this is our own operational cutoff for
        this product, and we&rsquo;re not asserting it as anything else.
      </p>

      <h2 className="mb-2 font-medium">Garment color</h2>
      <p className="mb-6">
        Sampled by averaging a center crop of the clean, unworn product photo — not the composite try-on images,
        where background and each person&rsquo;s own lighting would bias the reading.
      </p>

      <h2 className="mb-2 font-medium">Limits of this measurement</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Eight measured people; not a population estimate, not a demographic claim.</li>
        <li>The panel&rsquo;s measured Fitzpatrick coverage is uneven by construction, not by design intent — see the panel data&rsquo;s own coverage note.</li>
        <li>A garment&rsquo;s real-world contrast depends on lighting, fabric, and photography — this measurement is a comparative signal, not a guarantee of how the product will look on set.</li>
      </ul>
    </div>
  );
}
