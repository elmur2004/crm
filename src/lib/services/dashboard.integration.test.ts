import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc } from "@/lib/datetime";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { ratePct } from "@/lib/dashboard/delta";
import { applyLeadEvent, setArchived } from "./leads";
import { performUndo } from "./undo";
import { dashboardFor, type DashboardData } from "./dashboard";
import type { TodoScope } from "./todo";
import type { Actor } from "./activity";

/* ============================================================================
   The Home, against a fixture with KNOWN numbers (dashboard spec §9.4).

   ONE database holds both companies, so every "never leaks" assertion is made
   against rows that really exist on the other side of the wall. Every instant
   is written as Cairo-local through `cairoToUtc`, and the history rows for
   every move are written too, so the funnel reads real history.

   NOW = Sun 25 Oct 2026 13:00 Cairo, range mtd: current 1–25 Oct, previous
   1–25 Sep. Money is piasters (EGP × 100).
   ========================================================================== */

process.env.AUTH_SECRET ??= "vitest-secret";

const NOW = cairoToUtc("2026-10-25", "13:00");
const EGP = (n: number) => n * 100;
const at = (date: string, time = "12:00") => cairoToUtc(date, time);

type World = Awaited<ReturnType<typeof dashboardWorld>>;

let seq = 0;
async function user(name: string, roles: string[], extra: Record<string, unknown> = {}) {
  seq += 1;
  const u = await db.user.create({
    data: { name, phone: `+2010777${String(10_000 + seq)}`, passwordHash: "x", ...extra },
  });
  for (const role of roles) await db.userRole.create({ data: { userId: u.id, role } });
  return u;
}

async function log(leadId: string, createdAt: Date, action: string, from: string | null, to: string | null, trigger: string) {
  await db.activityLog.create({
    data: {
      entityType: "lead",
      entityId: leadId,
      actorLabel: "Fixture",
      action,
      fromStage: from,
      toStage: to,
      trigger,
      createdAt,
    },
  });
}

interface LeadSpec {
  brand: Brand;
  name: string;
  created: Date;
  type: string;
  path: string[]; // stages visited, in order, starting with "new"
  ownerType?: string;
  ownerUserId?: string | null;
  salesRepId?: string | null;
  partnerId?: string | null;
  source?: string;
  archived?: boolean;
  readyToClose?: boolean;
}

async function lead(spec: LeadSpec) {
  seq += 1;
  const stage = spec.path[spec.path.length - 1]!;
  const row = await db.lead.create({
    data: {
      brand: spec.brand,
      name: spec.name,
      number: `0106${String(100_000 + seq)}`,
      type: spec.type,
      stage,
      ownerType: spec.ownerType ?? "internal",
      ownerUserId: spec.ownerUserId ?? null,
      salesRepId: spec.salesRepId ?? null,
      partnerId: spec.partnerId ?? null,
      source: spec.source ?? "direct",
      archived: spec.archived ?? false,
      archivedAt: spec.archived ? spec.created : null,
      readyToClose: spec.readyToClose ?? false,
      createdAt: spec.created,
    },
  });
  await log(row.id, spec.created, "create", null, "new", "create");
  for (let i = 1; i < spec.path.length; i++) {
    const when = new Date(spec.created.getTime() + i * 60 * 60 * 1000);
    await log(row.id, when, "stage_change", spec.path[i - 1]!, spec.path[i]!, "T-1");
  }
  return row;
}

async function proposal(leadId: string, value: number, createdAt: Date) {
  await db.proposal.create({ data: { leadId, service: "Service", estimatedValue: value, createdAt } });
}

async function wonDeal(leadId: string, value: number, createdAt: Date, milestones: Array<[number, boolean]>) {
  return db.wonDeal.create({
    data: {
      leadId,
      estimatedValue: value,
      totalCommissionPercent: 10_00,
      contractDate: createdAt,
      createdAt,
      milestones: {
        create: milestones.map(([v, done], i) => ({
          index: i + 1,
          label: `M${i + 1}`,
          value: v,
          commissionValue: Math.round(v / 10),
          completed: done,
          completedAt: done ? createdAt : null,
        })),
      },
    },
  });
}

async function lost(leadId: string, createdAt: Date) {
  await db.lostInfo.create({ data: { leadId, reason: "Budget", createdAt } });
}

