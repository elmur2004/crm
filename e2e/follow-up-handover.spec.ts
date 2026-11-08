import { expect, test, type Page } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* ============================================================================
   Founder (2026-11-08), verbatim: "when I log a follow-up, I should be able to
   assign it to somebody so they have that follow-up in their follow-up column.
   Even if they are not assigned the lead from the first or from the beginning,
   I can like redirect the lead for them for follow-up." Asked what that does to
   the lead: "The lead moves to them."

   So: the company admin's follow-up form carries "Hand this follow-up to"; the
   follow-up is recorded AND the lead becomes the assignee's, in one move — and
   the assignee, who could not see the lead before, finds it in his Following Up
   column and on his To-Do the same day. Both companies.
   ========================================================================== */

const cairoDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

test("B-Systems: the admin hands a follow-up to Omar — Omar finds the lead in Following Up and on his To-Do", async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* a fresh lead the admin owns (admin bucket) — Omar cannot see it yet */
  const created = await admin.request.post("/api/b-systems/leads", {
    data: { name: "Handover Follow Co", number: "0109991201", type: "cold_call", companyName: "Handover Follow" },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const salesCtx = await browser.newContext();
  const omar = await salesCtx.newPage();
  await login(omar, "omar@b-systems.example", "bsystems123", /\/b-systems\/crm$/);
  await expect(omar.locator('[data-deal-card="Handover Follow Co"]')).toHaveCount(0);

  /* the admin records the follow-up on the lead page and hands it to Omar */
  await admin.goto(`/b-systems/crm/lead/${id}?company=bsystems`);
  await admin.getByLabel("Next action").selectOption("following_up");
  await admin.getByLabel("Follow-up date").fill(cairoDate());
  await admin.getByLabel("Method").selectOption("call");
  const handOver = admin.getByLabel("Hand this follow-up to");
  await expect(handOver).toHaveValue(""); // "Keep the current owner"
  await handOver.selectOption({ label: "Omar Farouk — Internal sales" });
  await admin.getByRole("button", { name: "Save & move" }).click();
  await expect(admin.getByRole("heading", { level: 1 }).getByText("Following Up")).toBeVisible();
  /* the hand-over is on the record, named for the person who did it */
  await expect(admin.getByText(/Omar Farouk/).first()).toBeVisible();

  /* Omar: the lead is his now — on his board in Following Up … */
  await omar.goto("/b-systems/crm?company=bsystems");
  await expect(
    omar.locator('[data-stage="following_up"] [data-deal-card="Handover Follow Co"]'),
  ).toBeVisible();
  /* … on his To-Do, today … */
  await omar.goto("/b-systems/todo?company=bsystems");
  await expect(omar.getByRole("link", { name: "Handover Follow Co" })).toBeVisible();
  /* … in his bell … */
  const bell = await omar.request.get("/api/b-systems/notifications");
  const items = (await bell.json()) as Array<{ type: string; leadId: string | null }>;
  expect(items.some((n) => n.type === "assigned" && n.leadId === id)).toBe(true);
  /* … and the hand-over select is not his to use */
  await omar.goto(`/b-systems/crm/lead/${id}?company=bsystems`);
  await omar.getByRole("button", { name: "Log another follow-up" }).click();
  await expect(omar.getByLabel("Hand this follow-up to")).toHaveCount(0);

  await adminCtx.close();
  await salesCtx.close();
});

test("ByteForce: the admin hands a follow-up to Sara on an unassigned lead — it moves to her", async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@byteforce.com", "password123", /\/b-systems\/crm\?company=byteforce$/);
  /* the admin's own new lead, left UNASSIGNED (his queue) */
  const created = await admin.request.post("/api/byteforce/leads", {
    data: { name: "BF Handover Co", number: "0109991202", type: "cold_call" },
  });
  expect(created.status()).toBe(201);
  const { id, ownerUserId } = (await created.json()) as { id: string; ownerUserId: string | null };
  expect(ownerUserId).toBeNull();

  const saraCtx = await browser.newContext();
  const sara = await saraCtx.newPage();
  await login(sara, "sara@byteforce.example", "byteforce123", /\/b-systems\/crm\?company=byteforce$/);
  await expect(sara.locator('[data-deal-card="BF Handover Co"]')).toHaveCount(0);
  const before = await sara.goto(`/b-systems/leads/lead/${id}?company=byteforce`);
  expect(before?.status()).toBe(404);

  await admin.goto(`/b-systems/leads/lead/${id}?company=byteforce`);
  await expect(admin.locator('[data-field="owner"]')).toContainText("Unassigned");
  await admin.getByLabel("Next action").selectOption("following_up");
  await admin.getByLabel("Follow-up date").fill(cairoDate());
  await admin.getByLabel("Method").selectOption("call");
  await admin.getByLabel("Hand this follow-up to").selectOption({ label: "Sara Hassan" });
  await admin.getByRole("button", { name: "Save & move" }).click();
  await expect(admin.locator('[data-field="owner"]')).toContainText("Sara Hassan");

  await sara.goto("/b-systems/crm?company=byteforce");
  await expect(
    sara.locator('[data-stage="following_up"] [data-deal-card="BF Handover Co"]'),
  ).toBeVisible();
  await sara.goto("/b-systems/todo?company=byteforce");
  await expect(sara.getByRole("link", { name: "BF Handover Co" })).toBeVisible();
  const after = await sara.goto(`/b-systems/leads/lead/${id}?company=byteforce`);
  expect(after?.status()).toBe(200);

  await adminCtx.close();
  await saraCtx.close();
});
