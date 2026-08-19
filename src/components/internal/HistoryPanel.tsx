import { formatCairo } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { history } from "@/lib/i18n/dict/internal";
import { TRIGGER_PHRASES } from "./historyPhrases";

/* §5.6 — the card's History panel: actor, timestamp, from → to, trigger.
   Where SPEC prescribes exact History wording, the trigger maps to that phrase
   — see ./historyPhrases, which derives the map from the pipelines' own row
   ids so PP-2 and PA-2 can never drift apart. */

export async function HistoryPanel({
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
  const locale = await getLocale();
  const t = tFor(locale);
  if (entries.length === 0) {
    return <p className="empty">{t(history.noHistoryYet)}</p>;
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
              <span className="tl-pill">{t(TRIGGER_PHRASES[e.trigger])}</span>
            ) : null}
            <span>
              {history.actions[e.action] ? t(history.actions[e.action]) : e.action.replace(/_/g, " ")}
              {e.fromStage || e.toStage ? (
                <>
                  {": "}
                  {e.fromStage ? stageLabel(locale, e.fromStage) : "—"}
                  <span className="inline-block rtl:-scale-x-100" aria-hidden>
                    {" → "}
                  </span>
                  {e.toStage ? stageLabel(locale, e.toStage) : "—"}
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
