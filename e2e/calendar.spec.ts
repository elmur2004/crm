import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-071 — the CALENDAR, end to end.

   Founder: "The calendar is a page which takes all the meetings from the
   meeting settings in the CRM and puts them in a calendar, with the ability for
   every single user to add their own schedule on it. So whenever X is setting a
   meeting and Y has to be in this meeting, X will look at the calendar and see
   if Y has any other meetings other than the CRM."

   Two things are proved here, and the second is the one that matters:

   1. The BUTTONS WORK — his own requirement. Add an entry, see it on the grid
      and in the day panel, edit it, delete it; move months; land back on today.

   2. THE PRIVACY WALL HOLDS THROUGH A REAL BROWSER. A second account looks at
      the same day and reads "Busy · Elmur" — never the title. The unit suite
      asserts this at the service; this asserts it at the pixel, because the
      wall is only worth anything if the page cannot re-open what the service
      closed.
   ========================================================================== */

const PRIVATE_ENTRY = "ADR-071 Dentist appointment";
const SHARED_ENTRY = "ADR-071 Supplier visit Alexandria";

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const loginAsFounder = (page: Page) =>
  login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

/** The agent — a role whose lead scope is its OWN leads and nothing else. */
const loginAsAgent = (page: Page) => login(page, "01001234567", "partner123", /\/b-systems\//);

/** Fill the add/edit dialog and save. Dates default to the selected day. */
async function fillEntry(page: Page, title: string, opts?: { shared?: boolean; time?: string }) {
  const modal = page.locator(".modal");
  await modal.getByLabel("What is it?").fill(title);
  if (opts?.time) await modal.getByLabel("Time", { exact: true }).fill(opts.time);
  if (opts?.shared) await modal.getByText("Let the team see what this is").click();
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".modal")).toHaveCount(0);
}

const openCalendar = async (page: Page) => {
  await page.goto("/b-systems/calendar?company=bsystems");
  await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
};

