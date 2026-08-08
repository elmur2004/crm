import { resetDb } from "../src/tests/db-reset";
import { seed } from "../prisma/seed";
import { db } from "../src/lib/db";

/* E2E database prep: wipe operational tables, reseed accounts + reps.
   Runs via tsx with DATABASE_URL=file:./e2e.db (playwright global setup). */

async function main() {
  await resetDb();
  await seed();
  await db.$disconnect();
  console.log("E2E db ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
