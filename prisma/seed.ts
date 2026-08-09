import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hashPassword } from "../src/lib/auth/hash";
import { normalizePhone } from "../src/lib/auth/phone";

/* Seed (SPEC §13): demo data for both brands and the portal so every screen renders
   meaningfully on first run. Idempotent — re-running upserts, never duplicates.
   Accounts (dev credentials, documented in README):
     ByteForce staff   sara@byteforce.example    / byteforce123
     B-Systems staff   omar@b-systems.example    / bsystems123   (+ portal_admin, A-8)
     Portal admin      admin@b-systems.example   / admin123      (seeded — ADR-016)
     Portal rep        01001234567               / partner123
   Pipeline fixture data lands per phase; Phase 0 ships the account + rep scaffold. */

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function upsertUser(opts: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  roles: string[];
}) {
  const passwordHash = await hashPassword(opts.password);
  const where = opts.email ? { email: opts.email } : { phone: normalizePhone(opts.phone!) };
  const user = await db.user.upsert({
    where: where as never,
    update: { name: opts.name },
    create: {
      name: opts.name,
      email: opts.email ?? null,
      phone: opts.phone ? normalizePhone(opts.phone) : null,
      passwordHash,
    },
  });
  for (const role of opts.roles) {
    await db.userRole.upsert({
      where: { userId_role: { userId: user.id, role } },
      update: {},
      create: { userId: user.id, role },
    });
  }
  return user;
}

