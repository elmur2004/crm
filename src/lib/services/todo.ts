import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { cairoToUtc, utcToCairo } from "@/lib/datetime";

/* Founder (ADR-041) — the To-Do page: "the actual date of today with the
   entire tasks of today... just a way of representing what I have to do today,
   no fancy stuff, so I don't miss anything." A read-only projection over the
   records that already carry dates — no new state. An item is LIVE when it is
   its lead's/prospect's LATEST record AND the parent still sits in the
   matching stage (exactly what the boards' key datum shows) — superseded
   history never resurfaces. Overdue = live items dated before today. */

export type TodoScope =
  | { kind: "all" } // bsystems admin · byteforce staff
  | { kind: "internal" } // bsystems internal sales (internal bucket)
  | { kind: "own"; userId: string }; // agent / partner — own leads only

export type TodoKind =
  | "follow_up"
  | "meeting"
  | "prospect_follow_up"
  | "prospect_meeting"
  | "statement"
  | "milestone";

export interface TodoItem {
  kind: TodoKind;
  at: Date;
  withTime: boolean; // date-only records (statements/milestones) hide the clock
  title: string;
  href: string;
}

export interface TodoLists {
  today: TodoItem[];
  overdue: TodoItem[];
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
  return { start: cairoToUtc(date, "00:00"), end: cairoToUtc(nextDate, "00:00") };
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
  /* Partnership CRM, statements, and milestones are admin-owned subsystems. */
  const adminExtras = opts.brand === "bsystems" && opts.scope.kind === "all";

  const [followUps, meetings] = await Promise.all([
    db.followUp.findMany({
      where: { lead: { is: { ...leadWhere(opts.brand, opts.scope), stage: "following_up" } } },
      orderBy: [{ leadId: "asc" }, { createdAt: "desc" }],
      distinct: ["leadId"],
      include: { lead: { select: { id: true, name: true } } },
    }),
    db.meeting.findMany({
      where: {
        arranged: true,
        outcome: null,
        datetime: { not: null },
        lead: { is: { ...leadWhere(opts.brand, opts.scope), stage: "meeting_setting" } },
      },
      orderBy: [{ leadId: "asc" }, { createdAt: "desc" }],
      distinct: ["leadId"],
      include: { lead: { select: { id: true, name: true } } },
    }),
  ]);

  const items: TodoItem[] = [];
  for (const f of followUps) {
    items.push({
      kind: "follow_up",
      at: f.dueAt,
      withTime: true,
      title: f.lead!.name,
      href: `${leadBase}/${f.lead!.id}`,
    });
  }
  for (const m of meetings) {
    items.push({
      kind: "meeting",
      at: m.datetime!,
      withTime: true,
      title: m.lead!.name,
      href: `${leadBase}/${m.lead!.id}`,
    });
  }

  if (adminExtras) {
    const [pFollowUps, pMeetings, statements, milestones] = await Promise.all([
      db.followUp.findMany({
        where: { prospect: { is: { stage: "following_up" } } },
        orderBy: [{ partnerProspectId: "asc" }, { createdAt: "desc" }],
        distinct: ["partnerProspectId"],
        include: { prospect: { select: { id: true, companyName: true } } },
      }),
      db.meeting.findMany({
        where: {
          arranged: true,
          outcome: null,
          datetime: { not: null },
          prospect: { is: { stage: "meeting_setting" } },
        },
        orderBy: [{ partnerProspectId: "asc" }, { createdAt: "desc" }],
        distinct: ["partnerProspectId"],
        include: { prospect: { select: { id: true, companyName: true } } },
      }),
      db.statement.findMany({
        where: { status: "pending", expectedDate: { not: null, lt: end } },
      }),
      db.milestone.findMany({
        where: { completed: false, expectedEnd: { not: null, lt: end } },
        include: { wonDeal: { select: { id: true, lead: { select: { name: true } } } } },
      }),
    ]);
    for (const f of pFollowUps) {
      items.push({
        kind: "prospect_follow_up",
        at: f.dueAt,
        withTime: true,
        title: f.prospect!.companyName,
        href: `/b-systems/partners-pipeline/${f.prospect!.id}`,
      });
    }
    for (const m of pMeetings) {
      items.push({
        kind: "prospect_meeting",
        at: m.datetime!,
        withTime: true,
        title: m.prospect!.companyName,
        href: `/b-systems/partners-pipeline/${m.prospect!.id}`,
      });
    }
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
  return {
    today: items.filter((i) => i.at >= start && i.at < end).sort(byTime),
    overdue: items.filter((i) => i.at < start).sort(byTime),
  };
}