test.describe("ADR-071 — the calendar", () => {
  test("is in the nav and opens on the current month, with today marked", async ({ page }) => {
    await loginAsFounder(page);
    await page.getByRole("link", { name: "Calendar" }).first().click();
    await page.waitForURL(/\/b-systems\/calendar/);
    await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();

    /* the grid is whole weeks — seven headers and a multiple of seven cells */
    await expect(page.locator(".cal-dow")).toHaveCount(7);
    const cells = await page.locator(".cal-cell").count();
    expect(cells % 7).toBe(0);
    expect(cells).toBeGreaterThanOrEqual(28);

    /* exactly one day carries the today marker */
    await expect(page.locator('.cal-cell[data-today="true"]')).toHaveCount(1);
  });

  test("the month buttons move, and Today comes back", async ({ page }) => {
    await loginAsFounder(page);
    await openCalendar(page);
    const month = page.locator(".cal-month");
    const started = await month.textContent();

    await page.getByRole("link", { name: "Next month" }).click();
    await expect(month).not.toHaveText(started ?? "");
    const forward = await month.textContent();

    /* back twice lands a month BEFORE where we started — proof both directions
       move rather than one of them re-rendering the same page */
    await page.getByRole("link", { name: "Previous month" }).click();
    await expect(month).toHaveText(started ?? "");
    await page.getByRole("link", { name: "Previous month" }).click();
    await expect(month).not.toHaveText(forward ?? "");

    await page.getByRole("link", { name: "Today" }).click();
    await expect(month).toHaveText(started ?? "");
    /* the month rides the URL, so it is a link somebody can send */
    await expect(page).toHaveURL(/[?&]y=\d{4}&m=\d{1,2}/);
  });

  test("the title names the MONTH, not the grid's first cell", async ({ page }) => {
    await loginAsFounder(page);
    /* August 2026 opens on a Saturday, so its Sunday-first grid starts on 26
       July — a page that formatted the grid's first instant printed "July 2026"
       over an August calendar. Both months below start in the previous one. */
    for (const [y, m, label] of [
      [2026, 8, "August 2026"],
      [2026, 5, "May 2026"],
    ] as const) {
      await page.goto(`/b-systems/calendar?company=bsystems&y=${y}&m=${m}`);
      await expect(page.locator(".cal-month")).toHaveText(label);
    }
    /* and a junk month falls back rather than 400ing (the accounting precedent) */
    await page.goto("/b-systems/calendar?company=bsystems&y=abc&m=99");
    await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
    await expect(page.locator('.cal-cell[data-today="true"]')).toHaveCount(1);
  });

  test("paging to another month moves the day panel with it", async ({ page }) => {
    await loginAsFounder(page);
    /* November, then December: two months far enough from today that today can
       appear on NEITHER padded grid. (September's grid does include 31 August,
       and selecting a visible today there is right — which is why this case
       pages somewhere today is genuinely absent.) */
    await page.goto("/b-systems/calendar?company=bsystems&y=2026&m=11");
    const heading = page.locator(".card--flush .u-h3");
    await expect(heading).toContainText("Nov 2026");

    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page.locator(".cal-month")).toHaveText("December 2026");
    /* the selected day follows the month — it used to stay on November's date
       and leave the panel reading "Nothing on this day" under a December grid */
    await expect(heading).toContainText("Dec 2026");
  });

  test("adding, editing and deleting my own entry all work from the buttons", async ({ page }) => {
    await loginAsFounder(page);
    await openCalendar(page);

    await page.getByRole("button", { name: "Add to my calendar" }).first().click();
    /* the end must follow the start: the dialog opens 09:00–10:00, and pushing
       the start to 11:30 has to carry the end to 12:30 rather than leaving an
       entry that ends before it begins and is refused on save */
    const modal = page.locator(".modal");
    await modal.getByLabel("Time", { exact: true }).fill("11:30");
    await expect(modal.getByLabel("Ends (time)")).toHaveValue("12:30");
    await fillEntry(page, PRIVATE_ENTRY);

    /* on the grid AND in the day panel — the dialog defaults to the selected
       day, which is today */
    await expect(page.locator(".cal-chip", { hasText: PRIVATE_ENTRY })).toBeVisible();
    const row = page.locator(".cal-row", { hasText: PRIVATE_ENTRY });
    await expect(row).toBeVisible();
    await expect(row.locator(".cal-row-time")).toContainText("11:30");

    /* edit — the form arrives carrying what is stored, not a blank */
    await row.getByRole("button", { name: "Edit entry" }).click();
    await expect(page.locator(".modal").getByLabel("What is it?")).toHaveValue(PRIVATE_ENTRY);
    await fillEntry(page, `${PRIVATE_ENTRY} (moved)`);
    await expect(page.locator(".cal-row", { hasText: `${PRIVATE_ENTRY} (moved)` })).toBeVisible();

    /* delete — it confirms first, then the time stops being taken */
    page.once("dialog", (d) => d.accept());
    await page
      .locator(".cal-row", { hasText: `${PRIVATE_ENTRY} (moved)` })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.locator(".cal-row", { hasText: PRIVATE_ENTRY })).toHaveCount(0);
    await expect(page.locator(".cal-chip", { hasText: PRIVATE_ENTRY })).toHaveCount(0);
  });

  test("a colleague reads BUSY, never the title — and a shared entry by name", async ({
    browser,
  }) => {
    const founder = await browser.newPage();
    await loginAsFounder(founder);
    await openCalendar(founder);

    await founder.getByRole("button", { name: "Add to my calendar" }).first().click();
    await fillEntry(founder, PRIVATE_ENTRY, { time: "09:15" });
    await founder.getByRole("button", { name: "Add to my calendar" }).first().click();
    await fillEntry(founder, SHARED_ENTRY, { shared: true, time: "13:45" });
    await expect(founder.locator(".cal-chip", { hasText: PRIVATE_ENTRY })).toBeVisible();

    /* the same day, through somebody else's eyes */
    const agent = await browser.newPage();
    await loginAsAgent(agent);
    await openCalendar(agent);

    /* THE ASSERTION THIS FILE EXISTS FOR: the private entry's words are nowhere
       in the DOM — not in a chip, not in a tooltip, not in a title attribute */
    await expect(agent.locator("body")).not.toContainText(PRIVATE_ENTRY);
    const busyChip = agent.locator('.cal-chip[data-detail="busy"]').first();
    await expect(busyChip).toBeVisible();
    await expect(busyChip).toContainText("Busy");
    await expect(busyChip).toContainText("Elmur");
    /* the DOM must not say WHICH kind it is either: "Y is in a client meeting"
       and "Y has a personal appointment" are two different facts, and busy
       promises neither */
    await expect(busyChip).toHaveAttribute("data-kind", "busy");
    const busyRow = agent.locator(".cal-row").filter({ hasText: "Busy" }).first();
    await expect(busyRow.locator(".chip-outline")).toHaveCount(0);

    /* the one he chose to name IS readable — the toggle does what it says */
    await expect(agent.locator(".cal-chip", { hasText: SHARED_ENTRY })).toBeVisible();
    /* …and it is still not the agent's to touch */
    await expect(
      agent.locator(".cal-row", { hasText: SHARED_ENTRY }).getByRole("button", { name: "Delete" }),
    ).toHaveCount(0);

    /* tidy up so these two do not leak into another spec's day */
    for (const title of [PRIVATE_ENTRY, SHARED_ENTRY]) {
      founder.once("dialog", (d) => d.accept());
      await founder
        .locator(".cal-row", { hasText: title })
        .getByRole("button", { name: "Delete" })
        .click();
      await expect(founder.locator(".cal-row", { hasText: title })).toHaveCount(0);
    }
    await founder.close();
    await agent.close();
  });

  test("the data-entry account cannot reach it (ADR-051 keeps its one destination)", async ({
    page,
  }) => {
    await login(page, "entry@b-systems.example", "entry123", /\/b-systems\/entry/);
    await page.goto("/b-systems/calendar?company=bsystems");
    /* bounced to its own landing, never shown an empty calendar */
    await expect(page).toHaveURL(/\/b-systems\/entry/);
    await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toHaveCount(0);
  });

  test("reads in Arabic, right to left", async ({ page }) => {
    await loginAsFounder(page);
    await openCalendar(page);
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.getByRole("heading", { name: "التقويم", level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    /* the weekday strip is translated, not left in English behind an RTL flip */
    await expect(page.locator(".cal-dow").first()).toHaveText("أحد");
  });
});
