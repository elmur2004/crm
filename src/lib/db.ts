import { PrismaClient } from "../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/* PrismaClient singleton. Prisma 7 requires a driver adapter (ADR-002 dev target is
   SQLite via better-sqlite3; the Postgres switch swaps in @prisma/adapter-pg here —
   one file). DATABASE_URL like "file:./dev.db", resolved relative to the repo root. */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