export async function seed() {
  await upsertUser({
    name: "Sara Hassan",
    email: "sara@byteforce.example",
    password: "byteforce123",
    roles: ["byteforce_staff"],
  });

  // A-8 default: one B-Systems account may carry both roles
  await upsertUser({
    name: "Omar Farouk",
    email: "omar@b-systems.example",
    password: "bsystems123",
    roles: ["bsystems_sales"],
  });

  // ADR-016: portal admins are seeded, never self-signed-up
  await upsertUser({
    name: "Portal Admin",
    email: "admin@b-systems.example",
    password: "admin123",
    roles: ["bsystems_admin"],
  });

  const repUser = await upsertUser({
    name: "Karim Adel",
    phone: "01001234567",
    password: "partner123",
    roles: ["bsystems_agent"],
  });
  await db.portalRep.upsert({
    where: { userId: repUser.id },
    update: {},
    create: {
      userId: repUser.id,
      firstName: "Karim",
      lastName: "Adel",
      address: "12 Tahrir St, Cairo",
      speciality: "ERP consulting",
    },
  });

  // Internal sales-rep cards (§6.1) — idempotent by (brand, name)
  const repIds: Record<string, string> = {};
  for (const [brand, names] of [
    ["byteforce", ["Laila Mostafa", "Ahmed Samir"]],
    ["bsystems", ["Nour El-Din", "Mona Khalil"]],
  ] as const) {
    for (const name of names) {
      let rep = await db.salesRep.findFirst({ where: { brand, name } });
      if (!rep) rep = await db.salesRep.create({ data: { brand, name } });
      repIds[`${brand}:${name}`] = rep.id;
    }
  }

  /* ---- §13 demo fixtures: every screen renders meaningfully on first run. ----
     Idempotence: skip the whole block when the sentinel lead already exists. */
  const sentinel = await db.lead.findFirst({ where: { name: "Cairo Grand Hotels" } });
  if (!sentinel) {
    const log = (
      entityType: string,
      entityId: string,
      action: string,
      trigger: string,
      fromStage?: string,
      toStage?: string,
    ) =>
      db.activityLog.create({
        data: {
          entityType,
          entityId,
          actorId: null,
          actorLabel: "Seed",
          action,
          fromStage: fromStage ?? null,
          toStage: toStage ?? null,
          trigger,
        },
      });

    /* Leads across all stages for BOTH internal brands. */
    for (const brand of ["byteforce", "bsystems"] as const) {
      const rep1 = repIds[`${brand}:${brand === "byteforce" ? "Laila Mostafa" : "Nour El-Din"}`]!;
      const rep2 = repIds[`${brand}:${brand === "byteforce" ? "Ahmed Samir" : "Mona Khalil"}`]!;
      const mk = (data: {
        name: string;
        number: string;
        type: string;
        stage: string;
        repId: string;
      }) =>
        db.lead.create({
          data: {
            brand,
            salesRepId: data.repId,
            name: data.name,
            number: data.number,
            type: data.type,
            stage: data.stage,
          },
        });

      const prefix = brand === "byteforce" ? "Cairo" : "Delta";
      await mk({ name: `${prefix} Fresh Foods`, number: "0221000001", type: "cold_call", stage: "new", repId: rep1 });

      const fu = await mk({ name: `${prefix} Textiles`, number: "0221000002", type: "event_data", stage: "following_up", repId: rep1 });
      await db.followUp.create({
        data: { leadId: fu.id, context: "initial", dueAt: new Date("2026-08-20T07:00:00Z"), method: "call", followingUpWith: "Procurement lead" },
      });
      await log("lead", fu.id, "stage_change", "T-1", "new", "following_up");

      const meet = await mk({ name: `${prefix} Logistics`, number: "0221000003", type: "personal_connection", stage: "meeting_setting", repId: rep2 });
      await db.meeting.create({
        data: { leadId: meet.id, arranged: true, datetime: new Date("2026-08-25T12:00:00Z"), mode: "online", withAttendees: "CEO + CTO" },
      });
      await log("lead", meet.id, "stage_change", "T-2", "new", "meeting_setting");

      const prop = await mk({ name: `${prefix} Grand Hotels`, number: "0221000004", type: "campaign_lead", stage: "sending_proposal", repId: rep2 });
      await db.proposal.create({
        data: { leadId: prop.id, service: "Annual marketing retainer", estimatedValue: 350_000_00, sent: false },
      });
      await log("lead", prop.id, "stage_change", "T-3", "new", "sending_proposal");

      const won = await mk({ name: `${prefix} Medical Group`, number: "0221000005", type: "personal_connection", stage: "won", repId: rep1 });
      await db.proposal.create({
        data: { leadId: won.id, service: "Brand launch package", estimatedValue: 500_000_00, sent: true, sentAt: new Date("2026-08-01T10:00:00Z") },
      });
      await db.wonInfo.create({
        data: { leadId: won.id, estimatedValue: 500_000_00, technicalOwner: "Tarek Nabil", collectedAmount: 200_000_00 },
      });
      await db.client.create({
        data: {
          brand,
          leadId: won.id,
          name: `${prefix} Medical Group`,
          number: "0221000005",
          service: "Brand launch package",
          estimatedValue: 500_000_00,
          collected: 200_000_00,
          toBeCollected: 300_000_00,
          dueDate: new Date("2026-10-01T00:00:00Z"),
          retainer: brand === "byteforce",
          technicalOwner: "Tarek Nabil",
        },
      });
      await log("lead", won.id, "stage_change", "T-9", "sending_proposal", "won");

      const lost = await mk({ name: `${prefix} Motors`, number: "0221000006", type: "cold_call", stage: "lost", repId: rep2 });
      await db.lostInfo.create({ data: { leadId: lost.id, reason: "Went with an in-house team" } });
      await log("lead", lost.id, "stage_change", "T-4", "new", "lost");
    }

    /* Partners pipeline (App B): one prospect per stage + a CONVERTED partner
       with attributed leads (§13). */
    const prospectStages: Array<[string, string]> = [
      ["Nile Imports", "lead"],
      ["Giza Steel", "didnt_answer"],
      ["Suez Shipping", "following_up"],
      ["Aswan Agritech", "meeting_setting"],
      ["Luxor Analytics", "lost"],
    ];
    for (const [company, stage] of prospectStages) {
      const p = await db.partnerProspect.create({
        data: {
          name: "Key Contact",
          companyName: company,
          number: "0231000001",
          businessActivity: "Trading",
          stage,
          ...(stage === "didnt_answer" ? { nonAnsweringNumbers: '["0231000001"]' } : {}),
        },
      });
      if (stage === "following_up") {
        await db.followUp.create({
          data: { partnerProspectId: p.id, context: "initial", dueAt: new Date("2026-08-22T08:00:00Z"), method: "visit" },
        });
      }
      if (stage === "meeting_setting") {
        await db.meeting.create({
          data: { partnerProspectId: p.id, arranged: true, datetime: new Date("2026-08-28T13:00:00Z"), mode: "offline" },
        });
      }
      if (stage === "lost") {
        await db.lostInfo.create({ data: { partnerProspectId: p.id, reason: "Not interested in partnership" } });
      }
    }

    const wonProspect = await db.partnerProspect.create({
      data: {
        name: "Hassan Ali",
        companyName: "Alexandria Trading House",
        number: "0231000009",
        businessActivity: "Wholesale distribution",
        stage: "won",
        converted: true,
      },
    });
    const partner = await db.partner.create({
      data: {
        prospectId: wonProspect.id,
        companyName: "Alexandria Trading House",
        keyPersonName: "Hassan Ali",
        keyPersonRole: "Managing Partner",
        address: "14 Corniche Rd, Alexandria",
        number: "0231000009",
        businessActivity: "Wholesale distribution",
        importance: "high",
      },
    });
    await log("partner", partner.id, "create", "PP-4");
    const partnerLead = await db.lead.create({
      data: {
        brand: "bsystems",
        salesRepId: null, // A-6 unassigned bucket
        source: "partner",
        partnerId: partner.id,
        name: "Referred Wholesale Client",
        number: "0231000010",
        type: "personal_connection",
        stage: "following_up",
      },
    });
    await db.followUp.create({
      data: { leadId: partnerLead.id, context: "initial", dueAt: new Date("2026-08-21T09:00:00Z"), method: "call" },
    });
    await log("lead", partnerLead.id, "create", "PP-5");

    /* V2: the seeded AGENT gets unified B-Systems leads across stages + a WON
       lead with the V2 milestone plan (M1 checked, dated, with commissions). */
    const agentUser = await db.user.findFirstOrThrow({ where: { phone: "01001234567" } });
    const seededRep = await db.portalRep.findFirstOrThrow({ where: { userId: agentUser.id } });
    const mkAgentLead = (name: string, company: string, stage: string) =>
      db.lead.create({
        data: {
          brand: "bsystems",
          ownerType: "agent",
          ownerUserId: agentUser.id,
          name,
          number: "0109000001",
          type: "personal_connection",
          position: "Decision maker",
          companyName: company,
          industry: "Services",
          stage,
        },
      });
    await mkAgentLead("Fresh Deal", "Startup One", "new");
    const dealFu = await mkAgentLead("Follow-up Deal", "Growth Co", "following_up");
    await db.followUp.create({
      data: { leadId: dealFu.id, context: "initial", dueAt: new Date("2026-08-23T10:00:00Z"), method: "message", ownerPortalRepId: seededRep.id },
    });
    const dealNeg = await mkAgentLead("Negotiation Deal", "Talks Co", "negotiation");
    await db.negotiationNote.create({
      data: { leadId: dealNeg.id, note: "Discussing scope reduction to fit budget." },
    });
    const dealWon = await mkAgentLead("Enterprise Win", "Enterprise LLC", "won");
    const wonDeal = await db.wonDeal.create({
      data: {
        leadId: dealWon.id,
        estimatedValue: 900_000_00,
        totalCommissionPercent: 10_00, // 10.00%
        contractDate: new Date("2026-08-01T00:00:00Z"),
      },
    });
    await db.milestone.create({
      data: {
        wonDealId: wonDeal.id, index: 1, value: 400_000_00, commissionValue: 40_000_00,
        expectedStart: new Date("2026-08-10T00:00:00Z"), expectedEnd: new Date("2026-09-10T00:00:00Z"),
        completed: true, completedAt: new Date("2026-08-05T09:00:00Z"),
      },
    });
    await db.milestone.create({
      data: {
        wonDealId: wonDeal.id, index: 2, value: 300_000_00, commissionValue: 30_000_00,
        expectedStart: new Date("2026-09-11T00:00:00Z"), expectedEnd: new Date("2026-10-10T00:00:00Z"),
      },
    });
    await db.milestone.create({
      data: {
        wonDealId: wonDeal.id, index: 3, value: 200_000_00, commissionValue: 20_000_00,
        expectedStart: new Date("2026-10-11T00:00:00Z"), expectedEnd: new Date("2026-11-10T00:00:00Z"),
      },
    });
    await log("won_deal", wonDeal.id, "create", "B-9");
    await log("won_deal", wonDeal.id, "milestone_check", "P-8");
  }

  console.log("Seed complete.");
}

/* Auto-run only when executed directly (prisma db seed / tsx prisma/seed.ts);
   e2e/setup-db.ts imports seed() and drives it itself. */
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed.ts")) {
  seed()
    .then(() => db.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await db.$disconnect();
      process.exit(1);
    });
}
