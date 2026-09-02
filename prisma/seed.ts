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
    /* ADR-073 — the founder holds all THREE companies, so the switch he asked
       for actually has three segments to offer him. */
    roles: ["bsystems_admin", "byteforce_staff", "mindoo_staff"],
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

  /* ADR-073 — a MINDOO-ONLY teammate, the twin of Sara on ByteForce. She exists
     so the single-company case is real in the demo data: no switch is rendered
     for her, and every other company's screens refuse her. */
  await upsertUser({
    name: "Mona Adel",
    email: "mona@mindoo.example",
    password: "mindoo123",
    roles: ["mindoo_staff"],
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
        /* ADR-063 — 10:00 on the Cairo clock, and stated as CHOSEN. A seeded
           instant that is not the 09:00 default must say so, or the demo data
           claims a time nobody picked (and violates the invariant the backfill
           rests on: dueTimeSet=false ⇒ 09:00 Cairo). */
        data: { leadId: fu.id, context: "initial", dueAt: new Date("2026-08-20T07:00:00Z"), dueTimeSet: true, method: "call", followingUpWith: "Procurement lead" },
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

    /* Partners & Agents pipeline (App B): one prospect per stage + a CONVERTED
       partner with attributed leads (§13). ADR-059 — BOTH kinds walk the SAME
       seven columns, so both loops below use the shared vocabulary and both
       seed a `waiting` card; without one the founder's new column is empty on
       a fresh install. */
    const prospectStages: Array<[string, string]> = [
      ["Nile Imports", "lead"],
      ["Suez Shipping", "contacted"],
      ["Giza Steel", "didnt_answer"],
      ["Aswan Agritech", "meeting_setting"],
      ["Damietta Furniture", "waiting"],
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
      /* ADR-059 — only ONE Contacted card carries a follow-up, and it is there
         because someone RECORDED one. A Contacted card with no follow-up (the
         agent loop's) is the normal case now and must be visible in the seed:
         it is the founder's item 2.1, shipped as data. */
      if (company === "Suez Shipping") {
        await db.followUp.create({
          data: { partnerProspectId: p.id, context: "initial", dueAt: new Date("2026-08-22T08:00:00Z"), dueTimeSet: true, method: "visit" }, // 11:00 Cairo, chosen (ADR-063)
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

    /* ADR-059 — agent cards share the partner columns, so the one board carries
       both kinds in every column. Yasmin sits in Contacted with NO follow-up:
       the founder's item 2.1 made visible — contacted means contacted, and she
       must NOT appear on the To-Do. */
    const agentStages: Array<[string, string, string]> = [
      ["Mahmoud Sabry", "01201000001", "lead"],
      ["Yasmin Farouk", "01201000002", "contacted"],
      ["Tarek Nabil", "01201000003", "didnt_answer"],
      ["Rania Hosny", "01201000004", "meeting_setting"],
      ["Hoda Kamal", "01201000007", "waiting"],
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

    /* ...and Qualified, which since ADR-059 has TWO honest shapes for an agent.
       This one is the finished article: qualified AND given a login with the
       separate account action (PP-4a), which is what puts the Converted badge,
       the "Agent account created" link and the terminal panel on a fresh
       install. The second one, below, is the state qualifying ALONE produces. */
    const qualifiedAgentUser = await upsertUser({
      name: "Nourhan Adel",
      email: "nourhan.agent@b-systems.example",
      phone: "01201000006",
      password: "agent123",
      roles: ["bsystems_agent"],
    });
    const qualifiedAgentRep = await db.portalRep.upsert({
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
    await log("partner_prospect", qualifiedAgent.id, "stage_change", "PP-6", "meeting_setting", "qualified");
    await log("portal_rep", qualifiedAgentRep.id, "create", "PP-4a");

    /* ADR-059 — a qualified agent with NO account. Founder 1.3: qualifying must
       never ask for an email or a password, so this is a legitimate, everyday
       state, not a broken one. It ships in the seed so the honest empty state
       ("Qualified, no account yet" + the Create-account button) is on screen
       from the first login rather than only after someone reproduces it. */
    const qualifiedNoAccount = await db.partnerProspect.create({
      data: {
        kind: "agent",
        name: "Kareem Fathy",
        number: "01201000008",
        address: "Maadi, Cairo",
        speciality: "Field sales",
        stage: "qualified",
      },
    });
    await log(
      "partner_prospect",
      qualifiedNoAccount.id,
      "stage_change",
      "PP-6",
      "waiting",
      "qualified",
    );

    const wonProspect = await db.partnerProspect.create({
      data: {
        name: "Hassan Ali",
        companyName: "Alexandria Trading House",
        number: "0231000009",
        businessActivity: "Wholesale distribution",
        stage: "qualified", // ADR-059 — the terminal-success column for both kinds
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
    await log("partner_prospect", wonProspect.id, "stage_change", "PP-4", "meeting_setting", "qualified");
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
      /* ADR-063 — the one seeded follow-up that is a BLANK submission: the
         09:00 Cairo default, left unmarked, so the demo carries an example of
         each shape (this row renders date-only; the other three show a clock). */
      data: { leadId: partnerLead.id, context: "initial", dueAt: new Date("2026-08-21T06:00:00Z"), method: "call" },
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
      data: { leadId: dealFu.id, context: "initial", dueAt: new Date("2026-08-23T10:00:00Z"), dueTimeSet: true, method: "message", ownerPortalRepId: seededRep.id }, // 13:00 Cairo, chosen (ADR-063)
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

  /* ---- ADR-073: MINDOO, the third company -------------------------------- */
  /* A handful of leads spread across its pipeline, so the board, the dashboard
     counts and the To-Do all have something real to draw. Mindoo runs the
     B-Systems pipeline, so `negotiation` is among them — a stage ByteForce does
     not have, which makes this seed the demo of the difference as well. All are
     internal and unowned: Mindoo has one staff role and no owner buckets. */
  if (seedDemo) {
    const mindooLeads: Array<[string, string, string]> = [
      ["Nile Freight", "Logistics", "new"],
      ["Delta Foods", "FMCG", "following_up"],
      ["Cairo Tech Park", "Real estate", "meeting_setting"],
      ["Horizon Clinics", "Healthcare", "sending_proposal"],
      ["Red Sea Resorts", "Hospitality", "negotiation"],
    ];
    let n = 0;
    for (const [name, industry, stage] of mindooLeads) {
      n += 1;
      const lead = await db.lead.create({
        data: {
          brand: "mindoo",
          ownerType: "internal",
          name,
          number: `0105000${String(100 + n)}`,
          type: "cold_call",
          companyName: name,
          industry,
          stage,
        },
      });
      /* `log` is scoped to the block above; the row is written directly here
         so every seeded lead still carries its creation entry (§5.6). */
      await db.activityLog.create({
        data: {
          entityType: "lead",
          entityId: lead.id,
          actorLabel: "Seed",
          action: "create",
          trigger: "T-0",
        },
      });
      if (stage === "following_up") {
        await db.followUp.create({
          data: {
            leadId: lead.id,
            context: "initial",
            dueAt: new Date("2026-09-03T07:00:00Z"),
            dueTimeSet: true,
            method: "call",
          },
        });
      }
      if (stage === "meeting_setting") {
        await db.meeting.create({
          data: {
            leadId: lead.id,
            arranged: true,
            datetime: new Date("2026-09-04T11:00:00Z"),
            mode: "online",
          },
        });
      }
    }
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
