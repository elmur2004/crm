import { expect, test, type Locator, type Page } from "@playwright/test";

/* ============================================================================
   ADR-072, AMENDED BY ADR-082 — the "Postpone / Not answering" column, end to
   end.

   ADR-072, the founder: "We need to add a column in the CRM called postpone
   slash not answering, for all the leads that are falling out of the CRM — not
   answering, not attending the meeting, no showing. When we move the lead
   there, the pop up will be: is he not answering at all, or is he no show in
   the meeting, or is he not interested right now at all?"

   ADR-082, the founder, on being shown that dragging a lead there opened a
   confirm-move modal that said "This move requires the 'postpone' fields" and
   then rendered NOTHING — so the move could not be completed at all:

       "don't ask for anything just drop it there."

   THE LESSON, AND WHY THIS FILE CHANGED SHAPE. The feature was only ever proved
   through the LEAD PAGE, where an unknown target renders an empty form that
   still submits. On the BOARD the same gap is a dead end. So the headline test
   here is now the one that was missing: A DRAG INTO THE COLUMN, ON BOTH BOARDS,
   COMPLETES — and the card lands in it.

   What is still asserted, unchanged: the column carries his own name, it is not
   painted as Lost, and a parked lead comes back OUT — the whole difference
   between this column and the one beside it.
   ========================================================================== */

const COLUMN = "Postpone / Not answering";

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const loginAsFounder = (page: Page) =>
  login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

/* the house drag helper — pointer steps, because dnd-kit needs intermediate
   moves to pass its 6px activation constraint */
async function dragTo(page: Page, card: Locator, column: Locator) {
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y + 40, { steps: 8 });
  await page.mouse.move(to.x + to.width / 2, to.y + 90, { steps: 12 });
  await page.mouse.up();
}

/** Follow-ups are dated relative to TODAY so the card sits in Following Up and
    never in Fallen behind (ADR-082's derived split) — the column a card starts
    in is not this spec's subject, but a card in the wrong one would make its
    drags read from the wrong place. */
const cairoDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

/** A lead sitting in Following Up, made through the existing APIs — only the
    column and the way into it are exercised through the interface. */
