import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-067, decision 10 — NOTHING MAY BE QUIETLY LOST.

   The ByteForce app was retired as an interface, not as a body of work. Every
   screen, action, filter and board behaviour that was reachable at /byteforce
   is reachable in the merged shell, and this file is that checklist walked in a
   browser rather than in a diff. It also proves the other half of decision 6:
   that the two companies' genuinely different pipelines do not bleed into one
   another now that they share one address.

   Note the shape of these assertions. Almost every one is about ABSENCE — the
   column that must not appear, the section that must not be in the nav, the
   filter that must not survive a switch. A merged screen showing the right
   thing is easy; a merged screen showing the right thing AND NOTHING ELSE is
   the whole job.
   ========================================================================== */

async function loginFounder(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
}

const BF = "?company=byteforce";
const switcher = (page: Page) => page.getByRole("group", { name: "Switch company" });

/* ------------------------------------------- the eight ByteForce screens -- */

test("every ByteForce screen has a home in the merged shell, and shows ITS OWN content", async ({
  page,
}) => {
  await loginFounder(page);

  /* 1. Home — the ByteForce dashboard, not the B-Systems admin home. */
  await page.goto(`/b-systems${BF}`);
  await expect(page.getByText("BYTEFORCE", { exact: false }).first()).toBeVisible();

  /* 2. CRM board — ByteForce cards, and none of B-Systems'. */
  await page.goto(`/b-systems/crm${BF}`);
  await expect(page.locator('[data-deal-card="Cairo Textiles"]')).toBeVisible();
  await expect(page.locator('[data-deal-card="Delta Textiles"]')).toHaveCount(0);

  /* 3. Leads — the REP DIRECTORY, not the B-Systems table. This is the screen
     most easily lost to a merge that decides "Leads is the leads table". */
  await page.goto(`/b-systems/leads${BF}`);
  await expect(page.getByRole("link", { name: /Laila Mostafa/ })).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);

  /* 4. The per-rep drill-down, reached the way a person reaches it. */
  await page.getByRole("link", { name: /Laila Mostafa/ }).click();
  await page.waitForURL(/\/b-systems\/leads\/rep\/[^/?]+\?company=byteforce$/);
  await expect(page.getByRole("link", { name: "Cairo Textiles" })).toBeVisible();

  /* 5. ...and its ARCHIVED tab, the only door to the ByteForce archive. */
  await page.getByRole("link", { name: "Archived" }).click();
  await page.waitForURL(/view=archived/);
  await expect(page).toHaveURL(/company=byteforce/);
  await expect(page.getByRole("link", { name: "Archived" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  /* 6. The lead detail. */
  await page.goto(`/b-systems/crm${BF}`);
  await page.locator('[data-deal-card="Cairo Textiles"]').first().click();
  await page.waitForURL(/\/b-systems\/leads\/lead\/[^/?]+\?company=byteforce$/);
  await expect(page.getByRole("heading", { name: "Cairo Textiles" })).toBeVisible();

  /* 7. The call sheet, with its dial link. */
  await page.getByRole("link", { name: "Call" }).first().click();
  await page.waitForURL(/\/call\?company=byteforce$/);
  await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();

  /* 8. Clients — ByteForce's own won screen, and NOT an alias of B-Systems'
     Won Leads: they are different tables carrying different facts. */
  await page.goto(`/b-systems/clients${BF}`);
  await expect(page.getByText("Cairo Medical Group").first()).toBeVisible();
  await expect(page.getByText("Delta Medical Group")).toHaveCount(0);

  /* 9. The To-Do, ByteForce's plain daily list. */
  await page.goto(`/b-systems/todo${BF}`);
  await expect(page).toHaveURL(/company=byteforce/);
  await expect(page.locator("h1").first()).toBeVisible();
});

/* ------------------------------------------- two pipelines, one shell ----- */

test("the two boards stay two pipelines: Negotiation is B-Systems' alone", async ({ page }) => {
  await loginFounder(page);

  /* B-Systems: EIGHT stages since ADR-072 added Postpone, negotiation among
     them. The counts moved by exactly one on each side — the new column is a
     stage BOTH internal pipelines carry, so it can never be the thing that
     tells the two boards apart. Negotiation still is, and that is what this
     case is actually about. */
  await page.goto("/b-systems/crm?company=bsystems");
  await expect(page.locator(".board [data-stage]")).toHaveCount(8);
  await expect(page.locator('[data-stage="negotiation"]')).toHaveCount(1);
  await expect(page.locator('[data-stage="postponed"]')).toHaveCount(1);

  /* switch — and the COLUMNS change, not just the cards standing in them. */
  await switcher(page).getByRole("link", { name: "ByteForce" }).click();
  await page.waitForURL(/\/b-systems\/crm\?company=byteforce$/);
  await expect(page.locator(".board [data-stage]")).toHaveCount(7);
  await expect(page.locator('[data-stage="negotiation"]')).toHaveCount(0);
  await expect(page.locator('[data-stage="postponed"]')).toHaveCount(1);
});

test("a filter does not follow you across the switch, looking applied when it is not", async ({
  page,
}) => {
  await loginFounder(page);

  /* Owner buckets are a B-Systems idea and the ByteForce board reads nothing
     of them. Carrying one over would leave a board that LOOKS filtered and is
     not, which reads as data loss rather than as a nav bug. */
  await page.goto("/b-systems/crm?company=bsystems&owner=agent&q=Delta&type=cold_call");
  await switcher(page).getByRole("link", { name: "ByteForce" }).click();
  await page.waitForURL(/company=byteforce/);
  await expect(page).toHaveURL(/\/b-systems\/crm\?company=byteforce$/);
  await expect(page).not.toHaveURL(/owner=/);
  await expect(page).not.toHaveURL(/q=/);
  /* and the board proves it by showing a card the carried filter would hide */
  await expect(page.locator('[data-deal-card="Cairo Fresh Foods"]')).toBeVisible();
});

test("board behaviour is per-company: a tally on one company's card is not on the other's", async ({
  page,
}) => {
  await loginFounder(page);

  await page.goto(`/b-systems/crm${BF}`);
  const bfCard = page.locator('[data-deal-card="Cairo Fresh Foods"]');
  await bfCard.getByRole("button", { name: /answer/i }).first().click();
  await expect(bfCard.getByText("No answer", { exact: true })).toBeVisible();

  /* the twin card in the other company's pipeline is untouched */
  await page.goto("/b-systems/crm?company=bsystems");
  const bsCard = page.locator('[data-deal-card="Delta Fresh Foods"]');
  await expect(bsCard).toBeVisible();
  await expect(bsCard.getByText("No answer", { exact: true })).toHaveCount(0);

  /* and it survives the trip back: it is the LEAD's tally, not the screen's */
  await page.goto(`/b-systems/crm${BF}`);
  await expect(bfCard.getByText("No answer", { exact: true })).toBeVisible();
  await bfCard.getByRole("button", { name: "Answered" }).click();
  await expect(bfCard.getByText("No answer", { exact: true })).toHaveCount(0);
});

/* ------------------------------- the company-exclusive sections ----------- */

test("each company's exclusive sections refuse the other rather than emptying", async ({
  page,
}) => {
  await loginFounder(page);

  /* ByteForce has no Won Leads, Statements, Users... — asking for them under
     ByteForce lands on ByteForce's home, never on an empty foreign screen and
     never on a stack trace. */
  for (const path of [
    "/b-systems/won-leads",
    "/b-systems/statements",
    "/b-systems/users",
    "/b-systems/registrations",
    "/b-systems/agents",
    "/b-systems/partners",
    "/b-systems/partners-pipeline",
  ]) {
    const res = await page.goto(`${path}${BF}`);
    expect(res?.status(), `${path} must refuse without erroring`).toBe(200);
    await expect(page, path).toHaveURL(/\/b-systems\?company=byteforce$/);
  }

  /* and the reverse: ByteForce's own screens are not B-Systems screens */
  for (const path of ["/b-systems/clients", "/b-systems/leads/rep/unassigned"]) {
    const res = await page.goto(`${path}?company=bsystems`);
    expect(res?.status(), `${path} must refuse without erroring`).toBe(200);
    await expect(page, path).toHaveURL(/\/b-systems\?company=bsystems$/);
  }
});
