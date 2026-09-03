import { db } from "@/lib/db";
import { leadHref } from "@/lib/crm/surface";
import type { Brand } from "@/lib/pipeline-engine/constants";
import {
  configForBrand,
  datedStagesFor,
  followUpStagesFor,
} from "@/lib/pipeline-engine/configs/for-brand";
import { startOfCairoDay, utcToCairo } from "@/lib/datetime";

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
   semantics, so a payment expected yesterday still shows under Today.

   Founder 2.2/2.3 (ADR-062): every task completes in exactly two ways —
   MANUALLY (the checkbox writes a TodoDone mark keyed to the underlying
   record; see todo-done.ts) or AUTOMATICALLY (the CRM resolved it: the lead
   moved stage, a newer record superseded it, the meeting got an outcome, the
   statement was paid, the milestone completed). Completed tasks leave Today
   and land in a DONE section instead of vanishing without a trace. Done is
   DERIVED for the auto half (never materialised — the ADR-041 philosophy) and
   covers TODAY only; a manual mark counts only for the Cairo day it was made,
   so a still-pending statement/milestone returns unchecked tomorrow — money
   never silently vanishes. */

export type TodoScope =
  | { kind: "all" } // bsystems admin · byteforce staff
  | { kind: "internal" } // bsystems internal sales (internal bucket)
  | { kind: "own"; userId: string }; // agent / partner — own leads only

/* ADR-061 dropped "prospect_follow_up" / "prospect_meeting": the partners
   funnel no longer projects onto the To-Do at all.

   ADR-068 added "negotiation_response". Founder: "make sure that the response
   date is made in the to do list as see their response or check their response
   or check with them in the negotiations." It is the SAME FollowUp record a
   plain follow-up is — same table, same id, same checkbox, same mark — read
   under its own name, because the two are different jobs: one is a call HE
   has to make, the other is an answer HE is waiting for. */
export type TodoKind =
  | "follow_up"
  | "negotiation_response"
  | "meeting"
  | "statement"
  | "milestone";

/* ADR-068 — the discriminator is the RECORD's stored context, never the lead's
   CURRENT stage. A negotiation response date belongs to the moment it was
   promised: the deal moves to Won or Lost the same afternoon it is answered,
   and a Done row that renamed itself "Follow-up" as the lead left negotiation
   would be rewriting what the person actually did today. */
function kindOfFollowUp(context: string | null): TodoKind {
  return context === "after_negotiation" ? "negotiation_response" : "follow_up";
}

