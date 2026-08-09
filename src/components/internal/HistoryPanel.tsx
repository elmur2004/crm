import { formatCairo } from "@/lib/datetime";
import { STAGE_LABELS } from "@/lib/pipeline-engine/constants";

/* §5.6 — the card's History panel: actor, timestamp, from → to, trigger.
   Where SPEC prescribes exact History wording, the trigger maps to that phrase. */

const TRIGGER_PHRASES: Record<string, string> = {
  "PP-2": "Returned to Lead — new number added", // §7.2 / §10.2 normative wording
};

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
    return <p className="empty">No history yet.</p>;
  }
  return (
    <ol>
      {entries.map((e) => (
        <li key={e.id} className="tl-row">
          <span className="tl-rail" aria-hidden>
            <span className="tl-dot" />
          </span>
          <div className="tl-text flex flex-wrap items-baseline gap-x-2 pb-3">
            <span className="tl-time">{formatCairo(e.createdAt)}</span>
            <span>{e.actorLabel}</span>
            {TRIGGER_PHRASES[e.trigger] ? (
              <span className="tl-pill">{TRIGGER_PHRASES[e.trigger]}</span>
            ) : null}
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
            <span className="tl-code">[{e.trigger}]</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
