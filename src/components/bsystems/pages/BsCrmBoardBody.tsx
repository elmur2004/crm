import Link from "next/link";
import type { CrmSurface } from "@/lib/crm/surface";
import { listBsLeads, listOwnLeads } from "@/lib/services/bsystems-admin";
import { listBsOwnerReps } from "@/lib/services/sales-reps";
import { listCalendarPeople } from "@/lib/services/calendar";
import { LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import { orderMeetingColumn } from "@/lib/board-order";
import { formatCairo } from "@/lib/datetime";
import { formatEGP } from "@/lib/money";
import { waHref } from "@/lib/phone-dial";
import { waSentLabel, whatsappMarkOf } from "@/components/shared/whatsappMark";
import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel, ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { common, crmPage as m, leadsFilters as lf, ownerFilters } from "@/lib/i18n/dict/crm";
import { BsBoard, type BsBoardLead } from "@/components/bsystems/BsBoard";
import { BsAddLeadForm } from "@/components/bsystems/leadActions";
import { FilterPanel } from "@/components/shared/FilterPanel";
import type { BsFormRole } from "@/components/bsystems/roleForms";

/* V2 §2.3 — THE board: colored columns, drag & drop with the stage's role-aware
   form on drop. Admin filters by owner bucket (incl. Admins); sales sees the
   internal bucket; agents/partners see only their own leads.
   Founder (filters round 3): "add the search and the filtrations on the CRM
   cards page, not just on the leads page" — the Leads sidebar's card, in its
   INLINE variant above the board (the board is a full-bleed breakout, so a
   fixed side column would be painted over by it). Search + Type for everyone,
   Owner for the admin; no Stage (the columns ARE the stages), no Sort (the
   board is not a list), no Archived view (ADR-043: archived leaves the board).
   All narrowing is server-side, in the same services the Leads list uses.

   ADR-074 — extracted from the page so Mindoo renders the SAME board at its
   own address. The board component stays statically bound to BSYSTEMS_STAGES,
   which is exactly right: Mindoo's pipeline IS that shape (the founder's own
   choice when asked), and a board parameterised by stage set at runtime is how
   a column from one company appears on another's screen. What varies is the
   SURFACE — the brand the rows are read under, the API the drops post to, and
   the address the cards link to — and that is the whole of what varies. */

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
        ? `${t(m.nextPrefix)}${formatCairo(lead.followUps[0].dueAt, locale, lead.followUps[0].dueTimeSet)}`
        : t(m.noFollowUp);
    case "meeting_setting":
      return lead.meetings[0]?.datetime
        ? `${t(m.meetingPrefix)}${formatCairo(lead.meetings[0].datetime, locale)}`
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
      return `${t(m.responsePrefix)}${formatCairo(f.dueAt, locale, f.dueTimeSet)}`;
    }
    case "lost":
      return lead.lostInfo[0]?.reason ?? "";
    default:
      return "";
  }
}

export interface BsBoardParams {
  owner?: string;
  q?: string;
  type?: string;
}

