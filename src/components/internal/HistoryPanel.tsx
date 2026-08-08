import { formatCairo } from "@/lib/datetime";
import { STAGE_LABELS } from "@/lib/pipeline-engine/constants";

/* §5.6 — the card's History panel: actor, timestamp, from → to, trigger. */

export function HistoryPanel({
  entries,
}: {
  entries: Array<{
    id: string;
    actorLabel: string;
    action: string;
    fromStage: string | null;
    toStage: string | null;
    trigger: string;
    createdAt: Date;
  }>;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-brand-muted">No history yet.</p>;
  }
  return (
    <ol className="space-y-1.5">
      {entries.map((e) => (
        <li key={e.id} className="text-xs text-brand-muted flex flex-wrap gap-x-2">
          <span className="text-brand-ink font-medium">{formatCairo(e.createdAt)}</span>
          <span>{e.actorLabel}</span>
          <span>
            {e.action === "auto_transfer" ? "auto-moved" : e.action.replace(/_/g, " ")}
            {e.fromStage || e.toStage ? (
              <>
                {": "}
                {e.fromStage ? (STAGE_LABELS[e.fromStage] ?? e.fromStage) : "—"}
                <span className="inline-block rtl:-scale-x-100" aria-hidden>
                  {" → "}
                </span>
                {e.toStage ? (STAGE_LABELS[e.toStage] ?? e.toStage) : "—"}
              </>
            ) : (
              ""
            )}
          </span>
          <span className="font-brand-mono">[{e.trigger}]</span>
        </li>
      ))}
    </ol>
  );
}
