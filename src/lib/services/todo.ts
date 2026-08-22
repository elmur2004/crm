import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { cairoToUtc, utcToCairo } from "@/lib/datetime";

/* Founder (ADR-041) — the To-Do page: "the actual date of today with the
   entire tasks of today... just a way of representing what I have to do today,
   no fancy stuff, so I don't miss anything." A read-only projection over the
   records that already carry dates — no new state. An item is LIVE when it is
   its lead's LATEST record AND the lead still sits in the matching stage
   (exactly what the boards' key datum shows) — superseded history never
   resurfaces.

   Founder (ADR-061): "remove all the overdue section in the to do section and
   also remove the partners tasks from the to do." The projection is TODAY,
   full stop — no overdue list — and the partner/agent pipeline rows
   (prospect follow-ups and meetings) are gone at the service, not hidden in
   the view. An overdue follow-up or meeting is therefore INVISIBLE here (the
   board cards still show its date). The MONEY kinds are not partner tasks and
   stay: statements and milestones keep their due-before-end-of-today
   semantics, so a payment expected yesterday still shows under Today. */

export type TodoScope =
  | { kind: "all" } // bsystems admin · byteforce staff
  | { kind: "internal" } // bsystems internal sales (internal bucket)
  | { kind: "own"; userId: string }; // agent / partner — own leads only

/* ADR-061 dropped "prospect_follow_up" / "prospect_meeting": the partners
   funnel no longer projects onto the To-Do at all. */
export type TodoKind = "follow_up" | "meeting" | "statement" | "milestone";

export interface TodoItem {
  kind: TodoKind;
  at: Date;
  /* date-only records hide the clock. Follow-ups joined the date-only club
     (founder, ADR-061) — only MEETINGS still show a time. */
  withTime: boolean;
  title: string;
  href: string;
  /* Founder — "I can assign these to do as an admin or just take it myself":
     lead-backed rows (follow_up / meeting) carry the LEAD's ownership, so the
     To-Do can hand the lead over with the existing assign machinery. Prospect,
     statement and milestone rows are admin-owned subsystems — nothing to hand
     over, so the fields stay unset there.
     Review: `ownerName` is the same three-way name every other owner surface
     shows (owner account ?? internal rep ?? referring partner company), so a
     lead that IS assigned — to a rep, or to a partner company with no login —
     never reads as unassigned on the one screen that hands work out. */
  leadId?: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerType?: string;
}

export interface TodoLists {
  /* ADR-061: today is the ONLY list — the founder removed the Overdue section */
  today: TodoItem[];
}

/* Hardening (review): Egypt's spring-forward jumps AT midnight, so 00:00 may
   not exist on the transition day — the datetime solver then lands on 23:00 of
   the EVE, silently stealing the eve's last hour into the next day's window.
   Clamp to the first instant that actually falls on the requested date (the
   post-jump 01:00; DST jumps are one hour). */
function startOfCairoDay(date: string): Date {
  let start = cairoToUtc(date, "00:00");
  if (utcToCairo(start).date !== date) start = new Date(start.getTime() + 60 * 60 * 1000);
  return start;
}

