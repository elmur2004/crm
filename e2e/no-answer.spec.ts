import { expect, test } from "@playwright/test";

/* Founder (ADR-039): the "didn't answer" marker on the main CRM board — a
   toggle on the card shows a "No answer" badge "just so we know"; clearing it
   removes the badge. A FLAG, not a stage: the card never leaves its column.

   Founder (ADR-064): "make the didn't answer button a counter so we can know
   how many times we tried." Same badge, same column, but the button counts now:
   one press = one attempt, the number rides the badge from the second try on,
   and Answered resets it to nothing. */

test('admin flags a card "Didn\'t answer", sees the badge, then clears it', async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  await page.goto("/b-systems/crm");
  /* Scoped to the New column: proves the toggle is not a stage transition. */
  const card = page
    .locator('[data-stage="new"]')
    .locator('[data-deal-card="Delta Fresh Foods"]');
  await expect(card).toBeVisible();
  await expect(card.getByText("No answer", { exact: true })).toHaveCount(0);

  await card.getByRole("button", { name: "Didn't answer" }).click();
  await expect(card.getByText("No answer", { exact: true })).toBeVisible();

  /* The badge also shows on the lead detail header. */
  await card.getByRole("link", { name: "Delta Fresh Foods" }).click();
  await page.waitForURL(/\/b-systems\/crm\/lead\//);
  await expect(page.getByText("No answer", { exact: true })).toBeVisible();

  /* Back on the board: clear it — badge gone, card still in New. */
  await page.goto("/b-systems/crm");
  await card.getByRole("button", { name: "Answered — clear flag" }).click();
  await expect(card.getByText("No answer", { exact: true })).toHaveCount(0);
  await expect(card).toBeVisible();
});

test("the button COUNTS: a second try reads 2, a third reads 3, and Answered wipes it (ADR-064)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  await page.goto("/b-systems/crm");
  const card = page
    .locator('[data-stage="new"]')
    .locator('[data-deal-card="Delta Fresh Foods"]');
  const badge = card.locator(".badge--noanswer");
  const tryAgain = card.getByRole("button", { name: "Didn't answer" });
  await expect(badge).toHaveCount(0);

  /* ONE attempt reads as the plain marker — a bare "· 1" would be noise, and
     the sentence that says what the badge means rides its label */
  await tryAgain.click();
  await expect(badge).toHaveText("No answer");
  await expect(badge).toHaveAttribute("aria-label", "Tried once");
  await expect(badge).toHaveAttribute("title", "Tried once");

  /* the SECOND press is the whole point: it must still be offered, and count */
  await expect(tryAgain).toBeVisible();
  await tryAgain.click();
  await expect(badge).toHaveText("No answer · 2");
  await expect(badge).toHaveAttribute("aria-label", "Tried 2 times");

  await tryAgain.click();
  await expect(badge).toHaveText("No answer · 3");
  /* review — the sentence must be the badge's ACCESSIBLE NAME, not merely an
     attribute in the DOM. `aria-label` on a bare <span> (role=generic) is
     prohibited by ARIA and conforming screen readers drop it, so the badge
     carries role="img"; `getByRole` resolves the computed name and would fail
     if that role were ever removed, which toHaveAttribute alone cannot catch. */
  await expect(card.getByRole("img", { name: "Tried 3 times" })).toBeVisible();

  /* the same number on the lead detail and on the call sheet — one badge,
     one truth, wherever the marker shows */
  await card.getByRole("link", { name: "Delta Fresh Foods" }).click();
  await page.waitForURL(/\/b-systems\/crm\/lead\//);
  const leadUrl = page.url();
  await expect(page.locator(".badge--noanswer")).toHaveText("No answer · 3");
  await page.goto(`${leadUrl}/call`);
  await expect(page.locator(".badge--noanswer")).toHaveText("No answer · 3");

  /* Answered wipes the tally — and counting starts fresh, not resumed */
  await page.goto("/b-systems/crm");
  await card.getByRole("button", { name: "Answered — clear flag" }).click();
  await expect(badge).toHaveCount(0);
  /* with nothing to clear, only the counter button is offered */
  await expect(card.getByRole("button", { name: "Answered — clear flag" })).toHaveCount(0);
  await tryAgain.click();
  await expect(badge).toHaveText("No answer");

  /* leave the seeded card as we found it */
  await card.getByRole("button", { name: "Answered — clear flag" }).click();
  await expect(badge).toHaveCount(0);
});

test("Arabic: the tally reads right-to-left, in real Arabic (ADR-064)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  await page.goto("/b-systems/crm");
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const card = page
    .locator('[data-stage="new"]')
    .locator('[data-deal-card="Delta Fresh Foods"]');
  const badge = card.locator(".badge--noanswer");
  const tryAgain = card.getByRole("button", { name: "لم يرد على الاتصال" });

  await tryAgain.click();
  await expect(badge).toHaveText("لم يرد");
  await expect(badge).toHaveAttribute("aria-label", "محاولة واحدة");
  await tryAgain.click();
  /* the Today chip's own "label · n" shape, which already reads correctly in
     RTL; the sentence stays count-agnostic Arabic ("عدد المحاولات: 2") */
  await expect(badge).toHaveText("لم يرد · 2");
  await expect(badge).toHaveAttribute("aria-label", "عدد المحاولات: 2");

  await card.getByRole("button", { name: "تم الرد — إزالة العلامة" }).click();
  await expect(badge).toHaveCount(0);
});

