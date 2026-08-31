import { formatCairo } from "@/lib/datetime";
import { formatEGP } from "@/lib/money";
import { tFor, type Locale } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { postponeReasonLabel, stageLabel } from "@/lib/i18n/dict/labels";
import { common, records } from "@/lib/i18n/dict/internal";
import { postponeMsgs } from "@/lib/i18n/dict/postpone";

/* §5.2 — field groups are additive history, shown chronologically. Accepts the
   lead/prospect/deal detail's included child records (superset shape, all optional). */

type FollowUpRow = {
  id: string;
  context: string;
  dueAt: Date;
  dueTimeSet: boolean; // ADR-063 — was the clock chosen, or is it the 09:00 default?
  method: string;
  followingUpWith: string | null;
  ownerSalesRep?: { name: string } | null;
  ownerPortalRep?: { firstName: string; lastName: string } | null;
  createdAt: Date;
};
type MeetingRow = {
  id: string;
  arranged: boolean;
  datetime: Date | null;
  mode: string | null;
  withAttendees: string | null;
  technicalSupport: string | null;
  outcome: string | null;
  createdAt: Date;
};
type ProposalRow = {
  id: string;
  service: string;
  estimatedValue: number | null;
  sent: boolean;
  sentAt: Date | null;
  createdAt: Date;
};
type LostRow = { id: string; reason: string; createdAt: Date };

/* ADR-068 — the locale rides down as a prop: this stamp is the ONE line in the
   history that always carries a clock, so it is the one that must never fall
   back to English inside an Arabic page. */
function Section({
  title,
  at,
  locale,
  children,
}: {
  title: string;
  at: Date;
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div className="record-group">
      <div className="flex items-baseline justify-between gap-2">
        <p className="record-title">{title}</p>
        <p className="record-time">{formatCairo(at, locale)}</p>
      </div>
      <div className="record-grid">{children}</div>
    </div>
  );
}

export async function GroupHistory({
  followUps = [],
  meetings = [],
  proposals = [],
  lostInfo = [],
  postponeInfos = [],
  won,
}: {
  followUps?: FollowUpRow[];
  meetings?: MeetingRow[];
  proposals?: ProposalRow[];
  lostInfo?: LostRow[];
  /* ADR-072 — every time this lead was parked, with the reason. It ACCUMULATES
     like every other group (§5.2), so a lead that went quiet twice before it
     bought reads that way in its own history. */
  postponeInfos?: Array<{ id: string; reason: string; note: string | null; createdAt: Date }>;
  won?: {
    estimatedValue: number;
    technicalOwner: string;
    collectedAmount: number;
    createdAt: Date;
  } | null;
}) {
  const locale = await getLocale();
  const t = tFor(locale);
  const items: Array<{ at: Date; node: React.ReactNode }> = [];

  for (const f of followUps) {
    const owner =
      f.ownerSalesRep?.name ??
      (f.ownerPortalRep
        ? `${f.ownerPortalRep.firstName} ${f.ownerPortalRep.lastName}`
        : null);
    const contextMsg = records.followUpContexts[f.context];
    items.push({
      at: f.createdAt,
      node: (
        <Section
          key={`f${f.id}`}
          locale={locale}
          title={
            contextMsg ? t(contextMsg) : t(records.followUpContexts.initial)
          }
          at={f.createdAt}
        >
          {/* ADR-061 + ADR-063: due on a DAY unless the recorder chose a time
              (meetings keep theirs unconditionally). This one line feeds the
              lead detail, the prospect detail AND the call sheet. */}
          <p>
            {t(records.due)} {formatCairo(f.dueAt, locale, f.dueTimeSet)} ·{" "}
            {f.method === "call"
              ? t(common.call)
              : f.method === "message"
                ? t(common.message)
                : t(common.visit)}
          </p>
          {owner ? (
            <p>
              {t(records.ownerColon)} {owner}
            </p>
          ) : null}
          {f.followingUpWith ? (
            <p>
              {t(records.withColon)} {f.followingUpWith}
            </p>
          ) : null}
        </Section>
      ),
    });
  }
  for (const m of meetings) {
    const outcomeMsg = m.outcome ? records.outcomes[m.outcome] : undefined;
    items.push({
      at: m.createdAt,
      node: (
        <Section
          key={`m${m.id}`}
          locale={locale}
          title={t(records.meeting)}
          at={m.createdAt}
        >
          {m.arranged && m.datetime ? (
            <p>
              {formatCairo(m.datetime, locale)} ·{" "}
              {m.mode === "online" ? t(common.online) : t(common.offline)}
            </p>
          ) : (
            <p>{t(records.notArrangedYet)}</p>
          )}
          {m.withAttendees ? (
            <p>
              {t(records.withColon)} {m.withAttendees}
            </p>
          ) : null}
          {m.technicalSupport ? (
            <p>
              {t(records.technicalSupportColon)} {m.technicalSupport}
            </p>
          ) : null}
          {m.outcome ? (
            <p>
              {t(records.outcomeColon)} {outcomeMsg ? t(outcomeMsg) : m.outcome}
            </p>
          ) : null}
        </Section>
      ),
    });
  }
  for (const p of proposals) {
    items.push({
      at: p.createdAt,
      node: (
        <Section
          key={`p${p.id}`}
          locale={locale}
          title={t(records.proposal)}
          at={p.createdAt}
        >
          <p>{p.service}</p>
          <p>
            {p.estimatedValue != null
              ? formatEGP(p.estimatedValue)
              : t(common.noValueSet)}{" "}
            ·{" "}
            {p.sent
              ? `${t(records.sent)} ${p.sentAt ? formatCairo(p.sentAt, locale) : ""}`
              : t(records.notSent)}
          </p>
        </Section>
      ),
    });
  }
  for (const l of lostInfo) {
    items.push({
      at: l.createdAt,
      node: (
        <Section
          key={`l${l.id}`}
          locale={locale}
          title={stageLabel(locale, "lost")}
          at={l.createdAt}
        >
          <p>{l.reason}</p>
        </Section>
      ),
    });
  }
  for (const p of postponeInfos) {
    items.push({
      at: p.createdAt,
      node: (
        <Section
          key={`p${p.id}`}
          locale={locale}
          title={t(postponeMsgs.historyTitle)}
          at={p.createdAt}
        >
          <p>{postponeReasonLabel(locale, p.reason)}</p>
          {p.note ? <p>{p.note}</p> : null}
        </Section>
      ),
    });
  }
  if (won) {
    items.push({
      at: won.createdAt,
      node: (
        <Section
          key="won"
          locale={locale}
          title={stageLabel(locale, "won")}
          at={won.createdAt}
        >
          <p>
            {t(records.estimated)} {formatEGP(won.estimatedValue)}
          </p>
          <p>
            {t(common.technicalOwnerColon)} {won.technicalOwner}
          </p>
          <p>
            {t(records.collected)} {formatEGP(won.collectedAmount)}
          </p>
        </Section>
      ),
    });
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime());

  if (items.length === 0) {
    return <p className="empty">{t(records.noStageRecordsYet)}</p>;
  }
  return <div className="space-y-2">{items.map((i) => i.node)}</div>;
}