/** [start, end) of the Cairo calendar day containing `now`, as UTC instants. */
export function cairoDayWindow(now: Date): { start: Date; end: Date } {
  const { date } = utcToCairo(now);
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextDate = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(
    next.getUTCDate(),
  )}`;
  return { start: startOfCairoDay(date), end: startOfCairoDay(nextDate) };
}

/* The name every other owner surface shows, in the same order (CRM board,
   Leads table, lead detail): the owner ACCOUNT, else the internal rep, else
   the referring partner company. Null only for the genuinely unassigned
   internal lead — no rep, no account (ADR-051). */
function ownerNameOf(lead: {
  owner: { name: string } | null;
  salesRep: { name: string } | null;
  partner: { companyName: string } | null;
}): string | null {
  return lead.owner?.name ?? lead.salesRep?.name ?? lead.partner?.companyName ?? null;
}

function leadWhere(brand: Brand, scope: TodoScope) {
  return {
    brand,
    archived: false, // ADR-043: archived leads carry no to-dos
    ...(scope.kind === "internal" ? { ownerType: "internal" } : {}),
    ...(scope.kind === "own" ? { ownerUserId: scope.userId } : {}),
  };
}

export async function todoFor(opts: {
  brand: Brand;
  scope: TodoScope;
  now?: Date;
}): Promise<TodoLists> {
  const now = opts.now ?? new Date();
  const { start, end } = cairoDayWindow(now);
  const leadBase = opts.brand === "bsystems" ? "/b-systems/crm/lead" : "/byteforce/leads/lead";
  /* Statements and milestones are admin-owned subsystems. (The partnership
     CRM used to join here too — ADR-061 took its rows off the To-Do.) */
  const adminExtras = opts.brand === "bsystems" && opts.scope.kind === "all";

  /* Hardening (review): pick the TRUE latest record per lead FIRST — across
     follow-ups, meetings, AND proposals (a B-6 groupless proposal-sent return
     leaves the proposal as the newest record; the stale pre-proposal follow-up
     must never resurface) — then keep the row only when that latest record is
     the matching live kind. This mirrors the boards' key datum exactly. */
  /* Founder (same-stage records): NEGOTIATION carries a dated follow-up too —
     "the date we will have a response for them on the proposal" — so the
     negotiation stage joins the projection, and negotiation NOTES join the
     latest-record race (a note written on the way in must supersede the
     follow-up left behind by the previous stage). */
  const stagedLeads = await db.lead.findMany({
    where: {
      ...leadWhere(opts.brand, opts.scope),
      stage: { in: ["following_up", "meeting_setting", "negotiation"] },
    },
    select: {
      id: true,
      name: true,
      stage: true,
      ownerUserId: true,
      ownerType: true,
      owner: { select: { name: true } },
      salesRep: { select: { name: true } },
      partner: { select: { companyName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      negotiationNotes: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const items: TodoItem[] = [];
  for (const lead of stagedLeads) {
    const f = lead.followUps[0] ?? null;
    const m = lead.meetings[0] ?? null;
    const p = lead.proposals[0] ?? null;
    const n = lead.negotiationNotes[0] ?? null;
    const newest = Math.max(
      f?.createdAt.getTime() ?? 0,
      m?.createdAt.getTime() ?? 0,
      p?.createdAt.getTime() ?? 0,
      n?.createdAt.getTime() ?? 0,
    );
    if (
      (lead.stage === "following_up" || lead.stage === "negotiation") &&
      f &&
      f.createdAt.getTime() === newest
    ) {
      items.push({
        kind: "follow_up",
        at: f.dueAt,
        withTime: false, // ADR-061: follow-ups are date-only

        title: lead.name,
        href: `${leadBase}/${lead.id}`,
        leadId: lead.id,
        ownerUserId: lead.ownerUserId,
        ownerName: ownerNameOf(lead),
        ownerType: lead.ownerType,
      });
    }
    if (
      lead.stage === "meeting_setting" &&
      m &&
      m.createdAt.getTime() === newest &&
      m.arranged &&
      m.outcome === null &&
      m.datetime
    ) {
      items.push({
        kind: "meeting",
        at: m.datetime,
        withTime: true,
        title: lead.name,
        href: `${leadBase}/${lead.id}`,
        leadId: lead.id,
        ownerUserId: lead.ownerUserId,
        ownerName: ownerNameOf(lead),
        ownerType: lead.ownerType,
      });
    }
  }

  if (adminExtras) {
    /* ADR-061: the partner/agent pipeline (prospect follow-ups AND meetings)
       no longer projects onto the To-Do — the founder: "remove the partners
       tasks from the to do". Only the MONEY subsystems remain, and both are
       fetched due-before-END-of-today (`lt: end`), so an expected-yesterday
       payment still lands in the Today list below — money never vanishes. */
    const [statements, milestones] = await Promise.all([
      db.statement.findMany({
        /* ADR-043 clarification: an archived lead's money TASKS leave the
           To-Do too (the Statements/Won Leads pages still show the records) */
        where: {
          status: "pending",
          expectedDate: { not: null, lt: end },
          milestone: { wonDeal: { lead: { archived: false } } },
        },
      }),
      db.milestone.findMany({
        where: {
          completed: false,
          expectedEnd: { not: null, lt: end },
          wonDeal: { lead: { archived: false } },
        },
        include: { wonDeal: { select: { id: true, lead: { select: { name: true } } } } },
      }),
    ]);
    for (const s of statements) {
      items.push({
        kind: "statement",
        at: s.expectedDate!,
        withTime: false,
        title: `${s.code} — ${s.clientName}`,
        href: "/b-systems/statements",
      });
    }
    for (const ms of milestones) {
      items.push({
        kind: "milestone",
        at: ms.expectedEnd!,
        withTime: false,
        title: `${ms.wonDeal.lead.name}${ms.label ? ` — ${ms.label}` : ""}`,
        href: `/b-systems/won-leads/${ms.wonDeal.id}`,
      });
    }
  }

  const byTime = (a: TodoItem, b: TodoItem) => a.at.getTime() - b.at.getTime();
  /* ADR-061: no overdue list. Lead rows (follow-ups / meetings) appear only
     inside today's Cairo window; the MONEY rows keep due-before-end-of-today —
     a statement or milestone expected yesterday still shows TODAY, because a
     pending payment must stay in sight until it is settled. */
  return {
    today: items
      .filter((i) =>
        i.kind === "statement" || i.kind === "milestone"
          ? i.at < end
          : i.at >= start && i.at < end,
      )
      .sort(byTime),
  };
}
