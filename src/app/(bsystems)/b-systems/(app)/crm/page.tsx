import Link from "next/link";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listBsLeads, listOwnLeads } from "@/lib/services/bsystems-admin";
import { listBsOwnerReps } from "@/lib/services/sales-reps";
import { LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { orderMeetingColumn } from "@/lib/board-order";
import { formatCairo } from "@/lib/datetime";
import { formatEGP } from "@/lib/money";
import { waHref } from "@/lib/phone-dial";
import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel, ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { common, crmPage as m, leadsFilters as lf, ownerFilters } from "@/lib/i18n/dict/crm";
import { BsBoard, type BsBoardLead } from "@/components/bsystems/BsBoard";
import { BsAddLeadForm } from "@/components/bsystems/leadActions";
import { FilterPanel } from "@/components/shared/FilterPanel";
import type { BsFormRole } from "@/components/bsystems/roleForms";

export const metadata = { title: "CRM — B-Systems CRM" };

/* V2 §2.3 — THE board: colored columns, drag & drop with the stage's role-aware
   form on drop. Admin filters by owner bucket (incl. Admins); sales sees the
   internal bucket; agents/partners see only their own leads.
   Founder (filters round 3): "add the search and the filtrations on the CRM
   cards page, not just on the leads page" — the Leads sidebar's card, in its
   INLINE variant above the board (the board is a full-bleed breakout, so a
   fixed side column would be painted over by it). Search + Type for everyone,
   Owner for the admin; no Stage (the columns ARE the stages), no Sort (the
   board is not a list), no Archived view (ADR-043: archived leaves the board).
   All narrowing is server-side, in the same services the Leads list uses. */

const FILTERS: Array<{ key: string; label: Msg }> = [
  { key: "any", label: ownerFilters.any },
  { key: "internal", label: ownerFilters.internal },
  { key: "agent", label: ownerFilters.agent },
  { key: "partner", label: ownerFilters.partner },
  { key: "admin", label: ownerFilters.admin },
  { key: "unassigned", label: ownerFilters.unassigned }, // ADR-051
];

type LeadRow = Awaited<ReturnType<typeof listBsLeads>>[number];

function ownerLabel(locale: Locale, lead: LeadRow): string {
  const bucket = ownerTypeLabel(locale, lead.ownerType);
  const who =
    lead.owner?.name ?? lead.salesRep?.name ?? lead.partner?.companyName ?? null;
  return who ? `${bucket} · ${who}` : bucket;
}

function keyDatum(locale: Locale, lead: LeadRow): string {
  const t = tFor(locale);
  switch (lead.stage) {
    case "following_up":
      /* ADR-061 + ADR-063: a follow-up is a DAY unless someone chose a time —
         the clock rides `dueTimeSet`, never the instant (a defaulted 09:00 and
         a chosen 09:00 are the same instant). */
      return lead.followUps[0]
        ? `${t(m.nextPrefix)}${formatCairo(lead.followUps[0].dueAt, lead.followUps[0].dueTimeSet)}`
        : t(m.noFollowUp);
    case "meeting_setting":
      return lead.meetings[0]?.datetime
        ? `${t(m.meetingPrefix)}${formatCairo(lead.meetings[0].datetime)}`
        : t(m.meetingNotArranged);
    case "sending_proposal":
      return lead.proposals[0]?.estimatedValue != null
        ? `${t(m.estPrefix)}${formatEGP(lead.proposals[0].estimatedValue)}`
        : t(m.noValue);
    case "negotiation": {
      /* founder: "the date we will have a response for them on the proposal" —
         shown only while that follow-up is the card's newest record, so the
         one left behind by a previous stage never masquerades as a promise. */
      const f = lead.followUps[0];
      const n = lead.negotiationNotes[0];
      if (!f || (n && n.createdAt > f.createdAt)) return t(m.noResponseDate);
      /* the response date is a follow-up record — same conditional clock */
      return `${t(m.responsePrefix)}${formatCairo(f.dueAt, f.dueTimeSet)}`;
    }
    case "lost":
      return lead.lostInfo[0]?.reason ?? "";
    default:
      return "";
  }
}

export default async function BsCrmPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; q?: string; type?: string }>;
}) {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const engineRole = bsRoleOf(user);
  const role: BsFormRole =
    engineRole === "bsystems_admin"
      ? "admin"
      : engineRole === "bsystems_sales"
        ? "sales"
        : engineRole === "bsystems_agent"
          ? "agent"
          : "partner";

  const locale = await getLocale();
  const t = tFor(locale);
  const params = await searchParams;
  const filter = FILTERS.some((f) => f.key === params.owner) ? params.owner! : "any";
  const search = (params.q ?? "").trim();
  const type = (LEAD_TYPES as readonly string[]).includes(params.type ?? "")
    ? params.type!
    : "any";
  const narrow = { search, type };

  const rows =
    role === "admin"
      ? await listBsLeads(filter, narrow)
      : role === "sales"
        ? await listBsLeads("internal", narrow)
        : await listOwnLeads(user.id, narrow);

  /* the disclosure chip counts every control that is off its default */
  const activeCount = [search !== "", type !== "any", role === "admin" && filter !== "any"].filter(
    Boolean,
  ).length;

  /* ADR-064 — the instant the Meeting Setting card SHOWS (its keyDatum above),
     which is also the instant its column is ordered and filtered by. One
     function, so the eye can verify the order against the line it reads. */
  const meetingAt = (l: LeadRow): string | null =>
    l.stage === "meeting_setting" && l.meetings[0]?.datetime
      ? l.meetings[0].datetime.toISOString()
      : null;

  const leads: BsBoardLead[] = rows.map((l) => ({
    id: l.id,
    name: l.name,
    companyName: l.companyName,
    stage: l.stage,
    ownerType: l.ownerType,
    ownerLabel: ownerLabel(locale, l),
    readyToClose: l.readyToClose,
    noAnswer: l.noAnswer,
    noAnswerCount: l.noAnswerCount, // ADR-064 — the card says how many tries
    keyDatum: keyDatum(locale, l),
    waHref: waHref(l.number),
    /* the Today chip's datum (ADR-061) — the same latest follow-up the key
       datum shows, only on Following Up cards */
    followUpDueAt:
      l.stage === "following_up" && l.followUps[0] ? l.followUps[0].dueAt.toISOString() : null,
    meetingAt: meetingAt(l),
  }));
  /* founder (ADR-064): the Meeting Setting column runs soonest-meeting-first,
     always — server-side, where the list is built, so the client never has to
     re-order. Every other column keeps its `updatedAt desc`. */
  const orderedLeads = orderMeetingColumn(leads, bsystemsCrmConfig.meetingStage);

  const reps =
    role === "admin" || role === "sales"
      ? (await listBsOwnerReps()).map((r) => ({ id: r.id, name: r.name }))
      : [];

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(m.eyebrow)}</p>
          <h1 className="u-h1">{t(m.title)}</h1>
        </div>
        <div className="page-actions">
          <BsAddLeadForm />
        </div>
      </div>
      <FilterPanel activeCount={activeCount} variant="inline" defaultOpen={activeCount > 0}>
        <form method="get" className="card filter-card filter-card--inline" aria-label={t(lf.filters)}>
          <label className="filter-section">
            <span className="filter-section-label">{t(lf.search)}</span>
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder={t(lf.searchPlaceholder)}
              className="field-input"
            />
          </label>
          <label className="filter-section">
            <span className="filter-section-label">{t(common.type)}</span>
            <select name="type" defaultValue={type} className="field-input">
              <option value="any">{t(ownerFilters.any)}</option>
              {LEAD_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {leadTypeLabel(locale, ty)}
                </option>
              ))}
            </select>
          </label>
          {role === "admin" ? (
            <label className="filter-section">
              <span className="filter-section-label">{t(common.owner)}</span>
              <select name="owner" defaultValue={filter} className="field-input">
                {FILTERS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {t(f.label)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="filter-actions">
            <button type="submit" className="btn-primary btn--sm">
              {t(lf.apply)}
            </button>
            {activeCount > 0 ? (
              <Link href="/b-systems/crm" className="filter-reset">
                {t(lf.clear)}
              </Link>
            ) : null}
          </div>
        </form>
      </FilterPanel>
      {orderedLeads.length === 0 && activeCount > 0 ? (
        <p className="empty">{t(m.noMatches)}</p>
      ) : (
        <BsBoard leads={orderedLeads} role={role} reps={reps} />
      )}
    </div>
  );
}
