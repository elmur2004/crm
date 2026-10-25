import { db } from "@/lib/db";
import { leadHref } from "@/lib/crm/surface";
import { LEAD_TYPES, type Brand } from "@/lib/pipeline-engine/constants";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import {
  inPeriod,
  monthPeriod,
  periodPair,
  type Period,
  type PeriodPair,
  type RangeKey,
} from "@/lib/dashboard/periods";
import { countDelta, rateDelta, type Delta, type Rate } from "@/lib/dashboard/delta";
import { internalDashboard, wonRecordFor, type InternalDashboard } from "./metrics";
import { adminExternal, type AdminExternal } from "./bsystems-admin";
import { leadScopeWhere, ownerNameOf, todoFor, type TodoItem, type TodoScope } from "./todo";

/* ============================================================================
   The Home — ONE service call, `dashboardFor`, for both companies.

   THE WALL. Every lead predicate here is `leadScopeWhere(brand, scope)` — the
   To-Do's and the daily report's own three branches of `requireLeadAccess` —
   and none writes an owner filter of its own (dashboard spec §2.3). The money
   records (WonInfo, WonDeal, Client, Milestone) are reached THROUGH their lead,
   so they inherit the same wall. Under ByteForce the agent / partner roster,
   the "Needs you" card (ready-to-close, registrations) and the milestone money
   are never computed at all — not hidden, absent. (The shared lead selects
   still name the partner and WonDeal relations, through the scoped lead; for a
   ByteForce lead they are always empty.)

   THE ARCHIVE (ADR-043) leaves every lead-based number, and — D7 is NOT
   changed in this round — the money of an archived won deal leaves the period
   figures too, exactly as it leaves the all-time Won value in metrics.ts. The
   activity feed is the one exception (archived leads stay, badged), matching
   the daily report (ADR-081): it is history, not a figure.

   THE WON RECORD is the one metrics.ts reads (ADR-089): WonDeal for B-Systems
   (a pre-V2 win keeps its legacy WonInfo), WonInfo for ByteForce — and its
   `createdAt` is the won-date (D15: `WonDeal.createdAt`, never the back-datable
   contract date). Both are written in the same transaction as the lead's
   `stage_change → won` row, so the KPI, the trend and the history agree.

   THE LOST-DATE is the newest LostInfo of a lead whose CURRENT stage is lost.
   Lost is terminal, and undoing a Lost move deletes its LostInfo, so an undone
   loss leaves no trace here.
   ========================================================================== */

export interface DashboardInput {
  brand: Brand;
  scope: TodoScope;
  range: RangeKey;
  now?: Date;
}

export interface KpiWon {
  value: number; // piasters
  count: number;
  prevValue: number;
  prevCount: number;
  delta: Delta;
  /** won value per trend month, oldest first */
  spark: number[];
}

export interface KpiNewLeads {
  value: number;
  prev: number;
  delta: Delta;
  spark: number[];
}

export interface KpiWinRate {
  cur: Rate;
  prev: Rate;
  delta: Delta;
}

export interface KpiPipeline {
  value: number;
  openCount: number;
  parkedValue: number;
  parkedCount: number;
  byStage: Array<{ stage: string; value: number }>;
}

export interface FunnelStep {
  /** "added" for the cohort, else the stage id */
  key: string;
  count: number;
}

export interface SourceRow {
  type: string;
  count: number;
}

export interface TrendPoint {
  month: string; // "YYYY-MM"
  won: number;
  lost: number;
}

export interface TeamRow {
  key: string;
  /** null = the genuinely unassigned internal bucket */
  name: string | null;
  newCount: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  openCount: number;
}

export interface RecentWin {
  id: string;
  leadId: string;
  name: string;
  company: string | null;
  value: number;
  wonAt: Date;
  contractDate: Date | null;
  owner: string | null;
  href: string;
  status:
    | { kind: "collect"; toBeCollected: number; dueDate: Date | null }
    | { kind: "paid" }
    | { kind: "milestone"; current: number; total: number }
    | { kind: "milestones_done"; total: number }
    | { kind: "no_milestones" };
}

export interface ActivityRow {
  id: string;
  at: Date;
  actorLabel: string;
  action: string;
  trigger: string;
  fromStage: string | null;
  toStage: string | null;
  lead: { id: string; name: string; archived: boolean };
}

export interface NeedsYou {
  readyToClose: { count: number; leads: Array<{ id: string; name: string }> };
  pendingRegistrations: number;
}

