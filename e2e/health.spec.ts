import { expect, test } from "@playwright/test";

/* The production self-diagnostic must pass in a healthy environment. */
test("/api/health reports a fully healthy system", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    ok: boolean;
    admin: { exists: boolean };
    schemaCurrent: boolean;
    pendingMigrations: string[];
    hints: string[];
  };
  expect(body.ok).toBe(true);
  expect(body.admin.exists).toBe(true);
  /* ADR-057 — the probe compares the committed migration folders against
     `_prisma_migrations`, so a DATA-ONLY migration that never applied can no
     longer hide behind a green check. */
  expect(body.schemaCurrent).toBe(true);
  expect(body.pendingMigrations).toEqual([]);
});
