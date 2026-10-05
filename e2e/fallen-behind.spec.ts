import { expect, test, type Locator, type Page } from "@playwright/test";

/* ============================================================================
   ADR-082 — THE "FALLEN BEHIND" COLUMN.

   The founder, verbatim: "the follow up column should just contain current or
   future dates any fallen behind dates should be in a separate column called
   fallen behind".

   And, asked whether a fallen-behind lead should be chased automatically: "no
   keep it fallen behind in a separate column I will pick it up and make another
   follow up date."

   IT IS A DERIVED SPLIT of the `following_up` stage, not a new stage: the lead's
   stage never changes and the board decides the column from the live follow-up's
   due date. The reason that settles it is that a derived column MAINTAINS ITSELF
   as days pass, where a real stage would need somebody to drag every card across
   the board the morning it aged.

   WHAT THAT MEANS ON SCREEN, and it is what this file proves:
     · a card lands in the right column by its DATE, with the boundary at the
       Cairo DAY (today is not behind);
     · a card is dragged OUT of it exactly as it would be out of Following Up;
     · NOTHING can be dragged IN — it is a date condition, not a destination,
       and the board says so the way it already says the Won column is closed;
     · giving the lead a new date moves it back BY ITSELF, which is his own
       "I will pick it up and make another follow up date";
     · the Today chip stays on Following Up and never appears on this column;
     · the stage has not changed, so nothing that keys on stage moves.

   NOT COVERED HERE, deliberately: a `following_up` lead with NO follow-up at
   all. It belongs in Following Up (a lead owing a date is not overdue) and that
   is pinned in lib/crm/fallen-behind.test.ts — because no product path can
   create one. Every move into the stage requires the follow-up group, so the
   state only arrives through a restored backup or seed data.
   ========================================================================== */

const cairoDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

const COL_BEHIND = '[data-column="fallen_behind"]';
const COL_FOLLOWING = '[data-column="following_up"]';

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const loginFounder = (page: Page) =>
  login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

async function dragTo(page: Page, card: Locator, column: Locator) {
  await column.scrollIntoViewIfNeeded();
  await card.scrollIntoViewIfNeeded();
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y + 40, { steps: 8 });
  await page.mouse.move(to.x + to.width / 2, to.y + 90, { steps: 14 });
  await page.mouse.up();
}

/** A lead parked in Following Up with its follow-up due on `date` (date-only —
    the server stamps the 09:00 Cairo slot, ADR-061). */