async function dashboardWorld() {
  /* ---- people */
  const admin = await user("Amal Admin", ["bsystems_admin"]);
  const g1 = await user("Gamal Agent", ["bsystems_agent"]);
  const g2 = await user("Ghada Agent", ["bsystems_agent"]);
  const g3 = await user("Gina Pending", ["bsystems_agent"], { registrationStatus: "pending" });
  const p1User = await user("Prime Partners", ["bsystems_partner"]);
  const prospect = await db.partnerProspect.create({
    data: { name: "Key Person", companyName: "Prime Partners", number: "0223330001", stage: "qualified", converted: true },
  });
  const p1 = await db.partner.create({
    data: {
      prospectId: prospect.id,
      userId: p1User.id,
      companyName: "Prime Partners",
      keyPersonName: "Key Person",
      keyPersonRole: "CEO",
      address: "1 St",
      number: "0223330001",
      businessActivity: "Consulting",
      importance: "high",
    },
  });
  const r3 = await db.salesRep.create({ data: { brand: "bsystems", name: "Nour" } });
  const r1 = await db.salesRep.create({ data: { brand: "byteforce", name: "Laila" } });
  const r2 = await db.salesRep.create({ data: { brand: "byteforce", name: "Ahmed" } });

  /* ---- B-Systems */
  const bs = "bsystems" as const;
  const agent = (u: { id: string }) => ({ ownerType: "agent", ownerUserId: u.id });
  const b1 = await lead({ brand: bs, name: "BS1 Boundary Co", created: at("2026-10-01", "00:30"), type: "cold_call", path: ["new", "following_up"], salesRepId: r3.id });
  const b2 = await lead({ brand: bs, name: "BS2 Proposal Co", created: at("2026-10-05"), type: "campaign_lead", path: ["new", "sending_proposal"], salesRepId: r3.id });
  const b3 = await lead({ brand: bs, name: "BS3 Negotiation Co", created: at("2026-10-10"), type: "personal_connection", path: ["new", "meeting_setting", "sending_proposal", "negotiation"], ...agent(g1), readyToClose: true });
  const b4 = await lead({ brand: bs, name: "BS4 Winner Co", created: at("2026-10-12"), type: "cold_call", path: ["new", "following_up", "meeting_setting", "won"], ...agent(g1) });
  const b5 = await lead({ brand: bs, name: "BS5 Lost Co", created: at("2026-10-15"), type: "event_data", path: ["new", "meeting_setting", "lost"], ...agent(g2) });
  const b6 = await lead({ brand: bs, name: "BS6 Parked Co", created: at("2026-10-20"), type: "organic", path: ["new", "sending_proposal", "postponed"], ownerType: "partner", ownerUserId: p1User.id, partnerId: p1.id, source: "partner" });
  const b7 = await lead({ brand: bs, name: "BS7 September Win", created: at("2026-09-08"), type: "cold_call", path: ["new", "sending_proposal", "won"], salesRepId: r3.id });
  const b8 = await lead({ brand: bs, name: "BS8 Admin Bucket", created: at("2026-09-10"), type: "campaign_lead", path: ["new", "lost"], ownerType: "admin" });
  const b9 = await lead({ brand: bs, name: "BS9 September Loss", created: at("2026-09-12"), type: "personal_connection", path: ["new", "following_up", "lost"], salesRepId: r3.id });
  const b10 = await lead({ brand: bs, name: "BS10 Archived Co", created: at("2026-10-22"), type: "cold_call", path: ["new"], salesRepId: r3.id, archived: true });

  await proposal(b2.id, EGP(100_000), at("2026-10-05", "15:00"));
  await proposal(b3.id, EGP(50_000), at("2026-10-10", "15:00"));
  await proposal(b3.id, EGP(80_000), at("2026-10-12", "15:00")); // ADR-012: the latest wins
  await proposal(b6.id, EGP(30_000), at("2026-10-20", "15:00"));
  await wonDeal(b4.id, EGP(200_000), at("2026-10-20"), [[EGP(120_000), true], [EGP(80_000), false]]);
  await lost(b5.id, at("2026-10-18"));
  await wonDeal(b7.id, EGP(150_000), at("2026-09-20"), [[EGP(150_000), true]]);
  await lost(b8.id, at("2026-09-22"));
  await lost(b9.id, at("2026-09-24"));
  /* a task due today on b1 (the internal bucket) — the To-Do projection, unchanged */
  await db.followUp.create({
    data: { leadId: b1.id, context: "initial", dueAt: at("2026-10-25", "10:00"), dueTimeSet: true, method: "call", createdAt: at("2026-10-01", "02:00") },
  });

  /* ---- ByteForce */
  const bf = "byteforce" as const;
  const f1 = await lead({ brand: bf, name: "BF1 Follow Co", created: at("2026-10-02"), type: "cold_call", path: ["new", "following_up"], salesRepId: r1.id });
  const f2 = await lead({ brand: bf, name: "BF2 Winner Co", created: at("2026-10-06"), type: "personal_connection", path: ["new", "sending_proposal", "won"], salesRepId: r1.id });
  const f3 = await lead({ brand: bf, name: "BF3 Lost Co", created: at("2026-10-09"), type: "event_data", path: ["new", "meeting_setting", "lost"], salesRepId: r2.id });
  const f4 = await lead({ brand: bf, name: "BF4 Proposal Co", created: at("2026-09-05"), type: "campaign_lead", path: ["new", "sending_proposal"], salesRepId: r2.id });
  const f5 = await lead({ brand: bf, name: "BF5 Late Sep Win", created: at("2026-09-15"), type: "cold_call", path: ["new", "won"], salesRepId: r1.id });
  const f6 = await lead({ brand: bf, name: "BF6 Parked Co", created: at("2026-09-28"), type: "organic", path: ["new", "postponed"], salesRepId: r2.id });

  await proposal(f2.id, EGP(50_000), at("2026-10-06", "15:00"));
  await db.wonInfo.create({ data: { leadId: f2.id, estimatedValue: EGP(50_000), technicalOwner: "T", collectedAmount: EGP(20_000), createdAt: at("2026-10-14") } });
  await db.client.create({ data: { brand: bf, leadId: f2.id, name: f2.name, number: f2.number, estimatedValue: EGP(50_000), collected: EGP(20_000), toBeCollected: EGP(30_000) } });
  await lost(f3.id, at("2026-10-16"));
  await proposal(f4.id, EGP(40_000), at("2026-09-06"));
  /* 23:30 Cairo on 25 Sep — inside the previous window, which ends 26 Sep 00:00 */
  await db.wonInfo.create({ data: { leadId: f5.id, estimatedValue: EGP(25_000), technicalOwner: "T", collectedAmount: EGP(25_000), createdAt: at("2026-09-25", "23:30") } });
  await db.client.create({ data: { brand: bf, leadId: f5.id, name: f5.name, number: f5.number, estimatedValue: EGP(25_000), collected: EGP(25_000), toBeCollected: 0 } });

  return { admin, g1, g2, g3, p1User, p1, r1, r2, r3, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, f1, f2, f3, f4, f5, f6 };
}

