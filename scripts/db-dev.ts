import { startLocalPostgres, urlFor } from "./local-postgres";

/* `npm run db:up` — the persistent local dev database (keep this terminal open;
   Ctrl+C stops it). DATABASE_URL in .env points here. */

const PORT = 5433;

async function main() {
  const pg = await startLocalPostgres({ name: "dev", port: PORT });
  console.log(`PostgreSQL (dev) ready on ${urlFor(PORT)} — Ctrl+C to stop.`);
  const stop = async () => {
    await pg.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await new Promise(() => undefined); // run until interrupted
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
