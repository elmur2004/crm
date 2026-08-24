import { expect, test, type Page } from "@playwright/test";

/* Founder (ADR-063): "let's get the time back for the follow up but it's not
   mandtory."

   The whole point is the ASYMMETRY, so every assertion here is a pair: record a
   follow-up leaving the time blank and the app must still print a bare date (a
   9:00 AM nobody chose is the failure mode ADR-063 exists to prevent); record
   one with a time and the clock comes back — on the lead's History, on the
   board card, and on the To-Do row.

   Follow-ups are dated TODAY throughout so the To-Do (Today-only since
   ADR-061) actually carries them. */

const CAIRO = "Africa/Cairo";
const cairoDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO }).format(new Date());
/* the app's own rendering (src/lib/datetime formatCairo) — same Node, same ICU,
   so "Sep" vs "Sept" can never split the test from the page */
const dateLabel = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

/** The newest follow-up's own line in the lead's History ("Due {when} · Call").
    A `.record-group` also carries the record's CREATION stamp, which always has
    a clock — so the assertion has to sit on this paragraph, never on the group. */
const dueLine = (page: Page) => page.locator("p").filter({ hasText: /^Due / }).last();

/** One lead's row in the To-Do's TODAY section. Scoped to that section on
    purpose: logging a second follow-up supersedes the first, which lands in
    Done (ADR-062) carrying the SAME lead name. */
const todayRow = (page: Page, name: string) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Today", exact: true }) })
    .locator("li")
    .filter({ has: page.getByRole("link", { name }) });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
}

/** A B-Systems lead parked in Following Up, its first follow-up due today with
    NO time — the ADR-061 date-only shape every existing row has. */
async function leadInFollowingUp(page: Page, name: string, number: string) {
  const created = await page.request.post("/api/b-systems/leads", {
    data: { name, number, type: "cold_call", companyName: `${name} Co` },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "drag", to: "following_up" },
      group: { group: "follow_up", data: { date: cairoDate(), method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

/** "Log another follow-up" on the lead detail — the founder's own path back to
    the form. `time` undefined ⇒ the box is never touched. */
async function logFollowUp(page: Page, leadId: string, time?: string) {
  await page.goto(`/b-systems/crm/lead/${leadId}`);
  await page.getByRole("button", { name: "Log another follow-up" }).click();
  await page.getByLabel("Follow-up date").fill(cairoDate());
  if (time) await page.getByLabel("Follow-up time (optional)").fill(time);
  await page.getByRole("button", { name: "Save record" }).click();
}

test("blank time ⇒ a date, chosen time ⇒ the clock — on History, the board and the To-Do", async ({
  page,
}) => {
  await login(page);
  const id = await leadInFollowingUp(page, "Optional Time Lead", "0107780001");
  const day = dateLabel();

  /* ---- 1. the field is there, optional, and blank submits cleanly ---- */
  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByRole("button", { name: "Log another follow-up" }).click();
  const timeBox = page.getByLabel("Follow-up time (optional)");
  await expect(timeBox).toBeVisible();
  await expect(timeBox).toHaveJSProperty("required", false);
  await expect(timeBox).toHaveValue("");
  await page.getByLabel("Follow-up date").fill(cairoDate());
  await page.getByRole("button", { name: "Save record" }).click();

  /* History prints a DAY — the trailing " · " proves no clock slipped in */
  await expect(dueLine(page)).toHaveText(new RegExp(`^Due ${day} · `));

  /* the board card's key datum: a day, no clock */
  await page.goto("/b-systems/crm");
  const card = page.locator('[data-deal-card="Optional Time Lead"]');
  await expect(card).toContainText(`Next: ${day}`);
  await expect(card).not.toContainText(`${day}, `);

  /* the To-Do row: a day, no clock */
  await page.goto("/b-systems/todo");
  await expect(todayRow(page, "Optional Time Lead")).toContainText(day);
  await expect(todayRow(page, "Optional Time Lead")).not.toContainText(`${day}, `);

  /* ---- 2. the same lead, this time with a time chosen ---- */
  await logFollowUp(page, id, "16:45");

  await expect(dueLine(page)).toHaveText(new RegExp(`^Due ${day}, 16:45 · `));

  await page.goto("/b-systems/crm");
  await expect(page.locator('[data-deal-card="Optional Time Lead"]')).toContainText(
    `Next: ${day}, 16:45`,
  );

  await page.goto("/b-systems/todo");
  await expect(todayRow(page, "Optional Time Lead")).toContainText(`${day}, 16:45`);

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

test("a late-evening time never moves a follow-up off its Cairo day (it is still Today)", async ({
  page,
}) => {
  /* founder guard: the time is a detail OF the day, never a reason to re-bucket
     it. 23:45 today must still be on TODAY's list (ADR-061 left no other). */
  await login(page);
  const id = await leadInFollowingUp(page, "Late Evening Lead", "0107780002");
  await logFollowUp(page, id, "23:45");

  await page.goto("/b-systems/todo");
  await expect(todayRow(page, "Late Evening Lead")).toContainText(`${dateLabel()}, 23:45`);

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

test("Arabic: the label reads وقت المتابعة (اختياري), and a chosen time still lands", async ({
  page,
}) => {
  await login(page);
  const id = await leadInFollowingUp(page, "Arabic Time Lead", "0107780003");

  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByRole("button", { name: "تسجيل متابعة أخرى" }).click();
  const timeBox = page.getByLabel("وقت المتابعة (اختياري)");
  await expect(timeBox).toBeVisible();
  await expect(timeBox).toHaveJSProperty("required", false);
  await page.getByLabel("تاريخ المتابعة").fill(cairoDate());
  await timeBox.fill("18:30");
  await page.getByRole("button", { name: "حفظ السجل" }).click();

  /* the record's own line keeps the clock — the date itself renders through the
     one en-GB formatter in both locales, so only the label is translated */
  await expect(page.locator("p").filter({ hasText: /18:30/ }).first()).toContainText(
    `${dateLabel()}, 18:30`,
  );

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});