const SCOPES = (w: World): Record<string, { brand: Brand; scope: TodoScope }> => ({
  bsAdmin: { brand: "bsystems", scope: { kind: "all" } },
  bsSales: { brand: "bsystems", scope: { kind: "internal" } },
  g1: { brand: "bsystems", scope: { kind: "own", userId: w.g1.id } },
  g2: { brand: "bsystems", scope: { kind: "own", userId: w.g2.id } },
  p1: { brand: "bsystems", scope: { kind: "own", userId: w.p1User.id } },
  bf: { brand: "byteforce", scope: { kind: "all" } },
});

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const funnelCounts = (d: DashboardData) => d.funnel.map((s) => s.count);
const sourceMap = (d: DashboardData) =>
  Object.fromEntries(d.sources.filter((s) => s.count > 0).map((s) => [s.type, s.count]));
const trendRates = (d: DashboardData) => d.trend.map((t) => ratePct(t));

let w: World;
let all: Record<string, DashboardData>;

beforeEach(async () => {
  await resetDb();
  seq = 0;
  w = await dashboardWorld();
  const scopes = SCOPES(w);
  all = Object.fromEntries(
    await Promise.all(
      Object.entries(scopes).map(async ([k, s]) => [k, await dashboardFor({ ...s, range: "mtd", now: NOW })] as const),
    ),
  );
});

describe("K2 New leads (cur / prev / delta)", () => {
  it("every scope", () => {
    const row = (d: DashboardData) => [d.kpis.newLeads.value, d.kpis.newLeads.prev, d.kpis.newLeads.delta];
    expect(row(all.bsAdmin!)).toEqual([6, 3, { kind: "pct", pct: 100, dir: "up" }]);
    expect(row(all.bsSales!)).toEqual([2, 2, { kind: "same" }]);
    expect(row(all.g1!)).toEqual([2, 0, { kind: "new" }]);
    expect(row(all.g2!)).toEqual([1, 0, { kind: "new" }]);
    expect(row(all.p1!)).toEqual([1, 0, { kind: "new" }]);
    expect(row(all.bf!)).toEqual([3, 2, { kind: "pct", pct: 50, dir: "up" }]);
  });
});

