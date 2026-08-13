import { getPanel } from "@/lib/panel";
import { computeCoverage } from "@/lib/coverage";
import { vtoResultPath } from "@/lib/panel";

export default function ReportPage() {
  const panel = getPanel();
  const coverage = computeCoverage(panel);
  const generatedAt = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[8.5in] bg-white p-10 text-black print:p-6">
      <header className="mb-6 flex items-baseline justify-between border-b border-black/20 pb-3">
        <h1 className="text-xl font-semibold">CASTING — Coverage Report</h1>
        <span className="text-xs text-black/60">Generated {generatedAt}</span>
      </header>

      <section className="mb-6">
        <p className="text-sm">
          <strong>{coverage.measurableBands.length} of 6</strong> Fitzpatrick bands measurable with this 8-person
          panel: {coverage.measurableBands.join(", ") || "none"}.
          {coverage.unmeasurableBands.length > 0 && ` Not measurable with this panel: ${coverage.unmeasurableBands.join(", ")}.`}
        </p>
        {coverage.lowContrastBands.length > 0 && (
          <p className="mt-1 text-sm">
            Low luminance separation (ΔL* &lt; {15}) at: <strong>{coverage.lowContrastBands.join(", ")}</strong>.
          </p>
        )}
      </section>

      <section className="mb-6 grid grid-cols-4 gap-2">
        {panel.map((member) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={member.id}
            src={vtoResultPath(member.id)}
            alt={`Fitzpatrick ${member.fitzpatrickScale}`}
            className="aspect-[3/4] w-full object-cover object-top"
          />
        ))}
      </section>

      <section className="mb-6">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-black/30 text-left">
              <th className="py-1 pr-2">Panel ID</th>
              <th className="py-1 pr-2">Fitzpatrick</th>
              <th className="py-1 pr-2">Skin color</th>
              <th className="py-1 pr-2">ΔL* (primary)</th>
              <th className="py-1 pr-2">ΔE2000 (secondary)</th>
              <th className="py-1">Diagnosis</th>
            </tr>
          </thead>
          <tbody>
            {coverage.perMember.map((d) => (
              <tr key={d.panelId} className="border-b border-black/10">
                <td className="py-1 pr-2 font-mono">{d.panelId}</td>
                <td className="py-1 pr-2">{d.band}</td>
                <td className="py-1 pr-2 font-mono">{d.skinColorHex}</td>
                <td className="py-1 pr-2">{d.deltaL.toFixed(1)}</td>
                <td className="py-1 pr-2">{d.deltaE2000.toFixed(1)}</td>
                <td className="py-1">{d.lowContrast ? "low contrast" : "separates clearly"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="text-[11px] leading-relaxed text-black/70">
        <p>
          Eight people are a sample, not a population. Panel reference images are AI-generated (Gemini 3.1 Flash
          Image), fictional — not real individuals. ΔL* &lt; 15 is this product&rsquo;s own operational threshold for
          &ldquo;low contrast&rdquo;, not a cited external standard. Full methodology at /methods.
        </p>
      </section>
    </div>
  );
}
