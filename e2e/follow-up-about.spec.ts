import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-082, the founder, verbatim:

     "when I move a lead to the follow up it should be following up about
      instead of with"
     "and remove the owner selection field"

   TWO CHANGES, ONE FORM, AND THIS FILE IS WHAT PINS THEM.

   1. THE RENAME IS A SANCTIONED EXCEPTION TO THE BYTE-IDENTICAL-EN RULE
      (ADR-037), the fourth after ADR-051's "Deal → Lead", ADR-068's
      twelve-hour clock and ADR-059's "Partners & Agents". The rule survives by
      being PINNED rather than relaxed: the new wording is asserted here, in
      both languages, on every form that carries the field — so a future
      refactor cannot drift it back, and nothing was weakened to let it
      through.

   2. THE SEMANTIC SHIFT IS FOLLOWED THROUGH. "with" takes a person, "about"
      takes a topic, so the placeholder had to move too. A field captioned
      "about" over a "Contact person" hint is worse than either alone, and the
      negative assertion below is the one that catches a half-done rename.

   3. THE OWNER SELECT IS GONE from the full forms as well as the light ones.
      journey4 already proves the agent form never had it; this proves the
      ADMIN form no longer does, which is the half the founder actually asked
      for.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const cairoDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

/** Asserts the whole field, label + placeholder + the absent select, on
    whatever follow-up form is currently open. */
async function expectAboutField(page: Page) {
  const field = page.getByLabel("Following up about");
  await expect(field).toBeVisible();
  /* the topic placeholder — and NOT the contact-person one it replaced */
  await expect(field).toHaveAttribute("placeholder", "The proposal, the price, a question…");
  await expect(page.getByPlaceholder("Contact person")).toHaveCount(0);
  /* the old caption is gone, exactly (a substring check would pass on "about") */
  await expect(page.getByLabel("Following up with")).toHaveCount(0);
  /* ADR-082 — "remove the owner selection field" */
  await expect(page.getByLabel("Owner")).toHaveCount(0);
}

test("B-Systems: the full follow-up form says ABOUT, hints a topic, and has no Owner", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "About Field Lead",
      number: "0107790001",
      type: "cold_call",
      companyName: "About Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByLabel(/Next action|Choose a next action/i).selectOption("following_up");
  await expectAboutField(page);

  /* and what he types is kept and read back as a TOPIC, under "About:" */
  await page.getByLabel("Follow-up date").fill(cairoDate(1));
  await page.getByLabel("Method").selectOption("call");
  await page.getByLabel("Following up about").fill("The revised proposal price");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByText("About: The revised proposal price")).toBeVisible();
  /* the record's own line never says "With:" any more — that word belongs to
     the MEETING's attendees, which is why it still exists for them */
  await expect(page.getByText("With: The revised proposal price")).toHaveCount(0);

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

test("ByteForce: full parity — the same label, the same hint, no Owner (ADR-042)", async ({
  page,
}) => {
  await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);
  const created = await page.request.post("/api/byteforce/leads", {
    data: { name: "BF About Lead", number: "0107790002", type: "cold_call" },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto(`/b-systems/crm/lead/${id}?company=byteforce`);
  await page.getByLabel(/Next action|Choose a next action/i).selectOption("following_up");
  await expectAboutField(page);

  /* clean up by ARCHIVING (ADR-043) — the ByteForce API has no lead delete */
  expect(
    (await page.request.post(`/api/byteforce/leads/${id}/archive`, { data: { value: true } })).ok(),
  ).toBe(true);
});

test("the Partners & Agents card's follow-up form was renamed too (parity)", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const created = await page.request.post("/api/b-systems/partners-pipeline", {
    data: { kind: "agent", name: "About Prospect", number: "01066600123" },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto(`/b-systems/partners-pipeline/${id}`);
  await page.getByRole("button", { name: "Record a follow-up" }).click();
  await expectAboutField(page);

  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${id}`)).ok()).toBe(true);
});

test("Arabic: the label moved with the MEANING — بخصوص, never مع", async ({ page }) => {
  /* The trap this catches: changing only the English and leaving the Arabic
     saying "with", which is the drift the byte-identical rule exists to stop —
     in the one direction the rule itself cannot see. */
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Arabic About Lead",
      number: "0107790003",
      type: "cold_call",
      companyName: "Arabic About Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByLabel(/الإجراء التالي/).selectOption("following_up");
  const field = page.getByLabel("المتابعة بخصوص");
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute("placeholder", "العرض، السعر، سؤال…");
  await expect(page.getByLabel("المتابعة مع")).toHaveCount(0);
  await expect(page.getByLabel("المسؤول")).toHaveCount(0);

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});
