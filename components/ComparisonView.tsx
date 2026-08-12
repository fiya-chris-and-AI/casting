import type { PanelMember } from "@/lib/panel";
import { vtoResultPath } from "@/lib/panel";

const CAMPAIGN_IMAGES = ["/panel/campaign-images/campaign-01.png", "/panel/campaign-images/campaign-02.png"];
const FICTIONAL_BRAND = "MERIDIAN GOODS";

export function ComparisonView({ panel }: { panel: PanelMember[] }) {
  return (
    <div className="grid h-full w-full grid-cols-1 gap-px bg-[var(--background)] md:grid-cols-2">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--surface)]">
        <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--muted)]">
          <span>What {FICTIONAL_BRAND}&rsquo;s product page shows today</span>
          <span className="rounded bg-[color:var(--gap-accent)] px-2 py-0.5 font-medium text-white">
            illustrative product page — AI-generated
          </span>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-px">
          {CAMPAIGN_IMAGES.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="Illustrative, AI-generated campaign photo — not a real brand" className="h-full w-full object-cover" />
          ))}
        </div>
      </div>

      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--surface)]">
        <div className="px-4 py-2 text-xs text-[var(--muted)]">What CASTING shows — same garment, 8 measured skin tones</div>
        <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-px">
          {panel.map((member) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={member.id}
              src={vtoResultPath(member.id)}
              alt={`Same product on a reference person, Fitzpatrick ${member.fitzpatrickScale ?? "unmeasured"}`}
              className="h-full w-full object-cover object-top"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
