import { getPanel } from "@/lib/panel";
import { ComparisonView } from "@/components/ComparisonView";

export default function ComparePage() {
  const panel = getPanel();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <ComparisonView panel={panel} />
    </div>
  );
}