describe("K1 Won (booked value)", () => {
  it("every scope", () => {
    const row = (d: DashboardData) => [d.kpis.won.value, d.kpis.won.prevValue, d.kpis.won.delta, d.kpis.won.count];
    expect(row(all.bsAdmin!)).toEqual([EGP(200_000), EGP(150_000), { kind: "pct", pct: 33, dir: "up" }, 1]);
    expect(row(all.bsSales!)).toEqual([0, EGP(150_000), { kind: "pct", pct: -100, dir: "down" }, 0]);
    expect(row(all.g1!)).toEqual([EGP(200_000), 0, { kind: "new" }, 1]);
    expect(row(all.g2!)).toEqual([0, 0, { kind: "same" }, 0]);
    expect(row(all.p1!)).toEqual([0, 0, { kind: "same" }, 0]);
    expect(row(all.bf!)).toEqual([EGP(50_000), EGP(25_000), { kind: "pct", pct: 100, dir: "up" }, 1]);
  });

  it("the six-month sparkline buckets by Cairo month", () => {
    expect(all.bsAdmin!.kpis.won.spark).toEqual([0, 0, 0, 0, EGP(150_000), EGP(200_000)]);
    expect(all.bf!.kpis.won.spark).toEqual([0, 0, 0, 0, EGP(25_000), EGP(50_000)]);
    expect(all.bsAdmin!.kpis.newLeads.spark).toEqual([0, 0, 0, 0, 3, 6]);
  });
});

describe("K3 Win rate (decided in the period)", () => {
  it("every scope", () => {
    const k = (d: DashboardData) => d.kpis.winRate;
    expect([k(all.bsAdmin!).cur, k(all.bsAdmin!).prev, k(all.bsAdmin!).delta]).toEqual([
      { won: 1, lost: 1 }, { won: 1, lost: 2 }, { kind: "pts", pts: 17, dir: "up" },
    ]);
    expect([k(all.bsSales!).cur, k(all.bsSales!).prev, k(all.bsSales!).delta]).toEqual([
      { won: 0, lost: 0 }, { won: 1, lost: 1 }, { kind: "na" },
    ]);
    expect([ratePct(k(all.g1!).cur), k(all.g1!).delta]).toEqual([100, { kind: "na" }]);
    expect([ratePct(k(all.g2!).cur), k(all.g2!).delta]).toEqual([0, { kind: "na" }]);
    expect([ratePct(k(all.p1!).cur), k(all.p1!).delta]).toEqual([null, { kind: "na" }]);
    expect([k(all.bf!).cur, k(all.bf!).prev, k(all.bf!).delta]).toEqual([
      { won: 1, lost: 1 }, { won: 1, lost: 0 }, { kind: "pts", pts: -50, dir: "down" },
    ]);
  });
});

describe("K4 Pipeline value (NOW) · open · parked", () => {
  it("every scope", () => {
    const row = (d: DashboardData) => {
      const p = d.kpis.pipeline;
      return [p.value, p.openCount, p.parkedValue, p.parkedCount];
    };
    expect(row(all.bsAdmin!)).toEqual([EGP(210_000), 4, EGP(30_000), 1]);
    expect(row(all.bsSales!)).toEqual([EGP(100_000), 2, 0, 0]);
    expect(row(all.g1!)).toEqual([EGP(80_000), 1, 0, 0]);
    expect(row(all.g2!)).toEqual([0, 0, 0, 0]);
    expect(row(all.p1!)).toEqual([EGP(30_000), 1, EGP(30_000), 1]);
    expect(row(all.bf!)).toEqual([EGP(40_000), 3, 0, 1]); // f6 parked, no value
  });

  it("the stacked bar's stages sum to the pipeline value and carry only active stages", () => {
    for (const d of Object.values(all)) {
      const total = d.kpis.pipeline.byStage.reduce((a, s) => a + s.value, 0);
      expect(total).toBe(d.kpis.pipeline.value);
      expect(d.kpis.pipeline.byStage.map((s) => s.stage)).not.toContain("won");
      expect(d.kpis.pipeline.byStage.map((s) => s.stage)).not.toContain("lost");
    }
  });
});

