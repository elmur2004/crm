"use client";

import { stageKey } from "@/components/bsystems/stageColors";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { useLocale } from "@/components/shared/LocaleProvider";

/* Stage chip (spec §2.6) — the per-stage chip/chip-ink pair, resolved by the
   data-stage-key attribute under the active brand scope. Client component so
   it can read the locale from context wherever it is rendered. */
export function StageBadge({ stage, header }: { stage: string; header?: boolean }) {
  const locale = useLocale();
  return (
    <span
      data-stage-key={stageKey(stage)}
      className={header ? "stage-chip stage-chip--header" : "stage-chip"}
    >
      {stageLabel(locale, stage)}
    </span>
  );
}