export interface DashboardData {
  brand: Brand;
  scope: TodoScope;
  period: PeriodPair;
  now: Date;
  snapshot: InternalDashboard;
  kpis: { won: KpiWon; newLeads: KpiNewLeads; winRate: KpiWinRate; pipeline: KpiPipeline };
  funnel: FunnelStep[];
  sources: SourceRow[];
  /** B-Systems only — leads in the cohort a partner referred (§5.5) */
  partnerReferred: number | null;
  trend: TrendPoint[];
  /** null when the reader gets no team card (agents and partners: a team of one) */
  team: TeamRow[] | null;
  recentWins: RecentWin[];
  activity: ActivityRow[];
  tasks: { today: TodoItem[]; todayCount: number; doneCount: number };
  /** B-Systems admin only */
  external: AdminExternal | null;
  /** B-Systems admin only */
  needsYou: NeedsYou | null;
}

/** How many task rows the Home lists before "more on the To-Do". */
export const HOME_TASK_ROWS = 6;
/** How many activity rows the feed shows (§W13). */
export const ACTIVITY_ROWS = 8;
/** lead ids per activity query — well under any driver's bind limit */
const ACTIVITY_ID_CHUNK = 2_000;
const RECENT_WINS = 5;

type Bucketed = { at: Date; value: number };

function sumIn(events: Bucketed[], p: Period): { value: number; count: number } {
  let value = 0;
  let count = 0;
  for (const e of events) {
    if (inPeriod(e.at, p)) {
      value += e.value;
      count += 1;
    }
  }
  return { value, count };
}

