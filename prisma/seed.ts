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
    roles: ["bsystems_staff", "portal_admin"],
  });

  // ADR-016: portal admins are seeded, never self-signed-up
  await upsertUser({
    name: "Portal Admin",
    email: "admin@b-systems.example",
    password: "admin123",
    roles: ["portal_admin"],
  });

  const repUser = await upsertUser({
    name: "Karim Adel",
    phone: "01001234567",
    password: "partner123",
    roles: ["portal_rep"],
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
  for (const [brand, names] of [
    ["byteforce", ["Laila Mostafa", "Ahmed Samir"]],
    ["bsystems", ["Nour El-Din", "Mona Khalil"]],
  ] as const) {
    for (const name of names) {
      const existing = await db.salesRep.findFirst({ where: { brand, name } });
      if (!existing) await db.salesRep.create({ data: { brand, name } });
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
