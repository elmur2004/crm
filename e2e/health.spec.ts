import { expect, test } from "@playwright/test";

/* The production self-diagnostic must pass in a healthy environment. */
test("/api/health reports a fully healthy system", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; admin: { exists: boolean }; hints: string[] };
  expect(body.ok).toBe(true);
  expect(body.admin.exists).toBe(true);
});
