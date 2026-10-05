import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-081 — THE DAILY REPORT, end to end.

   Founder: "how many leads did he take action on, even if this action was didn't
   answer, or move through the CRM, or a comment on any lead — and which leads
   had these changes. This report should be dynamic, so when I click on the lead
   I go to the lead... Also it should have a display on the number: how many
   leads did you interact with this day, and what interactions were those."

   THE SEEDED HISTORY IS UNATTRIBUTED (prisma/seed.ts writes every demo lead's
   log rows with actorId null, "Seed"), so a freshly seeded account has a report
   of zeros however rich its board looks. Every case here therefore performs a
   REAL action as the signed-in user first — which is also the honest way to test
   a projection: the rows come from the product, not from a fixture.

   Setup drives the existing APIs rather than the UI (the e2e/todo.spec.ts
   pattern): no flaky choreography, and the report is read through the browser,
   which is the half that matters.
   ========================================================================== */

const LEAD_A = "ADR-081 Report Lead A";
const LEAD_B = "ADR-081 Report Lead B";
const BF_LEAD = "ADR-081 ByteForce Report Lead";

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const loginAsFounder = (page: Page) =>
  login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

/** Today's CAIRO wall date — what the follow-up form would submit. */
const cairoToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

async function createLead(page: Page, api: string, name: string, number: string): Promise<string> {
  const res = await page.request.post(`${api}/leads`, {
    data: { name, number, type: "cold_call", companyName: "ADR-081 Co" },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

const openReport = async (page: Page, company: "bsystems" | "byteforce") => {
  await page.goto(`/b-systems/daily-report?company=${company}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Daily report");
};

/** The three number tiles, in day order (today first). */
const tileValues = (page: Page) => page.locator(".tile .tile-value");

test.describe("ADR-081 — the daily report", () => {
  test("the count is DISTINCT LEADS, and each row carries what he did to it", async ({ page }) => {
    await loginAsFounder(page);
    const api = "/api/b-systems";

    /* READ THE NUMBER FIRST, and assert the DELTA. The whole suite shares one
       seeded database and the specs that run before this one also act on leads as
       the founder, so an absolute "2" is an assertion about test ORDER rather than
       about the feature. Six actions on two new leads must move the headline by
       exactly TWO — which is the property he asked for, stated in a way no other
       spec can break. */
    await openReport(page, "bsystems");
    const before = Number(await tileValues(page).first().innerText());

    const a = await createLead(page, api, LEAD_A, "0109810001");
    const b = await createLead(page, api, LEAD_B, "0109810002");

    /* FOUR more actions on lead A — a stage move, a didn't-answer, a comment and
       a WhatsApp mark — and ONE on lead B. Six actions, TWO leads.

       ADR-082 — the didn't-answer press is now worth TWO log rows, not one: the
       follow-up below is dated TODAY, so the press also logs tomorrow's chase
       (`FU-AUTO`). SEVEN rows, still TWO leads — which is exactly the property
       this case is here to defend, so the delta assertion below is unchanged and
       lead A's own line count goes from five to six. */
    const moved = await page.request.post(`${api}/leads/${a}/event`, {
      data: {
        event: { type: "drag", to: "following_up" },
        group: { group: "follow_up", data: { date: cairoToday(), method: "call" } },
      },
    });
    expect(moved.ok(), await moved.text()).toBeTruthy();
    expect((await page.request.post(`${api}/leads/${a}/no-answer`, { data: { value: true } })).ok())
      .toBeTruthy();
    expect(
      (await page.request.post(`${api}/leads/${a}/comments`, { data: { body: "rang them" } })).ok(),
    ).toBeTruthy();
    expect((await page.request.post(`${api}/leads/${a}/whatsapp`)).ok()).toBeTruthy();
    expect(
      (
        await page.request.post(`${api}/leads/${b}/event`, {
          data: {
            event: { type: "drag", to: "following_up" },
            group: { group: "follow_up", data: { date: cairoToday(), method: "call" } },
          },
        })
      ).ok(),
    ).toBeTruthy();

    await openReport(page, "bsystems");

    /* THE NUMBER: two more leads today, not six more actions */
    await expect(tileValues(page).first()).toHaveText(String(before + 2));
    await expect(page.locator(".tile-label").first()).toContainText("Today");
    /* and the headline IS the number of rows under it — the invariant, in a
       browser: leadCount === the leads listed, never the interactions */
    const today = page.locator("section.card").first();
    await expect(today.locator(".record-group")).toHaveCount(before + 2);

    /* the row for lead A appears ONCE and carries every interaction */
    const rowA = page.locator(".record-group").filter({ hasText: LEAD_A });
    await expect(rowA).toHaveCount(1);
    await expect(rowA.getByRole("link", { name: LEAD_A })).toBeVisible();
    /* SIX interactions on that one lead — six lines, one row, ONE unit of count.
       The sixth is ADR-082's auto-logged follow-up, which is the whole point:
       one press of "Didn't answer" writes two rows and must still count the lead
       ONCE. */
    await expect(rowA.locator(".record-time")).toHaveText("Interactions: 6");
    /* the first three lines show; the rest fold into a native disclosure */
    await expect(rowA.locator("details summary")).toContainText("more");
    await rowA.locator("details summary").click();
    await expect(rowA.locator(".tl-row")).toHaveCount(6);
    for (const phrase of [
      "Sent WhatsApp",
      "Commented",
      "Flagged didn't answer",
      /* ADR-082 — and the system's own row, phrased as the SYSTEM's: it must
         never read like the follow-up he logged himself */
      "Next follow-up logged automatically",
      "Moved to Following Up",
      "Added the lead",
    ]) {
      await expect(rowA.getByText(phrase, { exact: true })).toBeVisible();
    }
    /* and the company is on every row, so two companies can never be confused */
    await expect(rowA.locator(".badge--entity")).toHaveText("B-Systems");
    await expect(page.locator(".record-group").filter({ hasText: LEAD_B })).toHaveCount(1);
  });

  test("every lead is a link, to the right company's own lead screen", async ({ page }) => {
    await loginAsFounder(page);
    await openReport(page, "bsystems");
    await page.getByRole("link", { name: LEAD_A }).click();
    await page.waitForURL(/\/b-systems\/crm\/lead\/[^/?]+\?company=bsystems$/);
    /* it is a real page, not a 404 */
    await expect(page.getByText(LEAD_A).first()).toBeVisible();
  });

  test("it spans BOTH companies, each row keeping its own address", async ({ page }) => {
    await loginAsFounder(page);
    const bf = await createLead(page, "/api/byteforce", BF_LEAD, "0109810003");

    /* under the ByteForce label */
    await openReport(page, "byteforce");
    const bfRow = page.locator(".record-group").filter({ hasText: BF_LEAD });
    await expect(bfRow).toHaveCount(1);
    await expect(bfRow.locator(".badge--entity")).toHaveText("ByteForce");
    /* the B-Systems leads are still here — it is a report about his DAY */
    await expect(page.locator(".record-group").filter({ hasText: LEAD_A })).toHaveCount(1);
    await expect(page.getByText("It covers both companies", { exact: false })).toBeVisible();

    /* the ByteForce lead's link goes to ByteForce's OWN lead screen */
    await bfRow.getByRole("link", { name: BF_LEAD }).click();
    await page.waitForURL(/\/b-systems\/leads\/lead\/[^/?]+\?company=byteforce$/);
    expect(page.url()).toContain(bf);

    /* and the switch KEEPS the path rather than bouncing to Home (ADR-081 added
       it to SHARED_PATHS — the Calendar's omission was the bug that found this) */
    await openReport(page, "bsystems");
    await page.locator(".switcher").getByRole("link", { name: "ByteForce" }).click();
    await page.waitForURL(/\/b-systems\/daily-report\?company=byteforce$/);
  });

  test("it is HIS report — a colleague's work is absent, in both directions", async ({
    browser,
  }) => {
    const founder = await browser.newPage();
    await loginAsFounder(founder);

    const rep = await browser.newPage();
    await login(rep, "omar@b-systems.example", "bsystems123", /\/b-systems\/crm$/);
    const repLead = await createLead(rep, "/api/b-systems", "ADR-081 Rep's Own Lead", "0109810004");
    expect(
      (await rep.request.post(`/api/b-systems/leads/${repLead}/no-answer`, { data: { value: true } }))
        .ok(),
    ).toBeTruthy();

    /* the rep's report holds his lead and NOT the founder's */
    await openReport(rep, "bsystems");
    await expect(rep.locator(".record-group").filter({ hasText: "ADR-081 Rep's Own Lead" })).toHaveCount(
      1,
    );
    await expect(rep.locator("body")).not.toContainText(LEAD_A);

    /* and the founder's report — an ADMIN's — holds his own and NOT the rep's.
       There is no team view and no user picker: "not the admin, not anyone." */
    await openReport(founder, "bsystems");
    await expect(founder.locator(".record-group").filter({ hasText: LEAD_A })).toHaveCount(1);
    await expect(founder.locator("body")).not.toContainText("ADR-081 Rep's Own Lead");
    await expect(founder.getByText("This report shows your own actions only.")).toBeVisible();

    await founder.close();
    await rep.close();
  });

  test("a lead he DELETED still counts, unlinked, and says it was deleted", async ({ page }) => {
    /* the redaction path, in the real page: ActivityLog has no FK to Lead and
       deleteLead writes its own log row AFTER the delete, so a deleted lead
       ALWAYS leaves history behind. Linking it would be a guaranteed 404; dropping
       it would shrink the number he asked for. */
    await loginAsFounder(page);
    const api = "/api/b-systems";
    await openReport(page, "bsystems");
    const before = Number(await tileValues(page).first().innerText());

    const doomed = await createLead(page, api, "ADR-081 Doomed Lead", "0109810005");
    expect((await page.request.post(`${api}/leads/${doomed}/no-answer`, { data: { value: true } })).ok())
      .toBeTruthy();
    expect((await page.request.delete(`${api}/leads/${doomed}`)).ok()).toBeTruthy();

    await openReport(page, "bsystems");
    /* still his day: one more lead than before */
    await expect(tileValues(page).first()).toHaveText(String(before + 1));

    /* the deleting was the most recent thing that happened today, and rows sort
       by their latest interaction — so this is the first row. (An absolute count
       of "Deleted lead" rows would be an assertion about test order: call-sheet
       and follow-up-time also delete leads as the founder, earlier in the run.) */
    const row = page.locator("section.card").first().locator(".record-group").first();
    await expect(row).toContainText("Deleted lead");
    /* THREE interactions — added, didn't-answer, deleted — all still listed */
    await expect(row.locator(".tl-row")).toHaveCount(3);
    await expect(row.getByText("Deleted the lead", { exact: true })).toBeVisible();
    await expect(row.getByText("Flagged didn't answer", { exact: true })).toBeVisible();
    /* and it is INERT: no lead to open, and its name is nowhere on the page */
    await expect(row.getByRole("link")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("ADR-081 Doomed Lead");
    /* no deleted row anywhere is a link — a stronger statement than one row's */
    await expect(
      page.locator(".record-group").filter({ hasText: "Deleted lead" }).getByRole("link"),
    ).toHaveCount(0);
  });

  test("exactly THREE days, and no control reaches a fourth", async ({ page }) => {
    await loginAsFounder(page);
    await openReport(page, "bsystems");
    await expect(page.locator(".tile")).toHaveCount(3);
    await expect(page.locator("section.card")).toHaveCount(3);
    await expect(page.locator(".card-head h2").first()).toContainText("Today");
    await expect(page.locator(".card-head h2").nth(1)).toContainText("Yesterday");
    /* nothing offers a fourth day: no date picker, no "older", no month */
    for (const name of [/older/i, /previous/i, /month/i, /last week/i]) {
      await expect(page.getByRole("link", { name })).toHaveCount(0);
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });

  test("an empty day reads as a calm zero, not a blank gap", async ({ page }) => {
    await loginAsFounder(page);
    await openReport(page, "bsystems");
    /* yesterday and the day before are empty for an account that only acted
       today — each still renders its own section, with the sentence inside it */
    const yesterday = page.locator("section.card").nth(1);
    await expect(yesterday.locator(".empty")).toHaveText("No leads touched on this day.");
    await expect(tileValues(page).nth(1)).toHaveText("0");
    await expect(tileValues(page).nth(2)).toHaveText("0");
  });

  test("an account that has never acted sees three zeros and one explanation", async ({ page }) => {
    /* the seeded agent's history is all `Seed` rows with no actor, so this is
       also the brand-new-account case */
    await login(page, "01001234567", "partner123", /\/b-systems\//);
    await openReport(page, "bsystems");
    await expect(tileValues(page)).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(tileValues(page).nth(i)).toHaveText("0");
    await expect(page.locator(".empty")).toContainText("Nothing to report yet.");
    await expect(page.locator("section.card")).toHaveCount(0);
  });

  test("the data-entry account cannot reach it (ADR-051 keeps its one destination)", async ({
    page,
  }) => {
    await login(page, "entry@b-systems.example", "entry123", /\/b-systems\/entry/);
    await expect(page.locator(".app-nav").getByRole("link")).toHaveCount(1);
    await page.goto("/b-systems/daily-report?company=bsystems");
    await expect(page).toHaveURL(/\/b-systems\/entry/);
    await expect(page.getByRole("heading", { name: "Daily report", level: 1 })).toHaveCount(0);
  });

  test("a ByteForce-only account gets its own report and is refused the other company", async ({
    page,
  }) => {
    await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);
    await page.locator(".app-nav").getByRole("link", { name: "Daily report" }).click();
    await page.waitForURL(/\/b-systems\/daily-report\?company=byteforce/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Daily report");
    /* asking for B-Systems is answered by the server, not rendered */
    await page.goto("/b-systems/daily-report?company=bsystems");
    await expect(page).toHaveURL(/company=byteforce/);
  });

  test("reads in Arabic, right to left, on a twelve-hour clock", async ({ page }) => {
    await loginAsFounder(page);
    await openReport(page, "bsystems");
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { name: /التقرير اليومي/, level: 1 })).toBeVisible();
    /* the day headings and an interaction pill are TRANSLATED, not English text
       behind an RTL flip (the .cal-dow check in calendar.spec.ts is the precedent) */
    await expect(page.locator(".card-head h2").first()).toContainText("اليوم");
    await expect(page.locator(".card-head h2").nth(1)).toContainText("أمس");
    await expect(page.locator(".tl-pill").filter({ hasText: "سجّل عدم الرد" }).first()).toBeVisible();
    await expect(page.locator(".tile-label").first()).toContainText("اليوم");

    /* the clock is Arabic's own ص/م with Latin digits — never a latin AM/PM,
       which the bidi algorithm would tear off the time (ADR-068) */
    const times = await page.locator(".tl-time").allInnerTexts();
    expect(times.length).toBeGreaterThan(0);
    expect(times.some((v) => /[صم]/.test(v))).toBe(true);
    await expect(page.locator("body")).not.toContainText(/\b(AM|PM)\b/);

    /* DIRECTION, measured rather than trusted: the first child of a row's head
       line sits at the GREATER x in RTL (company-switch.spec.ts's technique) */
    const head = page.locator(".record-group").first().locator("div").first();
    const name = await head.locator("> *").first().boundingBox();
    const next = await head.locator("> *").nth(1).boundingBox();
    expect(name!.x).toBeGreaterThan(next!.x);

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("it reads at 390px, in both languages and both companies", async ({ page }) => {
    await loginAsFounder(page);
    for (const width of [320, 390, 601, 820]) {
      await page.setViewportSize({ width, height: 900 });
      for (const company of ["bsystems", "byteforce"] as const) {
        await openReport(page, company);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `English ${company} at ${width}px`).toBeLessThanOrEqual(1);
      }
    }

    /* the Arabic labels are the longer ones, so they get the same treatment */
    await page.getByRole("button", { name: "عربي" }).click();
    for (const width of [320, 390, 601, 820]) {
      await page.setViewportSize({ width, height: 900 });
      for (const company of ["bsystems", "byteforce"] as const) {
        await page.goto(`/b-systems/daily-report?company=${company}`);
        await expect(page.locator("h1")).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `Arabic ${company} at ${width}px`).toBeLessThanOrEqual(1);
      }
    }

    /* at 390 the three tiles stack (same x), and the disclosure is a real thumb
       target — the house 44px rule (ADR-060, enforced on the switcher segments in
       qa-sweep.spec.ts and module-bar.spec.ts). It is the ONE interactive control
       this page adds, so it is the one that has to clear it; the first draft
       asserted 24 under a comment that claimed 44. Review, Run 097. */
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 900 });
    await openReport(page, "bsystems");
    const boxes = await tileValues(page).evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().x),
    );
    expect(new Set(boxes).size).toBe(1);
    const summary = page.locator("details summary").first();
    const box = await summary.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    /* and the disclosure triangle really is gone: Chromium draws a summary's
       marker through ::marker on `display: list-item`, which the WebKit-only
       selector never touched */
    expect(
      await summary.evaluate((el) => getComputedStyle(el).display),
    ).not.toBe("list-item");

    /* A LEAD NAME IS FREE TEXT — up to 200 characters, and nothing makes him put
       a space in them. Measured by writing one unbreakable token into a name that
       is already on the page rather than by seeding a seventh lead: this suite
       shares one serial database and builds on absolute counts, and the property
       under test is the LAYOUT's, not the query's. Review, Run 097: without
       `min-w-0 wrap-anywhere` this pushed the document 110px sideways at 390px. */
    const overflowWith = async (name: string) => {
      await page.locator(".record-group .record-title").first().evaluate((el, value) => {
        el.textContent = value;
      }, name);
      return page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    };
    expect(await overflowWith("A".repeat(64)), "one 64-char token at 390px").toBeLessThanOrEqual(1);
    expect(await overflowWith("x".repeat(200)), "200 chars, no space, at 390px").toBeLessThanOrEqual(
      1,
    );
  });

  test("a busy lead's timeline survives the fold as ONE timeline", async ({ page }) => {
    /* the rail and the live dot are POSITIONAL css rules over an <ol>, and the
       fold splits one lead's day across two lists — so line three used to lose its
       rail (a gap in the middle of the day) and line four used to wear a second
       "this is the newest" dot. Review, Run 097. LEAD_A has SIX interactions from
       the first case in this file (five of his own plus ADR-082's auto-logged
       follow-up), so it is the row that folds. */
    await loginAsFounder(page);
    await openReport(page, "bsystems");
    const rowA = page.locator(".record-group").filter({ hasText: LEAD_A });
    await expect(rowA.locator("details summary")).toContainText("more");
    await rowA.locator("details summary").click();
    const LINES = 6;
    await expect(rowA.locator(".tl-row")).toHaveCount(LINES);

    /* the rail runs on through the fold: only the LAST line ends it */
    const rails = await rowA
      .locator(".tl-row .tl-rail")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundImage));
    expect(rails).toHaveLength(LINES);
    expect(
      rails.slice(0, LINES - 1).every((v) => v !== "none"),
      `rails: ${rails.join(" | ")}`,
    ).toBe(true);
    expect(rails[LINES - 1]).toBe("none");

    /* and exactly ONE dot is the live one — the newest line, at the top */
    const dots = await rowA
      .locator(".tl-row .tl-dot")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(dots).toHaveLength(LINES);
    expect(new Set(dots.slice(1)).size, `dots: ${dots.join(" | ")}`).toBe(1);
    expect(dots[0]).not.toBe(dots[1]);
  });
});
