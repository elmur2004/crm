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
   so "Sep" vs "Sept" can never split the test from the page.
   ADR-068: Arabic renders in Arabic now (Arabic month name, Arabic comma,
   LATIN digits), so the label is per-locale. */
const dateLabel = (locale: "en" | "ar" = "en") =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
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

  await expect(dueLine(page)).toHaveText(new RegExp(`^Due ${day}, 4:45 PM · `));

  await page.goto("/b-systems/crm");
  await expect(page.locator('[data-deal-card="Optional Time Lead"]')).toContainText(
    `Next: ${day}, 4:45 PM`,
  );

  await page.goto("/b-systems/todo");
  await expect(todayRow(page, "Optional Time Lead")).toContainText(`${day}, 4:45 PM`);

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

/* ADR-068 — the founder's twelve-hour clock, proved on a screen rather than
   only in datetime.test.ts: a morning follow-up and an afternoon one on the
   same day must read AM and PM, and NOTHING anywhere may print a 13:00-23:00
   hour. The negative assertion is the one that catches a call site somebody
   forgot to thread the locale through. */
test("the To-Do and the board read a twelve-hour clock — AM, PM, and no 24-hour hour anywhere", async ({
  page,
}) => {
  await login(page);
  const morning = await leadInFollowingUp(page, "Morning Clock Lead", "0107780004");
  const evening = await leadInFollowingUp(page, "Evening Clock Lead", "0107780005");
  await logFollowUp(page, morning, "09:30");
  await logFollowUp(page, evening, "20:15");

  await page.goto("/b-systems/todo");
  await expect(todayRow(page, "Morning Clock Lead")).toContainText("9:30 AM");
  await expect(todayRow(page, "Evening Clock Lead")).toContainText("8:15 PM");
  /* hours 13-23 can only come out of a 24-hour renderer */
  await expect(page.getByText(/\b(1[3-9]|2[0-3]):[0-5][0-9]\b/)).toHaveCount(0);

  await page.goto("/b-systems/crm");
  await expect(page.locator('[data-deal-card="Evening Clock Lead"]')).toContainText("8:15 PM");
  await expect(page.getByText(/\b(1[3-9]|2[0-3]):[0-5][0-9]\b/)).toHaveCount(0);

  /* and the same page in Arabic: the marker is م, never a latin PM */
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator('[data-deal-card="Evening Clock Lead"]')).toContainText("8:15 م");
  await expect(page.locator('[data-deal-card="Evening Clock Lead"]')).not.toContainText("PM");
  await expect(page.getByText(/\b(1[3-9]|2[0-3]):[0-5][0-9]\b/)).toHaveCount(0);

  for (const id of [morning, evening]) {
    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  }
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
  await expect(todayRow(page, "Late Evening Lead")).toContainText(`${dateLabel()}, 11:45 PM`);

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

  /* the record's own line keeps the clock — and since ADR-068 it reads as a
     twelve-hour Arabic clock: Arabic month name, Arabic comma, LATIN digits,
     and CLDR's own evening marker م rather than a latin PM. (A "6:30 م" glued
     to an English date would render bidi-reversed in an RTL paragraph — the
     marker parked against the DATE — which is why the whole string is Arabic.) */
  await expect(page.locator("p").filter({ hasText: /6:30/ }).first()).toContainText(
    `${dateLabel("ar")}، 6:30 م`,
  );
  await expect(page.locator("p").filter({ hasText: /6:30/ }).first()).not.toContainText("PM");

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});