async function leadDueOn(page: Page, name: string, number: string, date: string, api = "/api/b-systems") {
  const created = await page.request.post(`${api}/leads`, {
    data: { name, number, type: "cold_call", companyName: `${name} Co` },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`${api}/leads/${id}/event`, {
    data: {
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date, method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

test.describe("ADR-082 — Fallen behind", () => {
  test("the column exists on BOTH lead boards, before Following Up, in its own colour", async ({
    page,
  }) => {
    await loginFounder(page);

    for (const company of ["bsystems", "byteforce"]) {
      await page.goto(`/b-systems/crm?company=${company}`);
      const behind = page.locator(COL_BEHIND);
      await expect(behind).toBeVisible();
      await expect(behind).toContainText("Fallen behind");

      /* its OWN colour key — `stageKey`'s default is "lost", so a column left
         out of it paints a lead he is merely late on in the colour of a dead
         one, silently, with every guard green */
      await expect(behind).toHaveAttribute("data-stage-key", "fallen-behind");

      /* it is NOT a stage: no `data-stage`, so the pipeline's own column count
         is unchanged and nothing can mistake it for a transition target */
      await expect(page.locator(`${COL_BEHIND}[data-stage]`)).toHaveCount(0);

      /* and it sits immediately before Following Up */
      const columns = await page.locator(".board [data-column]").evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-column")),
      );
      expect(columns.indexOf("fallen_behind")).toBe(columns.indexOf("following_up") - 1);
    }
  });

  test("the DATE decides the column, and the boundary is the Cairo DAY", async ({ page }) => {
    await loginFounder(page);
    const behind = await leadDueOn(page, "Behind Lead", "0107778001", cairoDate(-3));
    const today = await leadDueOn(page, "Today Lead", "0107778002", cairoDate());
    const later = await leadDueOn(page, "Later Lead", "0107778003", cairoDate(5));

    await page.goto("/b-systems/crm");
    /* overdue in Fallen behind */
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Behind Lead"]`)).toBeVisible();
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Behind Lead"]`)).toHaveCount(0);

    /* TODAY is NOT behind — this is the assertion that matters most: a
       follow-up due at 09:00 this morning is this morning's work, and a
       `dueAt < now` split would move the card out from under him at 09:01 */
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Today Lead"]`)).toBeVisible();
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Today Lead"]`)).toHaveCount(0);

    /* and the future stays where it was */
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Later Lead"]`)).toBeVisible();

    /* the count pills count what is RENDERED, in both columns */
    for (const col of [COL_BEHIND, COL_FOLLOWING]) {
      const column = page.locator(col);
      const cards = await column.locator(".bcard").count();
      await expect(column.locator(".count-pill")).toHaveText(String(cards));
    }

    for (const id of [behind, today, later]) {
      expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
    }
  });

  test("NOTHING can be dragged IN — it is a date condition, and the board says so", async ({
    page,
  }) => {
    await loginFounder(page);
    const id = await leadDueOn(page, "No Drop Lead", "0107778004", cairoDate(2));

    await page.goto("/b-systems/crm");
    /* the column states that it is closed, permanently, like Won does for a rep */
    await expect(page.locator(COL_BEHIND).getByText("Not a drop target")).toBeVisible();

    const card = page.locator('[data-deal-card="No Drop Lead"]');
    await dragTo(page, card, page.locator(COL_BEHIND));

    /* no modal, no move — and a sentence that says what to do instead */
    await expect(page.getByText("Complete this stage's details to confirm the move")).toHaveCount(
      0,
    );
    await expect(
      page.getByText(/Fallen behind is decided by the follow-up date/i),
    ).toBeVisible();
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="No Drop Lead"]`)).toBeVisible();
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="No Drop Lead"]`)).toHaveCount(0);

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("a card is dragged OUT of it exactly as it would be out of Following Up", async ({
    page,
  }) => {
    /* Its stage IS `following_up`, so there is no second code path: the drop
       opens the destination's own form and the move commits. */
    await loginFounder(page);
    const id = await leadDueOn(page, "Out Of Behind", "0107778005", cairoDate(-6));

    await page.goto("/b-systems/crm");
    const card = page.locator(`${COL_BEHIND} [data-deal-card="Out Of Behind"]`);
    await expect(card).toBeVisible();

    await dragTo(page, card, page.locator('[data-column="meeting_setting"]'));
    await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
    await expect(page.locator(".modal-eyebrow")).toContainText("Meeting Setting");
    /* the eyebrow names the stage it is LEAVING, and that stage is Following Up
       — the proof that the derived column never became a stage */
    await expect(page.locator(".modal-eyebrow")).toContainText("Following Up");
    await page.getByRole("button", { name: "Cancel" }).click();

    /* and a formless destination still commits straight off the drop */
    await dragTo(page, card, page.locator('[data-column="postponed"]'));
    await expect(
      page.locator('[data-column="postponed"] [data-deal-card="Out Of Behind"]'),
    ).toBeVisible();
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Out Of Behind"]`)).toHaveCount(0);

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("a new follow-up DATE moves the card back by itself — his own way out", async ({ page }) => {
    /* "I will pick it up and make another follow up date." No drag, no stage
       move: the column is derived, so re-dating the lead IS the way out. */
    await loginFounder(page);
    const id = await leadDueOn(page, "Picked Up Lead", "0107778006", cairoDate(-2));

    await page.goto("/b-systems/crm");
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Picked Up Lead"]`)).toBeVisible();

    await page.goto(`/b-systems/crm/lead/${id}`);
    await page.getByRole("button", { name: "Log another follow-up" }).click();
    await page.getByLabel("Follow-up date").fill(cairoDate(1));
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes(`/leads/${id}/event`),
      ),
      page.getByRole("button", { name: "Save record" }).click(),
    ]);

    await page.goto("/b-systems/crm");
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Picked Up Lead"]`)).toBeVisible();
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Picked Up Lead"]`)).toHaveCount(0);

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("the Today chip is on Following Up and NOT on Fallen behind", async ({ page }) => {
    /* ADR-061's chip still means "just see today's follow ups" — only narrower,
       since the column it rides is already today-or-later. On Fallen behind it
       could only ever count 0 and empty the column, because every card there is
       overdue by definition: a control that can only lie. */
    await loginFounder(page);
    const behind = await leadDueOn(page, "Chip Behind Lead", "0107778007", cairoDate(-1));
    const today = await leadDueOn(page, "Chip Today Lead", "0107778008", cairoDate());
    const later = await leadDueOn(page, "Chip Later Lead", "0107778009", cairoDate(4));

    await page.goto("/b-systems/crm");
    const chip = page.locator(COL_FOLLOWING).getByRole("button", { name: /^Today · \d+$/ });
    await expect(chip).toBeVisible();
    await expect(page.locator(COL_BEHIND).getByRole("button", { name: /Today/ })).toHaveCount(0);

    /* pressed, it separates TODAY from LATER inside the live column */
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Chip Today Lead"]`)).toBeVisible();
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Chip Later Lead"]`)).toHaveCount(
      0,
    );
    /* and the overdue card is untouched by it — it is not in that column at all */
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Chip Behind Lead"]`)).toBeVisible();

    for (const id of [behind, today, later]) {
      expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
    }
  });

  test("SEARCH still narrows both columns, and the stage-keyed screens do not move", async ({
    page,
  }) => {
    /* The stage has not changed, so the To-Do, the Leads table and the lead's
       own header must all still read `following_up`. The server-side filter
       narrows what the board was sent, and the split then applies to whatever
       arrived — they compose by construction. */
    await loginFounder(page);
    const behind = await leadDueOn(page, "Searchable Behind", "0107778010", cairoDate(-5));
    const other = await leadDueOn(page, "Unsearched Behind", "0107778011", cairoDate(-5));

    await page.goto("/b-systems/crm?q=Searchable");
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Searchable Behind"]`)).toBeVisible();
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Unsearched Behind"]`)).toHaveCount(0);

    /* the lead's own page still says Following Up — the stage is the stage */
    await page.goto(`/b-systems/crm/lead/${behind}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Following Up").first()).toBeVisible();
    await expect(page.getByText("Fallen behind")).toHaveCount(0);

    for (const id of [behind, other]) {
      expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
    }
  });

  test("the Partners & Agents board gets NOTHING — it has no follow-up column", async ({
    page,
  }) => {
    /* Since ADR-059 follow-ups there are records written from any active stage
       (PP-8), so there is no column to split. */
    await loginFounder(page);
    await page.goto("/b-systems/partners-pipeline");
    await expect(page.locator(".board")).toBeVisible();
    await expect(page.locator(COL_BEHIND)).toHaveCount(0);
    await expect(page.locator(COL_FOLLOWING)).toHaveCount(0);
  });

  test("Arabic: the column reads متأخرة, and still refuses a drop", async ({ page }) => {
    await loginFounder(page);
    const id = await leadDueOn(page, "Arabic Behind Lead", "0107778012", cairoDate(-2));

    await page.goto("/b-systems/crm");
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const behind = page.locator(COL_BEHIND);
    await expect(behind).toContainText("متأخرة");
    await expect(behind.getByText("لا يقبل الإسقاط")).toBeVisible();
    await expect(behind.locator('[data-deal-card="Arabic Behind Lead"]')).toBeVisible();

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });
});
