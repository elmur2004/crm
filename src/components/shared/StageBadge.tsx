import { STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { stageKey } from "@/components/bsystems/stageColors";

/* Stage chip (spec §2.6) — the per-stage chip/chip-ink pair, resolved by the
   data-stage-key attribute under the active brand scope. */
export function StageBadge({ stage, header }: { stage: string; header?: boolean }) {
  return (
    <span
      data-stage-key={stageKey(stage)}
      className={header ? "stage-chip stage-chip--header" : "stage-chip"}
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}