export interface TodoItem {
  kind: TodoKind;
  /* ADR-062 — the UNDERLYING record's id (FollowUp / Meeting / Statement /
     Milestone). The completion checkbox posts THIS, never the lead: a new
     follow-up on the same lead is a new id and arrives unchecked. */
  recordId: string;
  at: Date;
  /* date-only records hide the clock. Follow-ups joined the date-only club
     (founder, ADR-061); ADR-063 made that per-row rather than absolute — a
     follow-up whose time the person actually CHOSE shows it again. Meetings
     always do. */
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

/* ADR-062 — what completed a Done row. `manual` is restorable (the uncheck
   deletes the mark); `auto` is not — reversing it is a CRM action, not a
   To-Do action. */
export type TodoDoneInfo =
  | { by: "manual"; name: string }
  | { by: "auto"; reason: "moved"; stage: string }
  | { by: "auto"; reason: "superseded" }
  /* attended / cancelled — the outcomes that COMPLETE a meeting. A DELAYED
     meeting is a moved task, not a completed one (SPEC §5.8): T-7 nulls the
     outcome as it writes the new datetime, so the row leaves today's window
     and returns to Today on its new date. */
  | { by: "auto"; reason: "meeting_outcome"; outcome: string }
  | { by: "auto"; reason: "statement_paid" }
  | { by: "auto"; reason: "milestone_completed" };

export interface TodoDoneItem extends TodoItem {
  done: TodoDoneInfo;
}

export interface TodoLists {
  /* ADR-061: today is the ONLY active list — the founder removed Overdue */
  today: TodoItem[];
  /* ADR-062: today's completed tasks — manual marks + derived auto-dones */
  done: TodoDoneItem[];
}

/* The midnight-DST clamp this file introduced moved to lib/datetime (ADR-071),
   because the calendar's month window needs the identical one and two copies
   of a DST correction is two chances to fix only one of them. Behaviour is
   unchanged — same body, same call sites. */

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

/* ADR-062 — the done-derivation queries need the lead's identity, ownership
   and CURRENT stage (to label "Moved to {stage}"), nothing more: liveness is
   already decided by the projection itself, so no latest-record race here. */
const DONE_LEAD_SELECT = {
  id: true,
  name: true,
  stage: true,
  ownerUserId: true,
  ownerType: true,
  owner: { select: { name: true } },
  salesRep: { select: { name: true } },
  partner: { select: { companyName: true } },
} as const;

export async function todoFor(opts: {
  brand: Brand;
  scope: TodoScope;
  now?: Date;
}): Promise<TodoLists> {
  const now = opts.now ?? new Date();
  const { start, end } = cairoDayWindow(now);
  /* ADR-067 — one merged shell, so both deep links start at /b-systems; the
     two companies keep their own SCREENS (B-Systems' lead detail lives under
     /crm/lead, ByteForce's under /leads/lead) and the row carries the company
     so a click never lands the founder on the other company's CRM.

     A bare /b-systems/... link would in fact resolve correctly today — every
     account that can see a B-Systems screen has bsystems as its default — but
     the ByteForce rows genuinely need the parameter, and a To-Do row that
     states its company is a row you can forward to somebody. */
  /* ADR-074 — the ONE lead-address table (lib/crm/surface.ts). The ternary
     here sent every MINDOO row to ByteForce's screen inside the B-Systems
     shell, which the proxy refuses for mindoo_staff: every row on Mindoo's
     To-Do logged the reader out. */
  const leadLink = (leadId: string) => leadHref(opts.brand, leadId);
  /* Statements and milestones are admin-owned subsystems. (The partnership
     CRM used to join here too — ADR-061 took its rows off the To-Do.) */
  const adminExtras = opts.brand === "bsystems" && opts.scope.kind === "all";
  const scopedLead = leadWhere(opts.brand, opts.scope);
  /* ADR-067 — the STAGES come from this company's own pipeline config, never
     from a list written out here. This projection is shared by both companies
     and the two pipelines genuinely differ: B-Systems has a negotiation stage
     and ByteForce does not. A literal ["following_up","meeting_setting",
     "negotiation"] is one pipeline's vocabulary imposed on the other — inert
     today only because no ByteForce lead can reach a stage its own config has
     never heard of, and quietly wrong the day either pipeline renames a stage. */
  const datedStages = datedStagesFor(opts.brand);
  const followUpStages = followUpStagesFor(opts.brand);
  const meetingStage = configForBrand(opts.brand).meetingStage;

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
  const [
    stagedLeads,
    todaysFollowUps,
    todaysMeetings,
    marks,
    statements,
    milestones,
    paidStatements,
    completedMilestones,
  ] = await Promise.all([
    db.lead.findMany({
      where: {
        ...scopedLead,
        stage: { in: datedStages },
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
    }),
    /* ADR-062 done-derivation sources: every follow-up DUE today and every
       arranged meeting DATED today on a scoped, unarchived lead — whichever
       of them is not live any more reads as auto-done. The `lead:` relation
       filter also drops prospect-parented records (lead null — ADR-061). */
    db.followUp.findMany({
      where: { dueAt: { gte: start, lt: end }, lead: scopedLead },
      include: { lead: { select: DONE_LEAD_SELECT } },
    }),
    db.meeting.findMany({
      where: { datetime: { gte: start, lt: end }, arranged: true, lead: scopedLead },
      include: { lead: { select: DONE_LEAD_SELECT } },
    }),
    /* the MANUAL marks (ADR-062) — valid only for the Cairo day they were
       made: tomorrow a still-pending money task returns unchecked.

       ADR-067 — and SCOPED, like everything else this projection reads. It used
       to fetch every mark made today across both companies and every owner, then
       throw away the ones it could not match. The output was right (the lookup
       is by record id), but a ByteForce To-Do was reading B-Systems marks —
       including `completedByLabel`, which is a colleague's NAME. The right rows
       leaving the database is not the same as the wrong rows never being asked
       for. The money marks join only when the money rows themselves do. */
    db.todoDone.findMany({
      where: {
        completedAt: { gte: start, lt: end },
        OR: [
          { followUp: { lead: scopedLead } },
          { meeting: { lead: scopedLead } },
          ...(adminExtras
            ? [{ statementId: { not: null } }, { milestoneId: { not: null } }]
            : []),
        ],
      },
    }),
    adminExtras
      ? db.statement.findMany({
          /* ADR-043 clarification: an archived lead's money TASKS leave the
             To-Do too (the Statements/Won Leads pages still show the records) */
          where: {
            status: "pending",
            expectedDate: { not: null, lt: end },
            milestone: { wonDeal: { lead: { archived: false } } },
          },
        })
      : [],
    adminExtras
      ? db.milestone.findMany({
          where: {
            completed: false,
            expectedEnd: { not: null, lt: end },
            wonDeal: { lead: { archived: false } },
          },
          include: { wonDeal: { select: { id: true, lead: { select: { name: true } } } } },
        })
      : [],
    /* ADR-062 — the money kinds' auto-dones: paid/completed TODAY while
       expected on the list (`expected < end`), so yesterday's payment does
       not resurface in today's Done */
    adminExtras
      ? db.statement.findMany({
          where: {
            status: "paid",
            paidAt: { gte: start, lt: end },
            expectedDate: { not: null, lt: end },
            milestone: { wonDeal: { lead: { archived: false } } },
          },
        })
      : [],
    adminExtras
      ? db.milestone.findMany({
          where: {
            completed: true,
            completedAt: { gte: start, lt: end },
            expectedEnd: { not: null, lt: end },
            wonDeal: { lead: { archived: false } },
          },
          include: { wonDeal: { select: { id: true, lead: { select: { name: true } } } } },
        })
      : [],
  ]);

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
    if (followUpStages.includes(lead.stage) && f && f.createdAt.getTime() === newest) {
      items.push({
        kind: kindOfFollowUp(f.context),
        recordId: f.id,
        at: f.dueAt,
        /* ADR-063: PER ROW now, not a constant — the clock shows only when the
           person recording the follow-up actually chose one. Blank submissions
           (the ADR-061 norm) stay a bare date. */
        withTime: f.dueTimeSet,
        title: lead.name,
        href: leadLink(lead.id),
        leadId: lead.id,
        ownerUserId: lead.ownerUserId,
        ownerName: ownerNameOf(lead),
        ownerType: lead.ownerType,
      });
    }
    if (
      lead.stage === meetingStage &&
      m &&
      m.createdAt.getTime() === newest &&
      m.arranged &&
      m.outcome === null &&
      m.datetime
    ) {
      items.push({
        kind: "meeting",
        recordId: m.id,
        at: m.datetime,
        withTime: true,
        title: lead.name,
        href: leadLink(lead.id),
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
    for (const s of statements) {
      items.push({
        kind: "statement",
        recordId: s.id,
        at: s.expectedDate!,
        withTime: false,
        title: `${s.code} — ${s.clientName}`,
        href: "/b-systems/statements",
      });
    }
    for (const ms of milestones) {
      items.push({
        kind: "milestone",
        recordId: ms.id,
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
  const live = items
    .filter((i) =>
      i.kind === "statement" || i.kind === "milestone"
        ? i.at < end
        : i.at >= start && i.at < end,
    )
    .sort(byTime);

  /* ---------------------------------------------- ADR-062: the Done section */

  /* ADR-068 — a mark is stored against the FOLLOW-UP ID, so both follow-up
     kinds look their mark up under the same key. Splitting the key by kind
     would make a negotiation row that was ticked yesterday's shape reappear
     unchecked the moment the label changed. */
  const markByKey = new Map<string, (typeof marks)[number]>();
  const markKey = (kind: TodoKind, recordId: string) =>
    `${kind === "negotiation_response" ? "follow_up" : kind}:${recordId}`;
  for (const mk of marks) {
    if (mk.followUpId) markByKey.set(`follow_up:${mk.followUpId}`, mk);
    else if (mk.meetingId) markByKey.set(`meeting:${mk.meetingId}`, mk);
    else if (mk.statementId) markByKey.set(`statement:${mk.statementId}`, mk);
    else if (mk.milestoneId) markByKey.set(`milestone:${mk.milestoneId}`, mk);
  }

  /* MANUAL: subtract marked rows from Today. A mark is honoured only while its
     dueAt snapshot equals the record's CURRENT due instant — a meeting
     rescheduled in place (same id, new datetime) therefore returns unchecked
     with zero hooks in the reschedule path. Scope is inherited: marks join
     against rows the caller's projection already produced, nothing else. */
  const today: TodoItem[] = [];
  const done: TodoDoneItem[] = [];
  const liveKeys = new Set<string>();
  for (const item of live) {
    liveKeys.add(markKey(item.kind, item.recordId));
    const mark = markByKey.get(markKey(item.kind, item.recordId));
    if (mark && mark.dueAt.getTime() === item.at.getTime()) {
      done.push({ ...item, done: { by: "manual", name: mark.completedByLabel } });
    } else {
      today.push(item);
    }
  }

  /* AUTO, derived never materialised: a record that carries TODAY's date but
     is no longer a live task was completed by CRM movement — labelled with
     what completed it. Auto wins over a stale manual mark (the CRM reason is
     the truer one, and the row must not offer a restore that cannot restore). */
  for (const f of todaysFollowUps) {
    if (!f.lead || liveKeys.has(`follow_up:${f.id}`)) continue;
    const stageMatches = followUpStages.includes(f.lead.stage);
    done.push({
      kind: kindOfFollowUp(f.context),
      recordId: f.id,
      at: f.dueAt,
      withTime: f.dueTimeSet, // ADR-063 — the Done row reads like its Today twin
      title: f.lead.name,
      href: leadLink(f.lead.id),
      leadId: f.lead.id,
      ownerUserId: f.lead.ownerUserId,
      ownerName: ownerNameOf(f.lead),
      ownerType: f.lead.ownerType,
      done: stageMatches
        ? { by: "auto", reason: "superseded" }
        : { by: "auto", reason: "moved", stage: f.lead.stage },
    });
  }
  for (const m of todaysMeetings) {
    if (!m.lead || !m.datetime || liveKeys.has(`meeting:${m.id}`)) continue;
    done.push({
      kind: "meeting",
      recordId: m.id,
      at: m.datetime,
      withTime: true,
      title: m.lead.name,
      href: leadLink(m.lead.id),
      leadId: m.lead.id,
      ownerUserId: m.lead.ownerUserId,
      ownerName: ownerNameOf(m.lead),
      ownerType: m.lead.ownerType,
      done:
        m.outcome !== null
          ? { by: "auto", reason: "meeting_outcome", outcome: m.outcome }
          : m.lead.stage !== meetingStage
            ? { by: "auto", reason: "moved", stage: m.lead.stage }
            : { by: "auto", reason: "superseded" },
    });
  }
  for (const s of paidStatements) {
    done.push({
      kind: "statement",
      recordId: s.id,
      at: s.expectedDate!,
      withTime: false,
      title: `${s.code} — ${s.clientName}`,
      href: "/b-systems/statements",
      done: { by: "auto", reason: "statement_paid" },
    });
  }
  for (const ms of completedMilestones) {
    done.push({
      kind: "milestone",
      recordId: ms.id,
      at: ms.expectedEnd!,
      withTime: false,
      title: `${ms.wonDeal.lead.name}${ms.label ? ` — ${ms.label}` : ""}`,
      href: `/b-systems/won-leads/${ms.wonDeal.id}`,
      done: { by: "auto", reason: "milestone_completed" },
    });
  }

  return { today, done: done.sort(byTime) };
}
