import { STAGE_LABELS } from "@/lib/pipeline-engine/constants";

/* Stage chip — tokens only; Won leans on success, Lost on danger, active on secondary. */
export function StageBadge({ stage }: { stage: string }) {
  const tone =
    stage === "won"
      ? "bg-brand-success text-brand-on-success"
      : stage === "lost"
        ? "bg-brand-danger text-brand-on-danger"
        : "bg-brand-surface-tint text-brand-ink";
  return (
    <span className={`inline-block rounded-brand-control px-2 py-0.5 text-xs font-medium ${tone}`}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}