describe("W5 Leads per stage — §6.5 in one card", () => {
  it("Total leads and the per-stage cells, every scope", () => {
    expect(all.bsAdmin!.snapshot.totalLeads).toBe(9);
    expect(all.bsAdmin!.snapshot.leadsPerStage).toEqual({
      new: 0, following_up: 1, meeting_setting: 0, sending_proposal: 1, negotiation: 1, postponed: 1, won: 2, lost: 3,
    });
    expect(all.bsSales!.snapshot.totalLeads).toBe(4);
    expect(all.bsSales!.snapshot.leadsPerStage).toMatchObject({ following_up: 1, sending_proposal: 1, won: 1, lost: 1 });
    expect([all.g1!.snapshot.totalLeads, all.g2!.snapshot.totalLeads, all.p1!.snapshot.totalLeads]).toEqual([2, 1, 1]);
    expect(all.g1!.snapshot.leadsPerStage).toMatchObject({ negotiation: 1, won: 1 });
    expect(all.bf!.snapshot.totalLeads).toBe(6);
    expect(all.bf!.snapshot.leadsPerStage).toEqual({
      new: 0, following_up: 1, meeting_setting: 0, sending_proposal: 1, postponed: 1, won: 2, lost: 1,
    });
  });

  it("THE INVARIANT — for both companies and every scope, Σ bars = Total leads", () => {
    for (const [k, d] of Object.entries(all)) {
      expect(sum(d.snapshot.leadsPerStage), k).toBe(d.snapshot.totalLeads);
      expect(Object.keys(d.snapshot.leadsPerStage), k).toEqual([...configForBrand(d.brand).stages]);
    }
  });

  it("Won value (all time) reads WonDeal under B-Systems (A1) and WonInfo under ByteForce", () => {
    expect(all.bsAdmin!.snapshot.wonValue).toBe(EGP(350_000));
    expect(all.bsSales!.snapshot.wonValue).toBe(EGP(150_000));
    expect(all.g1!.snapshot.wonValue).toBe(EGP(200_000));
    expect([all.g2!.snapshot.wonValue, all.p1!.snapshot.wonValue]).toEqual([0, 0]);
    expect(all.bf!.snapshot.wonValue).toBe(EGP(75_000));
  });

  it("Milestones outstanding (B-Systems, D6) / To be collected (ByteForce)", () => {
    expect(all.bsAdmin!.snapshot.toBeCollected).toBe(EGP(80_000));
    expect(all.bsSales!.snapshot.toBeCollected).toBe(0);
    expect(all.g1!.snapshot.toBeCollected).toBe(EGP(80_000));
    expect([all.g2!.snapshot.toBeCollected, all.p1!.snapshot.toBeCollected]).toEqual([0, 0]);
    expect(all.bf!.snapshot.toBeCollected).toBe(EGP(30_000));
  });

  it("the agent & partner add-on: Agents counts active + approved only (D8)", () => {
    expect(all.bsAdmin!.external).toMatchObject({ agentCount: 2, pendingAgentCount: 1, partnerCount: 1 });
    expect(all.bsAdmin!.external!.externalPipeline).toMatchObject({ negotiation: 1, won: 1, lost: 1, postponed: 1 });
    /* nobody else gets the roster at all — ByteForce least of all */
    for (const k of ["bsSales", "g1", "g2", "p1", "bf"]) expect(all[k]!.external, k).toBeNull();
  });
});

describe("W6 Funnel — the period cohort, 'got at least this far'", () => {
  it("every scope", () => {
    expect(all.bsAdmin!.funnel.map((s) => s.key)).toEqual([
      "added", "following_up", "meeting_setting", "sending_proposal", "negotiation", "won",
    ]);
    expect(funnelCounts(all.bsAdmin!)).toEqual([6, 6, 5, 4, 2, 1]);
    expect(funnelCounts(all.bsSales!)).toEqual([2, 2, 1, 1, 0, 0]);
    expect(funnelCounts(all.g1!)).toEqual([2, 2, 2, 2, 2, 1]);
    expect(funnelCounts(all.g2!)).toEqual([1, 1, 1, 0, 0, 0]);
    expect(funnelCounts(all.p1!)).toEqual([1, 1, 1, 1, 0, 0]);
    /* ByteForce has no negotiation step */
    expect(all.bf!.funnel.map((s) => s.key)).toEqual(["added", "following_up", "meeting_setting", "sending_proposal", "won"]);
    expect(funnelCounts(all.bf!)).toEqual([3, 3, 2, 1, 1]);
  });

  it("is nested by construction — no step exceeds the one before", () => {
    for (const d of Object.values(all)) {
      const c = funnelCounts(d);
      for (let i = 1; i < c.length; i++) expect(c[i]!).toBeLessThanOrEqual(c[i - 1]!);
    }
  });
});

describe("W7 Lead sources (the cohort)", () => {
  it("every scope, zero rows kept and ranked last", () => {
    expect(sourceMap(all.bsAdmin!)).toEqual({ cold_call: 2, campaign_lead: 1, personal_connection: 1, event_data: 1, organic: 1 });
    expect(all.bsAdmin!.sources[0]).toEqual({ type: "cold_call", count: 2 });
    expect(all.bsAdmin!.partnerReferred).toBe(1);
    expect(sourceMap(all.bsSales!)).toEqual({ cold_call: 1, campaign_lead: 1 });
    expect(sourceMap(all.g1!)).toEqual({ personal_connection: 1, cold_call: 1 });
    expect(sourceMap(all.g2!)).toEqual({ event_data: 1 });
    expect(sourceMap(all.p1!)).toEqual({ organic: 1 });
    expect(all.p1!.partnerReferred).toBe(1);
    expect(sourceMap(all.bf!)).toEqual({ cold_call: 1, personal_connection: 1, event_data: 1 });
    expect(all.bf!.partnerReferred).toBeNull();
    for (const d of Object.values(all)) {
      expect(d.sources).toHaveLength(5);
      expect(d.sources.at(-1)!.count).toBeLessThanOrEqual(d.sources[0]!.count);
    }
  });
});