/* ============================================================================
   ADR-082 — THE PRESS LOGS TOMORROW'S FOLLOW-UP BY ITSELF.

   The founder: "whenever I log didn't answer for someone who's in the following
   up column in the day of the follow up it automatically logs another follow up
   until he answers."

   The service tests pin the gate and the Cairo arithmetic on named days. These
   two pin what only the browser can show: that one press on the board changes
   the card's own key datum from today to tomorrow, and that ONE click of Undo
   puts the card back with no phantom follow-up left behind.
   ========================================================================== */

const cairoDay = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

/* the app's own rendering (lib/datetime formatCairo) — same Node, same ICU, so
   "Sep" vs "Sept" can never split the test from the page */
const dayLabel = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));

async function loginFounder(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
}

async function leadDueOn(page: import("@playwright/test").Page, name: string, number: string, date: string) {
  const created = await page.request.post("/api/b-systems/leads", {
    data: { name, number, type: "cold_call", companyName: `${name} Co` },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date, method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

test("a press on a follow-up due TODAY books tomorrow — the card says so (ADR-082)", async ({
  page,
}) => {
  await loginFounder(page);
  const id = await leadDueOn(page, "Auto Chase Lead", "0107776001", cairoDay());

  await page.goto("/b-systems/crm");
  const card = page.locator('[data-deal-card="Auto Chase Lead"]');
  await expect(card).toContainText(`Next: ${dayLabel()}`);

  await card.getByRole("button", { name: "Didn't answer" }).click();

  /* the key datum is the LIVE follow-up, so it now reads TOMORROW — and the
     tally counted the attempt in the same press */
  await expect(card).toContainText(`Next: ${dayLabel(1)}`);
  await expect(card.getByText("No answer", { exact: true })).toBeVisible();
  /* a date-only booking: no clock, because the system picked the day */
  await expect(card).not.toContainText(`${dayLabel(1)},`);

  /* the lead's history says the system did it, not him */
  await page.goto(`/b-systems/crm/lead/${id}`);
  await expect(
    page.getByText("Next follow-up logged automatically — still no answer"),
  ).toBeVisible();

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

test("Undo removes the auto-logged follow-up too — no phantom left behind (ADR-082)", async ({
  page,
}) => {
  /* THE TRAP. The press is undoable (ADR-045) and its payload restored the flag
     and the tally; it now also carries the follow-up it wrote. An undo that left
     that row behind would put the lead back on tomorrow's list with nothing on
     any screen to explain it. */
  await loginFounder(page);
  const id = await leadDueOn(page, "Auto Undo Lead", "0107776002", cairoDay());

  await page.goto("/b-systems/crm");
  const card = page.locator('[data-deal-card="Auto Undo Lead"]');
  await card.getByRole("button", { name: "Didn't answer" }).click();
  await expect(card).toContainText(`Next: ${dayLabel(1)}`);

  await page.getByRole("button", { name: /^Undo:/ }).click();
  /* the stored label, named exactly — the toast's <p> also carries the "!" icon
     span, so its normalized text starts with "!" and an anchored /^Undone:/
     could never match it (and a bare /Undone:/ would pass on any undo at all) */
  await expect(page.getByText("Undone: Flagged Auto Undo Lead as no answer")).toBeVisible();

  await page.goto("/b-systems/crm");
  const back = page.locator('[data-deal-card="Auto Undo Lead"]');
  /* exactly as it was: today's date, no marker */
  await expect(back).toContainText(`Next: ${dayLabel()}`);
  await expect(back).not.toContainText(dayLabel(1));
  await expect(back.getByText("No answer", { exact: true })).toHaveCount(0);

  /* and tomorrow's To-Do is not carrying a follow-up nobody owns: the lead's
     own record count is the honest check, read through the API */
  const detail = await page.request.get(`/api/b-systems/leads/${id}`);
  if (detail.ok()) {
    const body = (await detail.json()) as { followUps?: unknown[] };
    if (Array.isArray(body.followUps)) expect(body.followUps).toHaveLength(1);
  }

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

test("a press on a follow-up due LATER books nothing — and neither does a fallen-behind one", async ({
  page,
}) => {
  /* His instruction, in the browser: "no keep it fallen behind in a separate
     column I will pick it up and make another follow up date." */
  await loginFounder(page);
  const future = await leadDueOn(page, "Future Chase Lead", "0107776003", cairoDay(3));
  const behind = await leadDueOn(page, "Behind Chase Lead", "0107776004", cairoDay(-4));

  await page.goto("/b-systems/crm");
  const futureCard = page.locator('[data-deal-card="Future Chase Lead"]');
  await futureCard.getByRole("button", { name: "Didn't answer" }).click();
  await expect(futureCard.getByText("No answer", { exact: true })).toBeVisible();
  /* the date did NOT move */
  await expect(futureCard).toContainText(`Next: ${dayLabel(3)}`);

  const behindCard = page.locator('[data-deal-card="Behind Chase Lead"]');
  await behindCard.getByRole("button", { name: "Didn't answer" }).click();
  await expect(behindCard.getByText("No answer", { exact: true })).toBeVisible();
  await expect(behindCard).toContainText(`Next: ${dayLabel(-4)}`);

  for (const id of [future, behind]) {
    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  }
});
