import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-080 — MINDOO IS GONE, PROVED BY ABSENCE.

   Founder: "remove mindoo completely / remove the portal the users the deals and
   everything related to mindoo I will do a separate system completly for it."

   Every assertion in this file is about something NOT being there, which is the
   only shape that can prove a removal. A suite grown alongside a feature asserts
   what the feature does; a removal has to be written from the other direction —
   the address that must not serve, the login that must not open a door, the card
   that must not be on the board, the tab that must not be in a nav.

   It also covers the one thing a compiler cannot: `Lead.brand` is a plain String
   column (ADR-002), so shrinking the `Brand` union does not empty the table. The
   purge migration does that, and this file asserts the RESULT rather than the
   migration — no lead, no book, no vault row and no account of that company
   survives anywhere a screen can reach.
   ========================================================================== */

async function loginFounder(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
}

test("no /mindoo address serves an app any more", async ({ page }) => {
  await loginFounder(page);
  /* the app root, one page under it, and the API namespace. The proxy no longer
     matches this prefix at all, so what answers is the framework's own 404 —
     which is the honest answer for a route group that does not exist. */
  for (const path of [
    "/mindoo",
    "/mindoo/crm",
    "/mindoo/leads",
    "/mindoo/users",
    "/mindoo/won-leads",
  ]) {
    const res = await page.request.get(path);
    expect(res.status(), `${path} still serves something`).toBe(404);
  }
  for (const path of ["/api/mindoo/leads", "/api/mindoo/users", "/api/mindoo/reps"]) {
    const res = await page.request.post(path, { data: {} });
    expect(res.status(), `${path} still answers`).toBe(404);
  }
});

test("the retired administrator cannot sign in, and nothing heals it back", async ({ page }) => {
  /* `ensureAdminExists` ran on EVERY sign-in attempt and re-created this account
     from the bootstrap table if it was missing — so deleting the row without
     taking the table entry out would have restored it on the next login. This
     asserts the pair: the credential is refused, and it is STILL refused on a
     second attempt, which is the attempt a self-healing table would have fixed. */
  for (const attempt of [1, 2]) {
    await page.goto("/login");
    await page.getByLabel("Email or phone").fill("admin@mindoo.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page, `attempt ${attempt} signed in`).toHaveURL(/\/login/);
    await expect(page.getByText("Wrong email/phone or password. Try again.")).toBeVisible();
  }
  /* and the health endpoint, whose admin list comes from the bootstrap itself,
     does not name it — the only way to ask a deployment what it believes in */
  const health = await page.request.get("/api/health");
  const body = (await health.json()) as { admins: Array<{ email: string }> };
  expect(body.admins.map((a) => a.email)).not.toContain("admin@mindoo.com");
  expect(body.admins.map((a) => a.email)).toContain("admin@byteforce.com");
});

test("the ByteForce board shows no purple cards, and the money layer is EGP only", async ({
  page,
}) => {
  await loginFounder(page);
  await page.goto("/b-systems/crm?company=byteforce");
  /* the cards the founder was looking at when he asked for this. The CSS hook
     and the label chip are both gone, so this fails on either coming back. */
  await expect(page.locator("[data-foreign-company]")).toHaveCount(0);
  await expect(page.locator(".bcard-company")).toHaveCount(0);
  /* ByteForce's own cards are still there — a board that renders nothing would
     pass the assertion above and be a much worse outcome */
  await expect(page.locator("[data-deal-card]").first()).toBeVisible();
  /* and no screen quotes a second currency: ADR-077's riyals went with the
     company that used them, so SPEC §2 ("Currency: EGP") holds again */
  await expect(page.locator("body")).not.toContainText(/SAR/);
  await expect(page.locator("body")).toContainText("EGP");
});

test("no lead, book, vault row or account of that company survives a search", async ({ page }) => {
  await loginFounder(page);

  /* the CRM's own search, on both boards — the purge means there is nothing to
     find, and the shrunken Brand union means nothing would render if there were */
  for (const company of ["byteforce", "bsystems"]) {
    await page.goto(`/b-systems/crm?company=${company}&q=Nile`);
    await expect(page.locator('[data-deal-card="Nile Freight"]')).toHaveCount(0);
    await page.goto(`/b-systems/crm?company=${company}&q=Alexandria`);
    await expect(page.locator('[data-deal-card="Alexandria Marine"]')).toHaveCount(0);
  }

  /* the Users table: the retired account is not listed, under any tab */
  await page.goto("/b-systems/users");
  await expect(page.getByText("admin@mindoo.com")).toHaveCount(0);
  await expect(page.getByText("mona@mindoo.example")).toHaveCount(0);
  /* the founder's own account is still listed, so an empty page cannot pass */
  await expect(page.getByText("admin@byteforce.com").first()).toBeVisible();

  /* the two modules offer exactly the two companies again — a tab for a company
     that does not exist is the most visible half of this removal */
  await page.goto("/accounting");
  const acctTabs = page.getByRole("group", { name: /company/i });
  if (await acctTabs.count()) {
    await expect(acctTabs).not.toContainText("Mindoo");
  }
  await expect(page.locator("body")).not.toContainText("Mindoo");
  await page.goto("/vault");
  await expect(page.locator("body")).not.toContainText("Mindoo");
});

test("a proposal can still be corrected in place — the half of ADR-078 that stays", async ({
  page,
}) => {
  /* ADR-080 removed ADR-077's riyals and its ByteForce sub-price, both of which
     existed only because a second company did. The EDIT BUTTON on a proposal did
     not: the founder asked for it separately ("put an edit button in the proposal
     inside the lead") and it is a correction path for a figure that drives the
     pipeline value, the Won gate and an agent's commission. This is the assertion
     that keeps the two halves separated. */
  await loginFounder(page);
  await page.goto("/b-systems/crm?company=bsystems");
  const card = page.locator('[data-stage="sending_proposal"] [data-deal-card]').first();
  await expect(card).toBeVisible();
  await card.locator("a.bcard-name").click();
  await page.waitForURL(/\/b-systems\/crm\/lead\//);

  await expect(page.getByRole("heading", { name: "Stage records" })).toBeVisible();
  const edit = page.getByRole("button", { name: "Edit", exact: true }).first();
  await expect(edit).toBeVisible();
  await edit.click();
  /* the amount field names its currency, and there is only one to name now */
  await expect(page.getByLabel("Estimated value (EGP)")).toBeVisible();
  await page.getByLabel("Estimated value (EGP)").fill("41000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("EGP 41,000").first()).toBeVisible();

  /* and the Mindoo-only panel beside it is gone */
  await expect(page.getByText("ByteForce share of this deal")).toHaveCount(0);
});
