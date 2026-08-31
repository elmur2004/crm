import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-072 — the "Postpone / Not answering" column, end to end.

   Founder: "We need to add a column in the CRM called postpone slash not
   answering, for all the leads that are falling out of the CRM — not answering,
   not attending the meeting, no showing. When we move the lead there, the pop
   up will be: is he not answering at all, or is he no show in the meeting, or
   is he not interested right now at all? These will be the three options, and
   there will be the option 'other' written by the user. And of course it edits
   in the CRM across the entire system."

   The engine tests pin the transitions and the integration tests pin what is
   written. This pins the two things only a browser can show:

   1. THE POPUP IS THE ONE HE DESCRIBED — three named options and an Other that
      makes you write something, on both internal boards.

   2. IT IS A POSTPONE, NOT A SECOND LOST. The column carries his own name, the
      card lands in it, and it comes back OUT — which is the whole difference
      between this and the column next to it.
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

/** A lead sitting in Following Up, made through the existing APIs — only the
    new column and its popup are exercised through the interface. */
async function leadInFollowUp(page: Page, name: string): Promise<string> {
  const created = await page.request.post("/api/b-systems/leads", {
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
  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-01", method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

test.describe("ADR-072 — Postpone / Not answering", () => {
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

  test("moving a lead there opens HIS popup: three options and an Other", async ({ page }) => {
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Popup Lead");
    await page.goto(`/b-systems/crm/lead/${id}`);

    await page.getByLabel(/Next action|Choose a next action/i).selectOption({ label: COLUMN });

    /* his three, in his words, plus Other */
    for (const option of [
      "Not answering at all",
      "No show at the meeting",
      "Not interested right now",
      "Other",
    ]) {
      await expect(page.getByRole("radio", { name: option })).toBeVisible();
    }
    /* and it says out loud that this is not Lost */
    await expect(page.getByText(/can come back out at any time/i)).toBeVisible();
  });

  test("Other makes you write something; a named reason does not", async ({ page }) => {
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Other Lead");
    await page.goto(`/b-systems/crm/lead/${id}`);
    await page.getByLabel(/Next action|Choose a next action/i).selectOption({ label: COLUMN });

    const note = page.getByLabel(/Write the reason|Anything to add/);
    /* the three named reasons leave the box optional — a no-show is fully
       described by its name, and forcing a sentence there gets "asd" typed */
    await page.getByRole("radio", { name: "No show at the meeting" }).check();
    await expect(note).not.toHaveAttribute("required", "");

    /* Other flips it to required, and renames the box to ask for the words */
    await page.getByRole("radio", { name: "Other" }).check();
    await expect(note).toHaveAttribute("required", "");
    await expect(page.getByText("Write the reason")).toBeVisible();

    await note.fill("Budget frozen until Q1");
    await page.getByRole("button", { name: "Save & move" }).click();

    await expect(page.getByText("Postponed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Budget frozen until Q1")).toBeVisible();
  });

  test("the card lands in the column, and comes back OUT of it", async ({ page }) => {
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Round Trip");
    await page.goto(`/b-systems/crm/lead/${id}`);

    await page.getByLabel(/Next action|Choose a next action/i).selectOption({ label: COLUMN });
    await page.getByRole("radio", { name: "Not answering at all" }).check();
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
    await page.getByLabel(/Follow-up date/).fill("2026-10-05");
    await page.getByRole("button", { name: "Save & move" }).click();

    await page.goto("/b-systems/crm?company=bsystems");
    await expect(
      page.locator('[data-stage="following_up"] [data-deal-card="Postpone Round Trip"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-stage="postponed"] [data-deal-card="Postpone Round Trip"]'),
    ).toHaveCount(0);

    /* and the reason it was parked is still on the record — history, not state */
    await page.goto(`/b-systems/crm/lead/${id}`);
    await expect(page.getByText("Postponed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Not answering at all")).toBeVisible();
  });

  test("Arabic: the column and all four options read in Arabic, right to left", async ({ page }) => {
    await loginAsFounder(page);
    const id = await leadInFollowUp(page, "Postpone Arabic Lead");
    await page.goto("/b-systems/crm?company=bsystems");
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('[data-stage="postponed"]')).toContainText("تأجيل / لا يرد");

    await page.goto(`/b-systems/crm/lead/${id}`);
    await page.getByLabel(/الإجراء التالي/).selectOption({ label: "تأجيل / لا يرد" });
    for (const option of ["لا يرد نهائيًا", "لم يحضر الاجتماع", "غير مهتم حاليًا", "سبب آخر"]) {
      await expect(page.getByRole("radio", { name: option })).toBeVisible();
    }
  });
});