describe("W11 Win rate by month (May–Oct): a month with nothing decided is a GAP", () => {
  it("every scope", () => {
    expect(all.bsAdmin!.trend.map((t) => t.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(trendRates(all.bsAdmin!)).toEqual([null, null, null, null, 33, 50]);
    expect(trendRates(all.bsSales!)).toEqual([null, null, null, null, 50, null]);
    expect(trendRates(all.g1!)).toEqual([null, null, null, null, null, 100]);
    expect(trendRates(all.g2!)).toEqual([null, null, null, null, null, 0]);
    expect(trendRates(all.p1!)).toEqual([null, null, null, null, null, null]);
    expect(trendRates(all.bf!)).toEqual([null, null, null, null, 100, 50]);
  });
});

describe("W12 Team (credited to the current owner)", () => {
  it("B-Systems admin: G1, R3, G2, P1 — the admin bucket had no activity, so no row", () => {
    const team = all.bsAdmin!.team!.map((r) => [r.name, r.newCount, r.wonCount, r.wonValue, ratePct({ won: r.wonCount, lost: r.lostCount }), r.openCount]);
    expect(team).toEqual([
      ["Gamal Agent", 2, 1, EGP(200_000), 100, 1],
      ["Nour", 2, 0, 0, null, 2],
      ["Ghada Agent", 1, 0, 0, 0, 0],
      ["Prime Partners", 1, 0, 0, null, 1],
    ]);
  });

  it("sales sees the internal bucket only; agents and partners get no card", () => {
    expect(all.bsSales!.team!.map((r) => r.name)).toEqual(["Nour"]);
    for (const k of ["g1", "g2", "p1"]) expect(all[k]!.team, k).toBeNull();
  });

  it("ByteForce: R1 Laila, R2 Ahmed", () => {
    const team = all.bf!.team!.map((r) => [r.name, r.newCount, r.wonCount, r.wonValue, ratePct({ won: r.wonCount, lost: r.lostCount }), r.openCount]);
    expect(team).toEqual([
      ["Laila", 2, 1, EGP(50_000), 100, 1],
      ["Ahmed", 1, 0, 0, 0, 2],
    ]);
  });
});

describe("W10 Recent wins · W8 tasks · W9 Needs you", () => {
  it("recent wins follow the period and the record each company writes", () => {
    expect(all.bsAdmin!.recentWins.map((r) => [r.name, r.value, r.status])).toEqual([
      ["BS4 Winner Co", EGP(200_000), { kind: "milestone", current: 2, total: 2 }],
    ]);
    expect(all.bsSales!.recentWins).toEqual([]);
    expect(all.bf!.recentWins.map((r) => [r.name, r.value, r.status.kind])).toEqual([["BF2 Winner Co", EGP(50_000), "collect"]]);
    expect(all.bf!.recentWins[0]!.status).toMatchObject({ toBeCollected: EGP(30_000) });
    expect(all.bf!.recentWins[0]!.href).toContain("company=byteforce");
  });

  it("today's tasks are the To-Do's own projection, scoped", () => {
    expect(all.bsAdmin!.tasks.today.map((t) => t.title)).toContain("BS1 Boundary Co");
    expect(all.bsSales!.tasks.today.map((t) => t.title)).toContain("BS1 Boundary Co");
    expect(all.g1!.tasks.todayCount).toBe(0);
    expect(all.bf!.tasks.todayCount).toBe(0);
  });

  it("Needs you is the B-Systems admin's alone", () => {
    expect(all.bsAdmin!.needsYou).toEqual({
      readyToClose: { count: 1, leads: [{ id: w.b3.id, name: "BS3 Negotiation Co" }] },
      pendingRegistrations: 1,
    });
    for (const k of ["bsSales", "g1", "g2", "p1", "bf"]) expect(all[k]!.needsYou, k).toBeNull();
  });
});

describe("other ranges", () => {
  it("last_month for ByteForce: New 3 vs 0 → New; Won 25,000 vs 0 → New", async () => {
    const d = await dashboardFor({ brand: "byteforce", scope: { kind: "all" }, range: "last_month", now: NOW });
    expect([d.kpis.newLeads.value, d.kpis.newLeads.prev, d.kpis.newLeads.delta]).toEqual([3, 0, { kind: "new" }]);
    expect([d.kpis.won.value, d.kpis.won.prevValue, d.kpis.won.delta]).toEqual([EGP(25_000), 0, { kind: "new" }]);
  });

  it("7d for B-Systems on 25 Oct: New 1 (b6) vs 2 (b4, b5) → −50%", async () => {
    const d = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "7d", now: NOW });
    expect([d.kpis.newLeads.value, d.kpis.newLeads.prev, d.kpis.newLeads.delta]).toEqual([1, 2, { kind: "pct", pct: -50, dir: "down" }]);
  });

  it("7d for ByteForce: 0 vs 0 → No change", async () => {
    const d = await dashboardFor({ brand: "byteforce", scope: { kind: "all" }, range: "7d", now: NOW });
    expect([d.kpis.newLeads.value, d.kpis.newLeads.prev, d.kpis.newLeads.delta]).toEqual([0, 0, { kind: "same" }]);
  });
});