export async function BsCrmBoardBody({
  ctx,
  params,
  role,
  userId,
}: {
  ctx: CrmSurface;
  params: BsBoardParams;
  /* the FORM SHAPE this account gets — resolved by each surface's own page
     guard out of its own engine role, never re-derived here */
  role: BsFormRole;
  userId: string;
}) {
  const locale = await getLocale();
  const t = tFor(locale);
  const filter = FILTERS.some((f) => f.key === params.owner) ? params.owner! : "any";
  const search = (params.q ?? "").trim();
  const type = (LEAD_TYPES as readonly string[]).includes(params.type ?? "")
    ? params.type!
    : "any";
  const narrow = { search, type };

  const rows =
    role === "admin"
      ? await listBsLeads(ctx.brand, filter, narrow)
      : role === "sales"
        ? await listBsLeads(ctx.brand, "internal", narrow)
        : await listOwnLeads(ctx.brand, userId, narrow);

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
    /* ADR-069 — the chip's green state and the sentence that goes with it,
       both resolved HERE: the mark is the record's, and the date goes through
       the one shared formatter rather than a clock on the client */
    waSentLabel: waSentLabel(locale, whatsappMarkOf(l)),
    waMarkUrl: `${ctx.apiBase}/leads/${l.id}/whatsapp`,
    /* the Today chip's datum (ADR-061) — the same latest follow-up the key
       datum shows, only on Following Up cards */
    followUpDueAt:
      l.stage === "following_up" && l.followUps[0] ? l.followUps[0].dueAt.toISOString() : null,
    meetingAt: meetingAt(l),
  }));
  /* founder (ADR-064): the Meeting Setting column runs soonest-meeting-first,
     always — server-side, where the list is built, so the client never has to
     re-order. Every other column keeps its `updatedAt desc`. */
  const orderedLeads = orderMeetingColumn(leads, configForBrand(ctx.brand).meetingStage);

  /* ADR-074 — `listBsOwnerReps` is B-SYSTEMS' internal sales team, minted from
     the `bsystems_sales` role. Offered on a Mindoo board it would put another
     company's people in the "assign a rep" select, and the chosen one would be
     written onto a Mindoo lead. Mindoo has one staff role and no reps to pick
     between, so the list is empty there — the field simply does not offer a
     choice, which is the honest picture of that company. */
  const reps =
    ctx.brand === "bsystems" && (role === "admin" || role === "sales")
      ? (await listBsOwnerReps()).map((r) => ({ id: r.id, name: r.name }))
      : [];

  /* ADR-071 — the roster behind the meeting form's "Also blocks" picker. It is
     the same list the calendar draws its columns from, so a person you can mark
     as needed is a person whose time the calendar can actually show.
     ADR-073/074 — the SURFACE's brand, so a Mindoo meeting is offered Mindoo's
     people and occupies Mindoo's calendar, never the other company's. */
  const calendarPeople = await listCalendarPeople(ctx.brand);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(m.eyebrow)}</p>
          <h1 className="u-h1">{t(m.title)}</h1>
        </div>
        <div className="page-actions">
          <BsAddLeadForm apiBase={ctx.apiBase} />
        </div>
      </div>
      <FilterPanel activeCount={activeCount} variant="inline" defaultOpen={activeCount > 0}>
        <form method="get" className="card filter-card filter-card--inline" aria-label={t(lf.filters)}>
          {/* ADR-067 — a method="get" submit REPLACES the whole query string
              with this form's fields; without this the company would be
              dropped on every Apply. ADR-074 — nothing at all under Mindoo,
              which has no company parameter to preserve. */}
          {ctx.companyParam ? (
            <input type="hidden" name="company" value={ctx.companyParam} />
          ) : null}
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
              <Link
                /* ADR-074 — Clear filters resets to this surface's own list
                   address, WITHOUT a company on it, which is what it has
                   always done here and is correct on both surfaces: under
                   Mindoo there is no company parameter at all, and under
                   B-Systems the bare address resolves to B-Systems because
                   it is the default of every account that holds it
                   (companiesFor's order, ADR-067). ByteForce's own body DOES
                   carry it — see components/internal/pages.tsx — because it is
                   nobody's default. Adding it here changed a shipped URL and
                   broke leads-filters.spec.ts: the test earning its keep. */
                href={`${ctx.basePath}/crm`}
                className="filter-reset"
              >
                {t(lf.clear)}
              </Link>
            ) : null}
          </div>
        </form>
      </FilterPanel>
      {orderedLeads.length === 0 && activeCount > 0 ? (
        <p className="empty">{t(m.noMatches)}</p>
      ) : (
        <BsBoard
          leads={orderedLeads}
          role={role}
          reps={reps}
          company={ctx.brand}
          apiBase={ctx.apiBase}
          leadPathBase={`${ctx.basePath}/crm/lead`}
          leadQuery={ctx.query}
          people={calendarPeople}
        />
      )}
    </div>
  );
}
