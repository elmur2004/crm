import { expect, test, type Page } from "@playwright/test";

/* Founder (same-stage records): "if I followed up with them and they need
   another follow-up, add a button inside the lead". The button records a
   SECOND follow-up from the lead detail; the card stays in Following Up and
   the To-Do swaps to the new date. Setup drives the existing APIs; only the
   new button is exercised through the UI. */

test("the lead detail records another follow-up without leaving Following Up", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Again Smoke Lead",
      number: "0106660001",
      type: "cold_call",
      companyName: "Again Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-01", time: "10:00", method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();

  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByRole("button", { name: "Log another follow-up" }).click();
  /* founder (ADR-063): the time input is back but OPTIONAL — left untouched
     here, which must submit cleanly and render exactly as ADR-061 did */
  await expect(page.getByLabel("Follow-up time (optional)")).toBeVisible();
  await expect(page.getByLabel("Follow-up time (optional)")).not.toHaveAttribute("required", "");
  await page.getByLabel("Follow-up date").fill("2026-09-08");
  await page.getByRole("button", { name: "Save record" }).click();

  /* two follow-up records now, and the stage badge has not moved */
  await expect(page.getByText("Following up", { exact: true })).toHaveCount(2);
  /* month abbreviation is ICU-dependent in en-GB ("Sep" / "Sept") — the day and
     year prove the NEW record landed, and with the time left blank it renders
     DATE-ONLY (ADR-061's norm, kept by ADR-063).
     ADR-068 widened the hour to \d{1,2}: the clock is twelve-hour now, so
     "9:00 AM" has a ONE-digit hour. Left at \d{2} this assertion would have gone
     on passing while proving nothing — the one test in the suite that got
     WEAKER by being left alone. */
  await expect(page.getByText(/Due 8 Sept? 2026/)).toBeVisible();
  await expect(page.getByText(/8 Sept? 2026, \d{1,2}:\d{2}/)).toHaveCount(0);

  await page.goto("/b-systems/crm");
  await expect(
    page.locator('[data-stage="following_up"] [data-deal-card="Again Smoke Lead"]'),
  ).toBeVisible();

  /* cleanup so the shared seed database stays predictable for later specs */
  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

/* ============================================================================
   ADR-068 — the negotiation response date reads as its own thing on the To-Do.

   Founder: "make sure that the response date is made in the to do list as see
   their response or check their response or check with them in the
   negotiations." So the row must be tellable-apart at a glance from an ordinary
   follow-up, in both languages, while keeping every To-Do behaviour it had.
   ========================================================================== */

const CAIRO_TZ = "Africa/Cairo";
const todayCairo = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO_TZ }).format(new Date());

/** One lead's row in a To-Do section, by the section's heading. */
const rowIn = (page: Page, section: string, name: string) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: section, exact: true }) })
    .locator("li")
    .filter({ has: page.getByRole("link", { name }) });

test("the negotiation response date is its own To-Do row, in both languages", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  /* one lead waiting on an answer, one owing an ordinary call — both due TODAY,
     so the difference on the page is the label and nothing else */
  const mk = async (name: string, number: string) => {
    const created = await page.request.post("/api/b-systems/leads", {
      data: { name, number, type: "cold_call", companyName: `${name} Co` },
    });
    expect(created.status()).toBe(201);
    return ((await created.json()) as { id: string }).id;
  };
  const event = async (id: string, action: string, group: unknown) => {
    const res = await page.request.post(`/api/b-systems/leads/${id}/event`, {
      data: { event: { type: "next_action", action }, group },
    });
    expect(res.ok()).toBeTruthy();
  };

  const plain = await mk("Plain Call Lead", "0107790001");
  await event(plain, "following_up", {
    group: "follow_up",
    data: { date: todayCairo(), time: "11:00", method: "call" },
  });

  const waiting = await mk("Awaiting Answer Lead", "0107790002");
  await event(waiting, "following_up", {
    group: "follow_up",
    data: { date: todayCairo(), time: "09:00", method: "call" },
  });
  await event(waiting, "negotiation", { group: "negotiation", data: { note: "Price talks" } });
  await event(waiting, "negotiation_follow_up", {
    group: "follow_up",
    data: { date: todayCairo(), time: "15:00", method: "call" },
  });

  await page.goto("/b-systems/todo");
  const answerRow = rowIn(page, "Today", "Awaiting Answer Lead");
  const callRow = rowIn(page, "Today", "Plain Call Lead");
  await expect(answerRow).toContainText("Check their response");
  await expect(answerRow).not.toContainText("Follow-up");
  await expect(callRow).toContainText("Follow-up");
  await expect(callRow).not.toContainText("Check their response");
  /* and it is a twelve-hour clock, like everything else (ADR-068) */
  await expect(answerRow).toContainText("3:00 PM");

  /* ADR-062 behaviour is intact: the checkbox moves it to Done, still under its
     own name, and unchecking restores it to Today. (.click(), not .check() —
     the checked state arrives with the refresh; the house pattern.) */
  const markBox = page.getByRole("checkbox", { name: "Mark done: Awaiting Answer Lead" });
  await expect(markBox).toBeVisible();
  await markBox.click();
  const restoreBox = page.getByRole("checkbox", {
    name: "Restore to Today: Awaiting Answer Lead",
  });
  await expect(restoreBox).toBeVisible();
  /* the Done list also holds the ORIGINAL follow-up this lead superseded on its
     way into Negotiation, so the row is picked by its own restore control —
     which is exactly the pair that proves the two kinds are told apart. */
  const doneRow = page.getByRole("listitem").filter({ has: restoreBox });
  await expect(doneRow).toContainText("Check their response");
  await expect(rowIn(page, "Today", "Awaiting Answer Lead")).toHaveCount(0);
  /* and its superseded predecessor is still filed as a plain Follow-up */
  await expect(
    page.getByRole("listitem").filter({ hasText: "Awaiting Answer Lead" }).first(),
  ).toContainText("Follow-up");

  await restoreBox.click();
  await expect(rowIn(page, "Today", "Awaiting Answer Lead")).toContainText("Check their response");

  /* Arabic: real Arabic, and NOT the plain follow-up word. Left last on
     purpose — the locale toggle is a server action, and re-navigating on its
     heels is a race, not a behaviour worth asserting. */
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const answerRowAr = rowIn(page, "اليوم", "Awaiting Answer Lead");
  await expect(answerRowAr).toContainText("التحقق من ردّهم");
  await expect(answerRowAr).toContainText("3:00 م");
  await expect(answerRowAr).not.toContainText("PM");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  for (const id of [plain, waiting]) {
    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  }
});