describe("the Cairo boundary", () => {
  it("b1 (00:30 Cairo on 1 Oct, still 30 Sep in UTC) counts in OCTOBER", async () => {
    expect(w.b1.createdAt.toISOString().startsWith("2026-09-30")).toBe(true);
    /* on UTC months b1 would be a September lead: 2 new in October for sales, 3 in September */
    expect(all.bsSales!.kpis.newLeads.value).toBe(2);
    expect(all.bsSales!.kpis.newLeads.prev).toBe(2);
    expect(all.bsAdmin!.kpis.newLeads.spark.slice(-2)).toEqual([3, 6]);
  });

  it("f5's win at 23:30 Cairo on 25 Sep is inside the previous window", () => {
    expect(all.bf!.kpis.won.prevValue).toBe(EGP(25_000));
  });
});

describe("the walls", () => {
  const names = (d: DashboardData) => JSON.stringify(d);

  it("agent G1 never sees b5 or b6 — not in the team, the feed, the wins or the tasks", () => {
    const blob = names(all.g1!);
    expect(blob).not.toContain("BS5 Lost Co");
    expect(blob).not.toContain("BS6 Parked Co");
    expect(blob).not.toContain("Nour");
    expect(all.g1!.activity.every((a) => [w.b3.id, w.b4.id].includes(a.lead.id))).toBe(true);
    expect(all.g1!.activity.length).toBeGreaterThan(0);
  });

  it("ByteForce never sees a B-Systems row, and B-Systems never sees a ByteForce one", () => {
    expect(names(all.bf!)).not.toMatch(/BS\d+ /);
    for (const k of ["bsAdmin", "bsSales", "g1", "g2", "p1"]) expect(names(all[k]!), k).not.toMatch(/BF\d+ /);
    /* and the B-Systems-only concepts are not even queried under ByteForce */
    expect(all.bf!.external).toBeNull();
    expect(all.bf!.needsYou).toBeNull();
  });

  it("the activity feed for G2 excludes a log row on b3", () => {
    expect(all.g2!.activity.length).toBeGreaterThan(0);
    expect(all.g2!.activity.every((a) => a.lead.id === w.b5.id)).toBe(true);
  });

  it("the admin feed drops a row whose lead was deleted, and keeps archived leads badged", async () => {
    await db.activityLog.create({
      data: { entityType: "lead", entityId: "deleted-lead-id", actorLabel: "Ghost", action: "create", trigger: "create", createdAt: NOW },
    });
    await log(w.b10.id, new Date(NOW.getTime() - 1000), "update", null, null, "archived");
    const d = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "mtd", now: NOW });
    expect(d.activity.map((a) => a.lead.id)).not.toContain("deleted-lead-id");
    expect(d.activity.find((a) => a.lead.id === w.b10.id)?.lead.archived).toBe(true);
    expect(d.activity.length).toBeLessThanOrEqual(8);
    /* newest first */
    const times = d.activity.map((a) => a.at.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe("the feed is walled AT THE QUERY", () => {
  it("a busy company never starves a quiet one's feed (the other company's rows are never read)", async () => {
    /* 80 newer B-Systems rows: a scan-then-filter feed would read them first */
    for (let i = 0; i < 80; i++) {
      await log(w.b2.id, new Date(NOW.getTime() - i * 1000), "update", null, null, "edit");
    }
    const bf = await dashboardFor({ brand: "byteforce", scope: { kind: "all" }, range: "mtd", now: NOW });
    expect(bf.activity).toHaveLength(8);
    const bfIds = new Set([w.f1, w.f2, w.f3, w.f4, w.f5, w.f6].map((l) => l.id));
    expect(bf.activity.every((a) => bfIds.has(a.lead.id))).toBe(true);
  });
});

describe("the funnel's Won step counts only leads that ARE won", () => {
  it("a stage_change → won row on a lead that is not won now does not reach the Won step", async () => {
    /* the history says b2 was won once; its stage says it is not */
    await log(w.b2.id, at("2026-10-06"), "stage_change", "sending_proposal", "won", "B-9");
    const d = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "mtd", now: NOW });
    expect(funnelCounts(d).at(-1)).toBe(1); // still only b4
    expect(funnelCounts(d).at(-1)).toBe(d.kpis.won.count);
  });
});

describe("Recent wins lists a legacy B-Systems win the Won KPI counts", () => {
  it("a pre-V2 WonInfo in the period appears in the list", async () => {
    const legacy = await lead({ brand: "bsystems", name: "BS Legacy October", created: at("2026-10-03"), type: "cold_call", path: ["new", "won"], salesRepId: w.r3.id });
    await db.wonInfo.create({ data: { leadId: legacy.id, estimatedValue: EGP(5_000), technicalOwner: "T", collectedAmount: 0, createdAt: at("2026-10-23") } });
    const d = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "mtd", now: NOW });
    expect(d.recentWins.map((r) => r.name)).toEqual(["BS Legacy October", "BS4 Winner Co"]);
    expect(d.kpis.won.value).toBe(EGP(205_000));
  });
});

