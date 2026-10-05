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

   PINNED AS A UNIT TEST INSTEAD: a `following_up` lead with NO follow-up at
   all. It belongs in Following Up (a lead owing a date is not overdue), and
   lib/crm/fallen-behind.test.ts is where that lives, because the condition is
   pure and the column it chooses is the whole of the behaviour.

   AND THE STATE IS REACHABLE THROUGH THE UI — an earlier draft of this comment
   said it was not, which was wrong and is corrected here (review). B-6: an
   AGENT or PARTNER who checks "Sent" on a proposal returns the lead to
   Following Up with NO follow-up form (V2 section 3 — the light roles are asked
   for nothing), and a lead can reach Sending Proposals straight from New
   without ever having had a follow-up. The BEHAVIOUR is sound in that case and
   is the behaviour this file and the unit test both describe: the card lands in
   Following Up, printing "No follow-up set", which is work for today.
   ========================================================================== */

const cairoDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

/** The UTC instant of the next CAIRO midnight, found by bisecting on the Cairo
    day-string rather than by assuming an offset — Egypt is UTC+2 or UTC+3 and
    the midnight-crossing test must not be the one thing in this repo that
    hardcodes which. */
const cairoDateAt = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(at);

function nextCairoMidnight(): Date {
  const today = cairoDate();
  let lo = Date.now();
  let hi = lo + 36 * 3_600_000; // certainly a later Cairo day
  while (hi - lo > 1_000) {
    const mid = Math.floor((lo + hi) / 2);
    if (cairoDateAt(new Date(mid)) === today) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

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

/* Aim so the CARD lands centred on the target column, not the POINTER. dnd-kit
   scores the collision on the DRAGGED CARD's rect, so pointing at the column
   centre leaves the card straddling its neighbour — and since ADR-082 inserted
   "Fallen behind" immediately before Following Up, a straddled drop now lands on
   a column that REFUSES it, which reads as "the feature is broken" rather than
   as a mis-aimed test. Same compensation prospect-pipeline.spec.ts uses for its
   seven columns. */
async function dragTo(page: Page, card: Locator, column: Locator) {
  await column.scrollIntoViewIfNeeded();
  await card.scrollIntoViewIfNeeded();
  const cardBox = (await card.boundingBox())!;
  const gripBox = (await card.locator(".bcard-grip").boundingBox())!;
  const gripX = gripBox.x + gripBox.width / 2;
  const gripY = gripBox.y + gripBox.height / 2;
  const offsetX = gripX - (cardBox.x + cardBox.width / 2);
  const offsetY = gripY - (cardBox.y + cardBox.height / 2);
  const aim = async () => {
    const to = (await column.boundingBox())!;
    return { x: to.x + to.width / 2 + offsetX, y: to.y + 40 + cardBox.height / 2 + offsetY };
  };
  await page.mouse.move(gripX, gripY);
  await page.mouse.down();
  await page.mouse.move(gripX, gripY + 12, { steps: 4 });
  const first = await aim();
  await page.mouse.move(first.x, first.y, { steps: 14 });
  const settled = await aim();
  await page.mouse.move(settled.x, settled.y, { steps: 2 });
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

/* ADR-082 — NINE 218px columns plus gaps is ~2100px on B-Systems (eight stages
   and the derived Fallen behind column), well outside the default 1280 viewport.
   `page.mouse` works in VIEWPORT coordinates, so the right-hand columns could
   never be reached, and `scrollIntoViewIfNeeded` on the column scrolls the CARD
   out of view at the same time — the two ends cannot both be brought in by
   scrolling. Give the drag cases a board that fits. */
test.describe("ADR-082 — Fallen behind", () => {
  test.use({ viewport: { width: 2300, height: 1000 } });

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

    /* Review — and it carries `data-column` on every column like the other two
       boards, so "every selector that wants the column uses data-column" is
       true of the whole product rather than of two thirds of it. This board has
       no derived column, so the two attributes agree here — and that is the
       assertion. */
    const columns = await page.locator(".board [data-column]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-column")),
    );
    const stages = await page.locator(".board [data-stage]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-stage")),
    );
    expect(columns).toEqual(stages);
    expect(columns.length).toBe(7); // PROSPECT_STAGES, and not one more
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

  test("a SUPERSEDED follow-up does not file the card — owing a date is not overdue", async ({
    page,
  }) => {
    /* Review finding, on the live path that produces it. B-6 / V2 section 3: an
       AGENT or a PARTNER who checks "Sent" on a proposal is asked for NOTHING,
       so the lead returns to Following Up with no new date. Its newest
       follow-up is then the one from BEFORE the proposal — not a promise
       anybody made — and the board was filing the card by that date. A lead
       the agent had just moved forward therefore appeared in a red column that
       refuses drops and tells him to re-date something he never dated.

       The fix is the gate the To-Do has always applied: the follow-up counts
       only while it is the lead's NEWEST record across follow-ups, meetings,
       proposals and negotiation notes (lib/crm/live-record). The card then
       reads "No follow-up set", which is work for today, in the column he
       works out of. */
    await login(page, "nourhan.agent@b-systems.example", "agent123", /\/b-systems\/crm$/);
    const created = await page.request.post("/api/b-systems/leads", {
      data: {
        name: "Superseded Lead",
        number: "0107778017",
        type: "cold_call",
        companyName: "Superseded Co",
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    /* a follow-up three days PAST — genuinely fallen behind, and the board says so */
    const dated = await page.request.post(`/api/b-systems/leads/${id}/event`, {
      data: {
        event: { type: "next_action", action: "following_up" },
        group: { group: "follow_up", data: { date: cairoDate(-3), method: "call" } },
      },
    });
    expect(dated.ok(), await dated.text()).toBeTruthy();
    await page.goto("/b-systems/crm");
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Superseded Lead"]`)).toBeVisible();

    /* on to Sending Proposals, then "Sent" — which asks this role for nothing */
    const proposed = await page.request.post(`/api/b-systems/leads/${id}/event`, {
      data: {
        event: { type: "next_action", action: "sending_proposal" },
        group: { group: "proposal", data: { service: "ERP rollout", sent: false } },
      },
    });
    expect(proposed.ok(), await proposed.text()).toBeTruthy();
    const sent = await page.request.post(`/api/b-systems/leads/${id}/event`, {
      data: { event: { type: "proposal_sent" } },
    });
    expect(sent.ok(), await sent.text()).toBeTruthy();

    await page.goto("/b-systems/crm");
    const card = page.locator(`${COL_FOLLOWING} [data-deal-card="Superseded Lead"]`);
    await expect(card).toBeVisible();
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Superseded Lead"]`)).toHaveCount(0);
    /* and the card says what is true, rather than printing a pre-proposal date */
    await expect(card).toContainText("No follow-up set");

    /* the stage is still the stage — nothing about this is a stage move */
    await page.goto(`/b-systems/crm/lead/${id}`);
    await expect(page.getByText("Following Up").first()).toBeVisible();

    /* delete is admin-only (V2 section 2.2), so the founder clears it up */
    await loginFounder(page);
    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("a BACKDATED drop says where the card went and why — it is not silent", async ({
    page,
  }) => {
    /* Review finding. The follow-up date input has no `min` and the server
       validates only the FORMAT, so a past date commits — and the placement
       that follows is CORRECT: the date really has passed. What was wrong was
       the silence. `commitDrop` refreshed and the card appeared two columns
       away, in a column whose own note reads "Not a drop target", with nothing
       to connect the two. That is the same failure the `landedHere` machinery
       exists to prevent, and the fix is the same kind of thing: say it.

       Also pinned here: the chip is released on the column the card ACTUALLY
       went to, not on the one it was dropped on. */
    await loginFounder(page);
    const created = await page.request.post("/api/b-systems/leads", {
      data: {
        name: "Backdated Drop",
        number: "0107778018",
        type: "cold_call",
        companyName: "Backdated Co",
      },
    });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    await page.goto("/b-systems/crm");
    const card = page.locator('[data-column="new"] [data-deal-card="Backdated Drop"]');
    await expect(card).toBeVisible();

    await dragTo(page, card, page.locator(COL_FOLLOWING));
    await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
    await page.getByLabel(/Follow-up date/).fill(cairoDate(-2));
    await page.getByRole("button", { name: "Confirm move" }).click();

    /* the toast names the LEAD, the COLUMN and the way back out */
    const toast = page.locator(".toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Backdated Drop");
    await expect(toast).toContainText("Fallen behind");
    await expect(toast).toContainText(/date from today onwards/i);

    /* and that IS where it went — the placement was never the defect */
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Backdated Drop"]`)).toBeVisible();
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Backdated Drop"]`)).toHaveCount(0);

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("a drop that lands where it was AIMED says nothing — the toast is not noise", async ({
    page,
  }) => {
    await loginFounder(page);
    const created = await page.request.post("/api/b-systems/leads", {
      data: {
        name: "Plain Drop",
        number: "0107778019",
        type: "cold_call",
        companyName: "Plain Co",
      },
    });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    await page.goto("/b-systems/crm");
    const card = page.locator('[data-column="new"] [data-deal-card="Plain Drop"]');
    await dragTo(page, card, page.locator(COL_FOLLOWING));
    await page.getByLabel(/Follow-up date/).fill(cairoDate(3));
    await page.getByRole("button", { name: "Confirm move" }).click();

    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Plain Drop"]`)).toBeVisible();
    await expect(page.locator(".toast")).toHaveCount(0);

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("THE FIRST PAINT SAYS NOTHING — no 'Nothing has fallen behind' over a 0 count", async ({
    browser,
    page,
    baseURL,
  }) => {
    /* Review finding. Before the Cairo day lands, every card sits in its stage
       column and the derived one is empty — so it printed "Nothing has fallen
       behind" over a 0 count while overdue cards rendered next door. A one-beat
       affirmative falsehood, which is worse than a blank.

       The beat is too short to catch by racing it, so it is held open instead:
       a second context with JAVASCRIPT DISABLED never hydrates, so `today`
       stays null for ever and the SSR paint IS the whole test. The cookies come
       from the logged-in context, because the sign-in form needs JS. */
    await loginFounder(page);
    const overdue = await leadDueOn(page, "First Paint Behind", "0107778020", cairoDate(-3));
    /* a LATER card too, for the second half: a filter that matches nothing at
       all renders "No cards match these filters" INSTEAD of the board, so the
       empty-but-known state has to be reached with a filter that keeps one
       live card and no overdue one. */
    const later = await leadDueOn(page, "First Paint Later", "0107778021", cairoDate(5));
    const state = await page.context().storageState();

    const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: state, baseURL });
    const flat = await noJs.newPage();
    await flat.goto("/b-systems/crm");

    /* the SSR paint really is the un-split one: the overdue card is in Following
       Up, which is the state that made the other column's claim a lie */
    await expect(
      flat.locator(`${COL_FOLLOWING} [data-deal-card="First Paint Behind"]`),
    ).toBeVisible();
    const behind = flat.locator(COL_BEHIND);
    await expect(behind).toBeVisible();
    await expect(behind.locator(".count-pill")).toHaveText("0");
    /* ... and it claims NOTHING about it */
    await expect(behind.getByText("Nothing has fallen behind")).toHaveCount(0);
    await expect(behind.locator(".col-empty")).toHaveCount(0);
    /* the permanent note is NOT the empty state and must still be there — the
       column is closed to drops whether or not the day is known */
    await expect(behind.getByText("Not a drop target")).toBeVisible();
    await noJs.close();

    /* AND THE LINE IS NOT LOST, only deferred: with JS, the same board says it
       the moment the day is known and the column is genuinely empty. This half
       is what stops the fix from being "delete the empty state". */
    await page.goto("/b-systems/crm?q=First Paint Later");
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="First Paint Later"]`)).toBeVisible();
    const emptyBehind = page.locator(COL_BEHIND);
    await expect(emptyBehind.locator(".count-pill")).toHaveText("0");
    await expect(emptyBehind.getByText("Nothing has fallen behind")).toBeVisible();

    for (const id of [overdue, later]) {
      expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
    }
  });

  test("A TAB LEFT OPEN ACROSS CAIRO MIDNIGHT RE-SPLITS BY ITSELF", async ({ page }) => {
    /* Review finding. The split sampled the Cairo day ONCE PER MOUNT
       (`useEffect(…, [])`), and `router.refresh()` re-renders this tree without
       remounting — so a board left open overnight kept YESTERDAY's division
       while the server had already moved on. The card he was overdue on still
       sat in Following Up, pressing "Didn't answer" on it booked nothing (the
       auto-log needs the live follow-up to be due TODAY), and the Today chip
       beside it counted a different day. Three surfaces, one screen, three
       answers.

       Proved with a real fake clock rather than an argument: install it five
       minutes before the next Cairo midnight, load the board, then roll the
       clock past midnight WITHOUT touching the page. The card must move on its
       own. `useCairoToday` re-arms from `msUntilNextCairoDay`, so this is also
       the only test that can tell a correct re-arm from a 24-hour one. */
    await loginFounder(page);
    const todays = await leadDueOn(page, "Midnight Lead", "0107778013", cairoDate());
    /* and one due TOMORROW, which is the day the clock is about to roll into —
       the chip beside the column has to re-sample too, and a count that merely
       dropped to 0 would not tell a re-sample from a column that emptied. */
    const next = await leadDueOn(page, "Midnight Next Lead", "0107778022", cairoDate(1));

    /* five minutes to midnight — the clock has to be installed before the page
       that reads it is loaded */
    await page.clock.install({ time: new Date(nextCairoMidnight().getTime() - 5 * 60_000) });
    await page.goto("/b-systems/crm");
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Midnight Lead"]`)).toBeVisible();
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Midnight Lead"]`)).toHaveCount(0);

    /* press the chip and LEAVE IT PRESSED across midnight: it then shows
       whichever card the hook calls today's, which is the whole question */
    await page.locator(COL_FOLLOWING).getByRole("button", { name: /^Today/ }).click();
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Midnight Lead"]`)).toBeVisible();
    await expect(
      page.locator(`${COL_FOLLOWING} [data-deal-card="Midnight Next Lead"]`),
    ).toHaveCount(0);

    /* ten minutes pass. No reload, no navigation, no drag. */
    await page.clock.fastForward(10 * 60_000);

    /* THE SPLIT re-sampled: yesterday's card is behind now, by itself */
    await expect(page.locator(`${COL_BEHIND} [data-deal-card="Midnight Lead"]`)).toBeVisible();
    await expect(page.locator(`${COL_FOLLOWING} [data-deal-card="Midnight Lead"]`)).toHaveCount(0);
    /* AND THE CHIP re-sampled with it, off the same hook: still pressed, and
       now showing the card that has become today's */
    await expect(
      page.locator(`${COL_FOLLOWING} [data-deal-card="Midnight Next Lead"]`),
    ).toBeVisible();

    for (const id of [todays, next]) {
      expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
    }
  });
});

/* Review — the describe above pins a 2300px viewport for ALL of its cases
   because its drags need the whole nine-column board reachable by the mouse.
   That left the new column with no PHONE case at all, on a product whose
   founder works off a phone. These two need no drag, so they get 390px. */
test.describe("ADR-082 — Fallen behind at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the column, its cards and its locked note all read at 390px", async ({ page }) => {
    await loginFounder(page);
    const behind = await leadDueOn(page, "Phone Behind Lead", "0107778014", cairoDate(-4));
    const live = await leadDueOn(page, "Phone Live Lead", "0107778015", cairoDate(1));

    await page.goto("/b-systems/crm");
    const column = page.locator(COL_BEHIND);
    await column.scrollIntoViewIfNeeded();
    await expect(column).toBeVisible();
    await expect(column).toContainText("Fallen behind");
    await expect(column.getByText("Not a drop target")).toBeVisible();
    await expect(column.locator('[data-deal-card="Phone Behind Lead"]')).toBeVisible();

    /* the board scrolls sideways; the PAGE must not — a horizontal page scroll
       at phone width is the failure mode a new column introduces */
    const noPageScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noPageScroll).toBe(true);

    for (const id of [behind, live]) {
      expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
    }
  });

  test("the card opens from the column by TAP, and the stage never moved", async ({ page }) => {
    /* The grip exists so a finger scrolls the column instead of dragging the
       card (CardGrip); tapping the card body still opens the lead. */
    await loginFounder(page);
    const id = await leadDueOn(page, "Phone Tap Lead", "0107778016", cairoDate(-7));

    await page.goto("/b-systems/crm");
    const column = page.locator(COL_BEHIND);
    await column.scrollIntoViewIfNeeded();
    await expect(column).toHaveAttribute("data-stage-key", "fallen-behind");
    const card = column.locator('[data-deal-card="Phone Tap Lead"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/lead/${id}`));
    await expect(page.getByText("Following Up").first()).toBeVisible();

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });
});