export async function dashboardFor(input: DashboardInput): Promise<DashboardData> {
  const { brand, scope, range } = input;
  const now = input.now ?? new Date();
  const period = periodPair(range, now);
  const config = configForBrand(brand);
  const scoped = leadScopeWhere(brand, scope);
  const isAdminBs = brand === "bsystems" && scope.kind === "all";
  const months = period.trendMonths.map(monthPeriod);

  const [snapshot, leads, tasks, external, needsYou, activity] = await Promise.all([
    internalDashboard(brand, scope),
    /* the lead FACTS every period figure is computed from — one read, so the
       KPIs, the funnel cohort, the sources, the trend and the team table are
       all counted over the same rows */
    db.lead.findMany({
      where: { ...scoped, archived: false },
      select: {
        id: true,
        type: true,
        source: true,
        stage: true,
        createdAt: true,
        ownerUserId: true,
        salesRepId: true,
        partnerId: true,
        owner: { select: { name: true } },
        salesRep: { select: { name: true } },
        partner: { select: { companyName: true } },
        wonInfo: { select: { createdAt: true, estimatedValue: true } },
        wonDeal: { select: { createdAt: true, estimatedValue: true } },
        lostInfo: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    todoFor({ brand, scope, now }),
    isAdminBs ? adminExternal(brand) : Promise.resolve(null),
    isAdminBs ? needsYouFor(brand, scope) : Promise.resolve(null),
    activityFor(brand, scope),
  ]);

  /* ---- won / lost events, one per lead (the metrics.ts record rule) */
  const record = wonRecordFor(brand);
  const wonAt = new Map<string, Bucketed>();
  const lostAt = new Map<string, Date>();
  for (const lead of leads) {
    if (lead.stage === config.wonStage) {
      /* the value rule is metrics.ts's, field by field (a WonDeal with no value
         falls back to a legacy WonInfo value, then 0); the DATE is the record
         that confirmed the win */
      const r = record === "wonDeal" ? (lead.wonDeal ?? lead.wonInfo) : lead.wonInfo;
      const value =
        record === "wonDeal"
          ? (lead.wonDeal?.estimatedValue ?? lead.wonInfo?.estimatedValue ?? 0)
          : (lead.wonInfo?.estimatedValue ?? 0);
      if (r) wonAt.set(lead.id, { at: r.createdAt, value });
    } else if (lead.stage === config.lostStage && lead.lostInfo[0]) {
      lostAt.set(lead.id, lead.lostInfo[0].createdAt);
    }
  }
  const wonEvents = [...wonAt.values()];
  const lostEvents = [...lostAt.values()].map((at) => ({ at, value: 0 }));
  const created = leads.map((l) => ({ at: l.createdAt, value: 1 }));

  /* ---- K1 · K2 · K3 */
  const wonCur = sumIn(wonEvents, period.current);
  const wonPrev = sumIn(wonEvents, period.previous);
  const lostCur = sumIn(lostEvents, period.current).count;
  const lostPrev = sumIn(lostEvents, period.previous).count;
  const newCur = sumIn(created, period.current).count;
  const newPrev = sumIn(created, period.previous).count;

  const kpis: DashboardData["kpis"] = {
    won: {
      value: wonCur.value,
      count: wonCur.count,
      prevValue: wonPrev.value,
      prevCount: wonPrev.count,
      delta: countDelta(wonCur.value, wonPrev.value),
      spark: months.map((m) => sumIn(wonEvents, m).value),
    },
    newLeads: {
      value: newCur,
      prev: newPrev,
      delta: countDelta(newCur, newPrev),
      spark: months.map((m) => sumIn(created, m).count),
    },
    winRate: {
      cur: { won: wonCur.count, lost: lostCur },
      prev: { won: wonPrev.count, lost: lostPrev },
      delta: rateDelta({ won: wonCur.count, lost: lostCur }, { won: wonPrev.count, lost: lostPrev }),
    },
    pipeline: {
      value: snapshot.pipelineValue,
      openCount: snapshot.openCount,
      parkedValue: snapshot.parkedValue,
      parkedCount: snapshot.parkedCount,
      byStage: Object.entries(snapshot.pipelineByStage).map(([stage, value]) => ({ stage, value })),
    },
  };

  /* ---- W11: win rate per Cairo month, same definitions as K3 */
  const trend: TrendPoint[] = months.map((m, i) => ({
    month: period.trendMonths[i]!,
    won: sumIn(wonEvents, m).count,
    lost: sumIn(lostEvents, m).count,
  }));

  /* ---- the cohort: leads ADDED in the period (W6, W7) */
  const cohort = leads.filter((l) => inPeriod(l.createdAt, period.current));

  /* W7 — all five lead types, zero rows kept, ranked by count (0-rows last,
     then in the LEAD_TYPES order, which is stable) */
  const sources: SourceRow[] = LEAD_TYPES.map((type) => ({
    type,
    count: cohort.filter((l) => l.type === type).length,
  }));
  /* a type outside the list (legacy data) still counts, never vanishes */
  for (const l of cohort) {
    if (!(LEAD_TYPES as readonly string[]).includes(l.type) && !sources.some((s) => s.type === l.type)) {
      sources.push({ type: l.type, count: cohort.filter((c) => c.type === l.type).length });
    }
  }
  sources.sort((a, b) => b.count - a.count);
  const partnerReferred =
    brand === "bsystems" ? cohort.filter((l) => l.source === "partner").length : null;

  /* W6 — the cohort funnel: "got at least this far". The steps are the
     company's own progress stages, from its config (never a hand list — that
     is how Negotiation went missing from the old Home). */
  const steps = [
    config.followUpStage,
    config.meetingStage,
    config.proposalStage,
    config.negotiationStage,
    config.wonStage,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  const stepIndex = new Map(steps.map((s, i) => [s, i + 1]));
  const rank = new Map<string, number>(cohort.map((l) => [l.id, stepIndex.get(l.stage) ?? 0]));
  if (cohort.length > 0) {
    const moves = await db.activityLog.findMany({
      where: {
        entityType: "lead",
        entityId: { in: cohort.map((l) => l.id) },
        action: { in: ["stage_change", "auto_transfer"] },
        toStage: { in: steps },
      },
      select: { entityId: true, toStage: true },
    });
    for (const m of moves) {
      /* Won is terminal: a lead counts at the Won step only if it IS won now,
         so the funnel can never claim a win the Won KPI on the same screen does
         not (an undone move leaves its stage_change row behind — the earlier
         steps still carry that known overcount, pinned in the tests) */
      if (m.toStage === config.wonStage) continue;
      const r = stepIndex.get(m.toStage ?? "") ?? 0;
      if (r > (rank.get(m.entityId) ?? 0)) rank.set(m.entityId, r);
    }
  }
  const funnel: FunnelStep[] = [
    { key: "added", count: cohort.length },
    ...steps.map((stage, i) => ({
      key: stage,
      count: cohort.filter((l) => (rank.get(l.id) ?? 0) >= i + 1).length,
    })),
  ];

  /* ---- W12: the team, credited to each lead's CURRENT owner. Agents and
     partners get no card (a team of one is noise). */
  let team: TeamRow[] | null = null;
  if (scope.kind !== "own") {
    const rows = new Map<string, TeamRow>();
    const rowFor = (l: (typeof leads)[number]) => {
      const key = l.ownerUserId
        ? `user:${l.ownerUserId}`
        : l.salesRepId
          ? `rep:${l.salesRepId}`
          : l.partnerId
            ? `partner:${l.partnerId}`
            : "unassigned";
      let row = rows.get(key);
      if (!row) {
        row = { key, name: ownerNameOf(l), newCount: 0, wonCount: 0, wonValue: 0, lostCount: 0, openCount: 0 };
        rows.set(key, row);
      }
      return row;
    };
    for (const l of leads) {
      const isNew = inPeriod(l.createdAt, period.current);
      const won = wonAt.get(l.id);
      const wonNow = won && inPeriod(won.at, period.current);
      const lostNow = inPeriod(lostAt.get(l.id), period.current);
      const open = l.stage !== config.wonStage && l.stage !== config.lostStage;
      if (!isNew && !wonNow && !lostNow && !open) continue;
      const row = rowFor(l);
      if (isNew) row.newCount += 1;
      if (wonNow) {
        row.wonCount += 1;
        row.wonValue += won.value;
      }
      if (lostNow) row.lostCount += 1;
      if (open) row.openCount += 1;
    }
    team = [...rows.values()].sort(
      (a, b) =>
        b.wonValue - a.wonValue ||
        b.newCount - a.newCount ||
        (a.name ?? "￿").localeCompare(b.name ?? "￿"),
    );
  }

  const recentWins = await recentWinsFor(brand, scope, period.current);

  return {
    brand,
    scope,
    period,
    now,
    snapshot,
    kpis,
    funnel,
    sources,
    partnerReferred,
    trend,
    team,
    recentWins,
    activity,
    tasks: {
      today: tasks.today.slice(0, HOME_TASK_ROWS),
      todayCount: tasks.today.length,
      doneCount: tasks.done.length,
    },
    external,
    needsYou,
  };
}

/* ---------------------------------------------------------------- W9 */

async function needsYouFor(brand: Brand, scope: TodoScope): Promise<NeedsYou> {
  const config = configForBrand(brand);
  const where = {
    ...leadScopeWhere(brand, scope),
    archived: false,
    readyToClose: true,
    stage: { notIn: [config.wonStage, config.lostStage] },
  };
  const [count, leads, pendingRegistrations] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({ where, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 5 }),
    /* the Registrations page's own "Awaiting approval" set */
    db.user.count({ where: { registrationStatus: "pending" } }),
  ]);
  return { readyToClose: { count, leads }, pendingRegistrations };
}

/* ---------------------------------------------------------------- W10 */

const OWNER_SELECT = {
  owner: { select: { name: true } },
  salesRep: { select: { name: true } },
  partner: { select: { companyName: true } },
} as const;

async function recentWinsFor(brand: Brand, scope: TodoScope, p: Period): Promise<RecentWin[]> {
  const leadWhere = { ...leadScopeWhere(brand, scope), archived: false, stage: configForBrand(brand).wonStage };
  const createdAt = { gte: p.start, lt: p.end };
  if (wonRecordFor(brand) === "wonDeal") {
    /* No commission is read: the Home never shows one (V2 §4 hides it from
       sales, and on the admin's Home it is not a KPI). */
    const deals = await db.wonDeal.findMany({
      where: { createdAt, lead: leadWhere },
      select: {
        id: true,
        createdAt: true,
        estimatedValue: true,
        contractDate: true,
        lead: { select: { id: true, name: true, companyName: true, ...OWNER_SELECT } },
        milestones: { select: { index: true, completed: true }, orderBy: { index: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_WINS,
    });
    /* a pre-V2 win (WonInfo, no WonDeal) counts in the Won KPI (ADR-089), so
       it is listed here too when it falls in the period */
    const legacy = await db.wonInfo.findMany({
      where: { createdAt, lead: { ...leadWhere, wonDeal: { is: null } } },
      select: {
        id: true,
        createdAt: true,
        estimatedValue: true,
        lead: { select: { id: true, name: true, companyName: true, ...OWNER_SELECT } },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_WINS,
    });
    const legacyRows: RecentWin[] = legacy.map((w) => ({
      id: w.id,
      leadId: w.lead.id,
      name: w.lead.name,
      company: w.lead.companyName,
      value: w.estimatedValue,
      wonAt: w.createdAt,
      contractDate: null,
      owner: ownerNameOf(w.lead),
      href: leadHref(brand, w.lead.id),
      status: { kind: "no_milestones" },
    }));
    const dealRows: RecentWin[] = deals.map((d) => {
      const total = d.milestones.length;
      const next = d.milestones.find((m) => !m.completed);
      return {
        id: d.id,
        leadId: d.lead.id,
        name: d.lead.name,
        company: d.lead.companyName,
        value: d.estimatedValue ?? 0,
        wonAt: d.createdAt,
        contractDate: d.contractDate,
        owner: ownerNameOf(d.lead),
        href: `/b-systems/won-leads/${d.id}`,
        status:
          total === 0
            ? { kind: "no_milestones" }
            : next
              ? { kind: "milestone", current: next.index, total }
              : { kind: "milestones_done", total },
      } satisfies RecentWin;
    });
    return [...dealRows, ...legacyRows]
      .sort((a, b) => b.wonAt.getTime() - a.wonAt.getTime())
      .slice(0, RECENT_WINS);
  }
  const wins = await db.wonInfo.findMany({
    where: { createdAt, lead: leadWhere },
    select: {
      id: true,
      createdAt: true,
      estimatedValue: true,
      lead: {
        select: {
          id: true,
          name: true,
          companyName: true,
          ...OWNER_SELECT,
          client: { select: { toBeCollected: true, dueDate: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: RECENT_WINS,
  });
  return wins.map((w) => {
    const owed = w.lead.client?.toBeCollected ?? 0;
    return {
      id: w.id,
      leadId: w.lead.id,
      name: w.lead.name,
      company: w.lead.companyName,
      value: w.estimatedValue,
      wonAt: w.createdAt,
      contractDate: null,
      owner: ownerNameOf(w.lead),
      href: leadHref(brand, w.lead.id),
      status:
        owed > 0
          ? { kind: "collect", toBeCollected: owed, dueDate: w.lead.client?.dueDate ?? null }
          : { kind: "paid" },
    } satisfies RecentWin;
  });
}

/* ---------------------------------------------------------------- W13 */

/** The newest lead history rows this reader may see — the union of the
    History panels they can already open, so it widens nothing.

    THE WALL IS IN THE QUERY. ActivityLog carries no brand and no owner, so the
    reader's leads are read FIRST, through `leadScopeWhere` (archived leads
    included — they stay in the feed, badged, as in the daily report, ADR-081),
    and only their rows are asked for. Another company's history — and its
    actors' names — never leaves the database (ADR-067's lesson, said of the
    To-Do marks: the right rows leaving is not the same as the wrong rows never
    being asked for). A deleted lead has no row, so its history drops out.

    The id list is chunked so a very large book cannot exceed the driver's bind
    limit; each chunk returns its own newest few and the merge keeps the newest
    overall. Newest-first over [entityType, entityId] is served per id by the
    existing [entityType, entityId, createdAt] index; an [entityType, createdAt]
    index is a listed follow-up (no migration this round). */
async function activityFor(brand: Brand, scope: TodoScope): Promise<ActivityRow[]> {
  const leads = await db.lead.findMany({
    where: leadScopeWhere(brand, scope),
    select: { id: true, name: true, archived: true },
  });
  if (leads.length === 0) return [];
  const byId = new Map(leads.map((l) => [l.id, l]));
  const ids = leads.map((l) => l.id);
  const rows: Array<{
    id: string;
    entityId: string;
    createdAt: Date;
    actorLabel: string;
    action: string;
    trigger: string;
    fromStage: string | null;
    toStage: string | null;
  }> = [];
  for (let i = 0; i < ids.length; i += ACTIVITY_ID_CHUNK) {
    rows.push(
      ...(await db.activityLog.findMany({
        where: { entityType: "lead", entityId: { in: ids.slice(i, i + ACTIVITY_ID_CHUNK) } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: ACTIVITY_ROWS,
        select: {
          id: true,
          entityId: true,
          createdAt: true,
          actorLabel: true,
          action: true,
          trigger: true,
          fromStage: true,
          toStage: true,
        },
      })),
    );
  }
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
  return rows.slice(0, ACTIVITY_ROWS).map((row) => ({
    id: row.id,
    at: row.createdAt,
    actorLabel: row.actorLabel,
    action: row.action,
    trigger: row.trigger,
    fromStage: row.fromStage,
    toStage: row.toStage,
    lead: byId.get(row.entityId)!,
  }));
}