describe("the archive (ADR-043; D7 unchanged — archived money leaves the figures)", () => {
  it("archiving b4: Total 8, New 5, Won value 150,000, and the period win is gone", async () => {
    await setArchived("bsystems", w.b4.id, true, { id: null, label: "Test" });
    const d = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "mtd", now: NOW });
    expect(d.snapshot.totalLeads).toBe(8);
    expect(d.kpis.newLeads.value).toBe(5);
    expect(d.snapshot.wonValue).toBe(EGP(150_000));
    expect(d.kpis.won.value).toBe(0);
    /* its open milestone is still owed — client money survives archiving (A0) */
    expect(d.snapshot.toBeCollected).toBe(EGP(80_000));
    expect(sum(d.snapshot.leadsPerStage)).toBe(d.snapshot.totalLeads);
  });
});

describe("undo (the known overcount, pinned — §10 item 4 has not shipped)", () => {
  it("a move to Meeting that is undone still counts as reached", async () => {
    const actor: Actor = { id: w.admin.id, label: w.admin.name };
    const before = funnelCounts(all.bsAdmin!)[2]!; // Meeting
    await applyLeadEvent({
      brand: "bsystems",
      leadId: w.b1.id,
      event: { type: "drag", to: "meeting_setting" },
      group: { group: "meeting", data: { arranged: true, date: "2026-10-26", time: "10:00", mode: "online" } },
      actor,
      role: "bsystems_admin",
    });
    await performUndo(actor);
    expect((await db.lead.findUniqueOrThrow({ where: { id: w.b1.id } })).stage).toBe("following_up");
    const d = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "mtd", now: NOW });
    /* the undo row carries no stages, so the move still reads as reached: +1 */
    expect(funnelCounts(d)[2]).toBe(before + 1);
  });
});

describe("A1 / A5 regression — a B-Systems win confirmed through the engine", () => {
  it("appears in the period Won value and count, and in the all-time Won value", async () => {
    const actor: Actor = { id: w.admin.id, label: w.admin.name };
    const now = new Date(); // the engine stamps WonDeal.createdAt with the real clock
    const before = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "mtd", now });
    await applyLeadEvent({
      brand: "bsystems",
      leadId: w.b2.id,
      event: { type: "next_action", action: "won" },
      group: {
        group: "won_deal",
        data: {
          estimatedValue: EGP(70_000),
          totalCommissionPercentBp: 10_00,
          contractDate: "2026-10-25",
          milestones: [{ label: "All", value: EGP(70_000), commissionValue: EGP(7_000), expectedEnd: "2026-12-01" }],
        },
      },
      actor,
      role: "bsystems_admin",
    });
    const after = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "mtd", now: new Date() });
    expect(after.kpis.won.value - before.kpis.won.value).toBe(EGP(70_000));
    expect(after.kpis.won.count - before.kpis.won.count).toBe(1);
    expect(after.snapshot.wonValue - before.snapshot.wonValue).toBe(EGP(70_000));
    expect(after.snapshot.wonCount - before.snapshot.wonCount).toBe(1);
  });

  it("a legacy B-Systems WonInfo with no WonDeal keeps its value, as ADR-089 shipped it", async () => {
    /* The dashboard spec (written before A0 shipped) said a legacy WonInfo must
       NOT inflate B-Systems Won value. ADR-089 decided otherwise — a pre-V2 win
       keeps its old value rather than vanishing — and metrics.integration.test
       pins that. The Home reads the same record rule, so it agrees with A0. */
    const legacy = await lead({ brand: "bsystems", name: "BS Legacy Win", created: at("2026-03-01"), type: "cold_call", path: ["new", "won"], salesRepId: w.r3.id });
    await db.wonInfo.create({ data: { leadId: legacy.id, estimatedValue: EGP(10_000), technicalOwner: "T", collectedAmount: 0, createdAt: at("2026-03-02") } });
    const d = await dashboardFor({ brand: "bsystems", scope: { kind: "all" }, range: "mtd", now: NOW });
    expect(d.snapshot.wonValue).toBe(EGP(360_000));
    /* outside the period, so the period figure is untouched */
    expect(d.kpis.won.value).toBe(EGP(200_000));
  });
});
