import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/hash";
import { normalizePhone } from "../src/lib/auth/phone";

/* Seed (SPEC §13): idempotent — re-running upserts, never duplicates.

   THE ADMIN (founder directive 2026-08-09) is created identically in EVERY
   environment, local or production:
     Admin   admin@byteforce.com / password123   name "Elmur"   (both entities)
   Its password is re-asserted on every seed run so the account is always in
   the known state. A legacy admin@b-systems.example account is renamed in
   place (no duplicate admin).

   DEMO data (accounts below + fixtures) seeds everywhere EXCEPT production —
   demo passwords must never exist on a live system. Force with SEED_DEMO=1.
     ByteForce staff   sara@byteforce.example    / byteforce123
     B-Systems sales   omar@b-systems.example    / bsystems123
     Agent             01001234567               / partner123
     Data entry        entry@b-systems.example   / entry123   (ADR-051) */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
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
    /* name AND password re-assert on every run — seeded accounts are always in
       the documented state (founder directive for the admin) */
    update: { name: opts.name, passwordHash, passwordPlain: opts.password },
    create: {
      name: opts.name,
      email: opts.email ?? null,
      phone: opts.phone ? normalizePhone(opts.phone) : null,
      passwordHash,
      passwordPlain: opts.password,
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
  /* ---- THE admin — every environment, local or production (founder directive).
     ADR-016: admins are seeded, never self-signed-up. Holds BOTH entities —
     the header's entity switcher appears only for dual-entity accounts. */
  const legacyAdmin = await db.user.findUnique({
    where: { email: "admin@b-systems.example" },
  });
  const newAdmin = await db.user.findUnique({ where: { email: "admin@byteforce.com" } });
  if (legacyAdmin && !newAdmin) {
    // rename in place — existing databases keep ONE admin, history intact
    await db.user.update({
      where: { id: legacyAdmin.id },
      data: { email: "admin@byteforce.com" },
    });
  }
  await upsertUser({
    name: "Elmur",
    email: "admin@byteforce.com",
    password: "password123",
    roles: ["bsystems_admin", "byteforce_staff"],
  });

  /* ---- demo data — never on production (SEED_DEMO=1 overrides) ---- */
  const seedDemo = process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "1";
  if (!seedDemo) {
    console.log("Seed complete (production: admin only).");
    return;
  }

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

  /* ADR-051 — the least-privilege data-entry account: adds leads and cards,
     owns neither, sees nothing else. */
  await upsertUser({
    name: "Hala Nabil",
    email: "entry@b-systems.example",
    password: "entry123",
    roles: ["bsystems_data_entry"],
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

    /* ADR-057 — AGENT cards run their own columns (lead / contacted /
       didnt_answer / meeting_setting / qualified / lost), so the Agents board
       needs its own seed or it renders six empty columns on first login. */
    const agentStages: Array<[string, string, string]> = [
      ["Mahmoud Sabry", "01201000001", "lead"],
      ["Yasmin Farouk", "01201000002", "contacted"],
      ["Tarek Nabil", "01201000003", "didnt_answer"],
      ["Rania Hosny", "01201000004", "meeting_setting"],
      ["Amr Shaker", "01201000005", "lost"],
    ];
    for (const [name, number, stage] of agentStages) {
      const a = await db.partnerProspect.create({
        data: {
          kind: "agent",
          name,
          number,
          address: "Nasr City, Cairo",
          speciality: "ERP consulting",
          stage,
          ...(stage === "didnt_answer" ? { nonAnsweringNumbers: `["${number}"]` } : {}),
        },
      });
      if (stage === "contacted") {
        await db.followUp.create({
          data: {
            partnerProspectId: a.id,
            context: "initial",
            dueAt: new Date("2026-08-23T09:00:00Z"),
            method: "call",
          },
        });
      }
      if (stage === "meeting_setting") {
        await db.meeting.create({
          data: {
            partnerProspectId: a.id,
            arranged: true,
            datetime: new Date("2026-08-29T11:00:00Z"),
            mode: "online",
          },
        });
      }
      if (stage === "lost") {
        await db.lostInfo.create({
          data: { partnerProspectId: a.id, reason: "Took a role elsewhere" },
        });
      }
    }

    /* ...and the sixth column, Qualified — the agent analogue of `wonProspect`
       below. It is the founder's headline column ("when he is in qualified he
       becomes an agent and we create a user for hiim"), so the seed ships the
       state PA-4 actually produces: converted, with a real minted account
       behind it, which is also what puts the Converted badge, the "Agent
       account created" link and the terminal panel on a fresh install. */
    const qualifiedAgentUser = await upsertUser({
      name: "Nourhan Adel",
      email: "nourhan.agent@b-systems.example",
      phone: "01201000006",
      password: "agent123",
      roles: ["bsystems_agent"],
    });
    await db.portalRep.upsert({
      where: { userId: qualifiedAgentUser.id },
      update: {},
      create: {
        userId: qualifiedAgentUser.id,
        firstName: "Nourhan",
        lastName: "Adel",
        address: "Nasr City, Cairo",
        speciality: "ERP consulting",
      },
    });
    const qualifiedAgent = await db.partnerProspect.create({
      data: {
        kind: "agent",
        name: "Nourhan Adel",
        number: "01201000006",
        address: "Nasr City, Cairo",
        speciality: "ERP consulting",
        stage: "qualified",
        converted: true,
        agentUserId: qualifiedAgentUser.id,
      },
    });
    await log("partner_prospect", qualifiedAgent.id, "stage_change", "PA-4", "meeting_setting", "qualified");

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