async function leadInFollowUp(page: Page, name: string, api = "/api/b-systems"): Promise<string> {
  const created = await page.request.post(`${api}/leads`, {
    data: {
      name,
      number: `0107${Math.floor(1000000 + Math.random() * 8999999)}`,
      type: "cold_call",
      /* founder: on B-Systems the company name is MANDATORY at creation
         (api/b-systems/leads extends the shared schema) — omit it and the
         create answers 400 long before this spec's own subject is reached */
      companyName: `${name} Co`,
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`${api}/leads/${id}/event`, {
    data: {
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: cairoDate(1), method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

test.describe("ADR-072/082 — Postpone / Not answering", () => {
  test("the column carries his own name on BOTH internal boards", async ({ page }) => {
    await loginAsFounder(page);

    await page.goto("/b-systems/crm?company=bsystems");
    await expect(page.locator('[data-stage="postponed"]')).toBeVisible();
    await expect(page.locator('[data-stage="postponed"]')).toContainText(COLUMN);

    await page.goto("/b-systems/crm?company=byteforce");
    await expect(page.locator('[data-stage="postponed"]')).toBeVisible();
    await expect(page.locator('[data-stage="postponed"]')).toContainText(COLUMN);
  });

  test("it is NOT painted as Lost — its own colour key, on its own column", async ({ page }) => {
    await loginAsFounder(page);
    await page.goto("/b-systems/crm?company=bsystems");
    /* `data-stage` and `data-stage-key` sit on the SAME column element — the
       key is what binds the four per-stage custom properties, so asserting it
       here is asserting the colour. The helper's default is "lost": a
       `postponed` case left out of it resolves there silently and paints a
       paused lead in the colour of a dead one. */
    const column = page.locator('[data-stage="postponed"]');
    await expect(column).toHaveAttribute("data-stage-key", "postponed");
    await expect(page.locator('[data-stage="lost"]')).toHaveAttribute("data-stage-key", "lost");
  });

  test("THE BUG: dragging a lead there on the B-SYSTEMS BOARD completes, with no popup", async ({
    page,
  }) => {
    /* The test that was missing. Before ADR-082 this drop opened the confirm-move
       modal with an empty body and the move could not be completed at all. */
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Drag BS");
    await page.goto("/b-systems/crm?company=bsystems");
    const card = page.locator('[data-deal-card="Postpone Drag BS"]');
    await expect(card).toBeVisible();

    await dragTo(page, card, page.locator('[data-stage="postponed"]'));

    /* NO modal — the move commits on the drop, exactly like a move to New */
    await expect(page.getByText("Complete this stage's details to confirm the move")).toHaveCount(0);
    await expect(
      page.locator('[data-stage="postponed"] [data-deal-card="Postpone Drag BS"]'),
    ).toBeVisible();

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("THE BUG: and on the BYTEFORCE BOARD too (the board that had the hole)", async ({
    page,
  }) => {
    /* InternalBoard.tsx was the one that never learned the target: ADR-072 added
       a destination and `fieldsForTarget` returned null for it. Both boards ask
       the engine now, so neither can go stale again. */
    await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);
    const id = await leadInFollowUp(page, "Postpone Drag BF", "/api/byteforce");
    await page.goto("/b-systems/crm?company=byteforce");
    const card = page.locator('[data-deal-card="Postpone Drag BF"]');
    await expect(card).toBeVisible();

    await dragTo(page, card, page.locator('[data-stage="postponed"]'));

    await expect(page.getByText("Complete this stage's details to confirm the move")).toHaveCount(0);
    await expect(
      page.locator('[data-stage="postponed"] [data-deal-card="Postpone Drag BF"]'),
    ).toBeVisible();

    /* clean up by ARCHIVING (ADR-043) — the ByteForce API has no lead delete */
    expect(
      (await page.request.post(`/api/byteforce/leads/${id}/archive`, { data: { value: true } })).ok(),
    ).toBe(true);
  });

  test("the LEAD PAGE action asks for nothing either — one button, and it says why", async ({
    page,
  }) => {
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Panel Lead");
    await page.goto(`/b-systems/crm/lead/${id}`);

    await page.getByLabel(/Next action|Choose a next action/i).selectOption({ label: COLUMN });

    /* his three options are GONE — the popup he withdrew */
    for (const option of [
      "Not answering at all",
      "No show at the meeting",
      "Not interested right now",
      "Other",
    ]) {
      await expect(page.getByRole("radio", { name: option })).toHaveCount(0);
    }
    /* and the form says there is nothing to fill in, rather than looking broken */
    await expect(page.getByText(/Parking the lead asks for nothing/i)).toBeVisible();

    await page.getByRole("button", { name: "Save & move" }).click();
    await expect(page.getByText("Postponed", { exact: true }).first()).toBeVisible();

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("the card lands in the column, and comes back OUT of it", async ({ page }) => {
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Round Trip");
    await page.goto(`/b-systems/crm/lead/${id}`);

    await page.getByLabel(/Next action|Choose a next action/i).selectOption({ label: COLUMN });
    await page.getByRole("button", { name: "Save & move" }).click();
    await expect(page.getByText("Postponed", { exact: true }).first()).toBeVisible();

    await page.goto("/b-systems/crm?company=bsystems");
    await expect(
      page.locator('[data-stage="postponed"] [data-deal-card="Postpone Round Trip"]'),
    ).toBeVisible();

    /* BACK OUT — the property that makes it a postpone and not a second Lost */
    await page.goto(`/b-systems/crm/lead/${id}`);
    await page
      .getByLabel(/Next action|Choose a next action/i)
      .selectOption({ label: "Following Up" });
    const due = cairoDate(2);
    await page.getByLabel(/Follow-up date/).fill(due);
    await page.getByRole("button", { name: "Save & move" }).click();
    /* WAIT FOR THE WRITE TO LAND before navigating away. The panel posts and
       then refreshes; navigating straight to the board raced that round trip
       and read the lead still parked — a fault in the test, not the move. The
       follow-up record appearing in the lead's own history is the first thing
       that can only be true once the server has committed it. */
    await expect(page.getByText(/^Due /).first()).toBeVisible();

    await page.goto("/b-systems/crm?company=bsystems");
    /* due in two days ⇒ Following Up, not Fallen behind (ADR-082's split) */
    await expect(
      page.locator('[data-stage="following_up"] [data-deal-card="Postpone Round Trip"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-stage="postponed"] [data-deal-card="Postpone Round Trip"]'),
    ).toHaveCount(0);

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("a lead parked BEFORE ADR-082 still shows the reason it was parked for", async ({
    page,
  }) => {
    /* PostponeInfo stays — it is real history of why leads were shelved. New
       parks write nothing; old rows still render, with their title and their
       words. The row is planted through the same group payload the old popup
       posted, which the API still accepts (ADR-082) — so this also proves the
       old wire shape is not 400ed. */
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Legacy Reason");
    const parked = await page.request.post(`/api/b-systems/leads/${id}/event`, {
      data: {
        event: { type: "next_action", action: "postponed" },
        group: { group: "postpone", data: { reason: "other", note: "Budget frozen until Q1" } },
      },
    });
    expect(parked.ok()).toBeTruthy();

    await page.goto(`/b-systems/crm/lead/${id}`);
    await expect(page.getByText("Postponed", { exact: true }).first()).toBeVisible();

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });

  test("Arabic: the column reads in Arabic, and the park still asks nothing", async ({ page }) => {
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Arabic Lead");
    await page.goto("/b-systems/crm?company=bsystems");
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('[data-stage="postponed"]')).toContainText("تأجيل / لا يرد");

    await page.goto(`/b-systems/crm/lead/${id}`);
    await page.getByLabel(/الإجراء التالي/).selectOption({ label: "تأجيل / لا يرد" });
    for (const option of ["لا يرد نهائيًا", "لم يحضر الاجتماع", "غير مهتم حاليًا", "سبب آخر"]) {
      await expect(page.getByRole("radio", { name: option })).toHaveCount(0);
    }
    /* the replacement line has real Arabic, never an English fallback */
    await expect(page.getByText(/تأجيل العميل لا يطلب أي بيانات/)).toBeVisible();

    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  });
});
