import { expect, test, type Locator, type Page } from "@playwright/test";

/* ============================================================================
   ADR-069 — the WhatsApp chip turns GREEN once the record has been messaged.

   Founder, verbatim: "when I click on the WhatsApp button, it should turn to be
   green to signal that I already sent WhatsApp to that prospect or to that lead,
   and it signals not just for my user, for any user that we have contacted this
   lead through WhatsApp. So it turns green or something. Just change its color.
   If it's not green right now, turn it green to signal that we did our due
   diligence and sent them WhatsApp message."

   The two halves that matter are proved here on the built app:
     · a press turns it green — and the green is the TOKEN's green, measured off
       what the browser actually painted, so a pair declared outside the brand
       scope (the ADR-054-addendum failure, which shipped twice) fails here
       rather than in production;
     · a SECOND USER, on a different account and a different role, sees the same
       green — which is the whole request.

   The chip also keeps its job: the link still opens wa.me in a new tab, and the
   mark is fire-and-forget behind it.
   ========================================================================== */

const ADMIN = { id: "admin@byteforce.com", password: "password123" };
const OMAR = { id: "omar@b-systems.example", password: "bsystems123" };
const SARA = { id: "sara@byteforce.example", password: "byteforce123" };

/* the ADR-069 exception pair, as the three token scopes declare it */
const GREEN_INK = "rgb(27, 122, 68)"; // #1B7A44
const GREEN_TINT = "rgb(230, 244, 236)"; // #E6F4EC

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing);
}

/** wa.me must never actually be reached from a test run — the chip's link is
    real, so it is answered locally instead of leaving the machine. */
async function stubWhatsApp(page: Page) {
  await page.context().route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>wa</body></html>" }),
  );
}

/** Press the chip the way a person does — the link opens a new tab, which is
    closed again so the run does not accumulate windows. */
async function pressChip(page: Page, chip: Locator) {
  const [popup] = await Promise.all([page.waitForEvent("popup"), chip.click()]);
  await expect(popup).toHaveURL(/^https:\/\/wa\.me\/\d+$/); // the link still works
  await popup.close();
}

/** What the browser PAINTED. A token that is declared outside its [data-brand]
    scope resolves to nothing and the chip stays grey with a clean CI. */
const paintOf = (chip: Locator) =>
  chip.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, ink: cs.color };
  });

/** Reload until the SERVER agrees — the mark is dispatched with sendBeacon and
    nothing waits on it, so the very next render may still be the pre-press one.
    That is the feature, not a flake: the link must never wait on the network. */
async function expectGreenAfterReload(page: Page, chip: () => Locator) {
  await expect(async () => {
    await page.reload();
    await expect(chip()).toHaveClass(/wa-sent/);
  }).toPass({ timeout: 15_000 });
}

test("a press turns the chip green on the B-Systems board, and a DIFFERENT user sees it", async ({
  page,
}) => {
  await stubWhatsApp(page);

  /* Omar (internal sales) enters the lead, so it lands in the INTERNAL bucket
     and both he and the admin can legitimately see it. */
  await login(page, OMAR.id, OMAR.password, /\/b-systems\/crm$/);
  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Green Signal Lead",
      number: "01099911122",
      type: "cold_call",
      /* B-Systems creation requires a company name (founder) */
      companyName: "Green Signal Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  /* ---- the admin does the messaging ---- */
  const adminCtx = await page.context().browser()!.newContext();
  const adminPage = await adminCtx.newPage();
  await stubWhatsApp(adminPage);
  await login(adminPage, ADMIN.id, ADMIN.password, /\/b-systems$/);
  await adminPage.goto("/b-systems/crm");

  const adminCard = adminPage.locator('[data-deal-card="Green Signal Lead"]');
  await expect(adminCard).toBeVisible();
  const plainChip = () => adminCard.getByRole("link", { name: "WhatsApp", exact: true });
  await expect(plainChip()).toHaveCount(1);
  await expect(plainChip()).not.toHaveClass(/wa-sent/);
  const before = await paintOf(plainChip());
  expect(before.bg).not.toBe(GREEN_TINT);

  await pressChip(adminPage, plainChip());

  /* IMMEDIATELY green, before any reload: the founder gets his signal at the
     speed of the press, not at the speed of the round trip */
  const sentChip = () => adminCard.getByRole("link", { name: /^WhatsApp sent/ });
  await expect(sentChip()).toHaveClass(/wa-sent/);
  await expect(sentChip()).toHaveAttribute("data-wa-sent", "true");

  /* …and green in the TOKENS' green, measured off the paint */
  const painted = await paintOf(sentChip());
  expect(painted.bg).toBe(GREEN_TINT);
  expect(painted.ink).toBe(GREEN_INK);

  /* the server render carries who and when, and the words say it too — the
     state is never colour alone */
  await expectGreenAfterReload(adminPage, () =>
    adminCard.getByRole("link", { name: /^WhatsApp sent by Elmur on \d{1,2} \w{3} \d{4}$/ }),
  );
  const named = adminCard.getByRole("link", { name: /^WhatsApp sent by Elmur on / });
  await expect(named).toHaveAttribute("title", /^WhatsApp sent by Elmur on /);
  await expect(named).toHaveAttribute("href", "https://wa.me/201099911122");
  await expect(named).toHaveAttribute("target", "_blank");

  /* the SAME state on the lead detail and on the call sheet — one record, one
     answer, wherever the chip is printed */
  await adminPage.goto(`/b-systems/crm/lead/${id}`);
  await expect(
    adminPage.locator(".page-actions").getByRole("link", { name: /^WhatsApp sent by Elmur on / }),
  ).toHaveClass(/wa-sent/);
  await adminPage.goto(`/b-systems/crm/lead/${id}/call`);
  /* the call sheet COMPOSES rather than swaps: its rest label is the only place
     the verb and the number are spoken, so marking must not cost the phone-first
     button either of them — the state is appended to the name, not put in its
     place */
  const callChip = adminPage.getByRole("link", {
    name: /^Message on WhatsApp — 01099911122 — WhatsApp sent by Elmur on /,
  });
  await expect(callChip).toHaveClass(/wa-sent/);
  expect((await paintOf(callChip)).ink).toBe(GREEN_INK);
  /* …and the sentence is printed in VISIBLE words as well: `title` is a hover
     tooltip, and this screen is the one built to be used on a phone */
  await expect(
    adminPage.locator(".call-line").filter({ hasText: /^WhatsApp sent by Elmur on / }),
  ).toBeVisible();

  /* ---- THE REQUEST ITSELF: a different user, a different role, same green --- */
  await page.goto("/b-systems/crm");
  const omarCard = page.locator('[data-deal-card="Green Signal Lead"]');
  const omarChip = omarCard.getByRole("link", { name: /^WhatsApp sent by Elmur on / });
  await expect(omarChip).toBeVisible();
  await expect(omarChip).toHaveClass(/wa-sent/);
  expect((await paintOf(omarChip)).bg).toBe(GREEN_TINT);
  /* nothing plain is left beside it — the chip changed, it did not duplicate */
  await expect(omarCard.getByRole("link", { name: "WhatsApp", exact: true })).toHaveCount(0);

  /* and Omar pressing it too does not steal the credit: the FIRST message is
     the record (ADR-069 — there is no unmark and no overwrite) */
  await pressChip(page, omarChip);
  await page.reload();
  await expect(
    omarCard.getByRole("link", { name: /^WhatsApp sent by Elmur on / }),
  ).toHaveClass(/wa-sent/);

  /* tidy up through the ADMIN's context — deleting a lead is admin-only, and
     the suite shares one seeded database */
  expect((await adminPage.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  await adminCtx.close();
});

test("the ByteForce board's chip goes green too, and Sara sees it", async ({ page }) => {
  await stubWhatsApp(page);
  await login(page, ADMIN.id, ADMIN.password, /\/b-systems$/);

  const created = await page.request.post("/api/byteforce/leads", {
    data: { name: "Green Signal BF", number: "01099911133", type: "cold_call" },
  });
  expect(created.status()).toBe(201);

  /* ADR-067 — one shell, the company rides the query string */
  await page.goto("/b-systems/crm?company=byteforce");
  const card = page.locator('[data-deal-card="Green Signal BF"]');
  await expect(card).toBeVisible();
  const chip = () => card.getByRole("link", { name: "WhatsApp", exact: true });
  await expect(chip()).not.toHaveClass(/wa-sent/);

  await pressChip(page, chip());
  await expectGreenAfterReload(page, () => card.getByRole("link", { name: /^WhatsApp sent/ }));
  /* the token resolves under THIS company's brand scope as well — the pair is
     declared identically in both, which is what makes the switch safe */
  expect((await paintOf(card.getByRole("link", { name: /^WhatsApp sent/ }))).bg).toBe(GREEN_TINT);

  /* Sara is ByteForce staff and never touched this lead — she still sees it */
  const saraCtx = await page.context().browser()!.newContext();
  const saraPage = await saraCtx.newPage();
  await login(saraPage, SARA.id, SARA.password, /\/b-systems\?company=byteforce$/);
  await saraPage.goto("/b-systems/crm?company=byteforce");
  const saraChip = saraPage
    .locator('[data-deal-card="Green Signal BF"]')
    .getByRole("link", { name: /^WhatsApp sent by Elmur on \d{1,2} \w{3} \d{4}$/ });
  await expect(saraChip).toHaveClass(/wa-sent/);
  await saraCtx.close();
  /* ByteForce leads have no delete endpoint (only PATCH), so this card stays —
     the byteforce-board spec's "Parity Deal" sets the same precedent, and this
     file runs near the end of the alphabet on a serial suite. */
});

test("the partner/agent card carries the same mark, on its board and its detail", async ({
  page,
}) => {
  await stubWhatsApp(page);
  await login(page, ADMIN.id, ADMIN.password, /\/b-systems$/);

  const res = await page.request.post("/api/b-systems/partners-pipeline", {
    data: { kind: "agent", name: "Greenmark Agent", number: "01055599988" },
  });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: string };

  await page.goto("/b-systems/partners-pipeline");
  const card = page.locator('[data-deal-card="Greenmark Agent"]');
  await expect(card).toBeVisible();
  const chip = () => card.getByRole("link", { name: "WhatsApp", exact: true });
  await expect(chip()).not.toHaveClass(/wa-sent/);

  await pressChip(page, chip());
  await expectGreenAfterReload(page, () => card.getByRole("link", { name: /^WhatsApp sent/ }));

  /* the detail agrees — header chip AND the number row's chip, because the mark
     is the CARD's, not any one number's */
  await page.goto(`/b-systems/partners-pipeline/${id}`);
  await expect(
    page.locator(".page-actions").getByRole("link", { name: /^WhatsApp sent by Elmur on / }),
  ).toHaveClass(/wa-sent/);
  const inlineChip = page
    .locator(".fields-grid")
    .getByRole("link", { name: /^WhatsApp sent by Elmur on / })
    .first();
  await expect(inlineChip).toHaveClass(/wa-sent/);
  expect((await paintOf(inlineChip)).ink).toBe(GREEN_INK);

  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${id}`)).ok()).toBe(true);
});

test("one press greens every chip for the SAME record, before any reload", async ({ page }) => {
  await stubWhatsApp(page);
  await login(page, ADMIN.id, ADMIN.password, /\/b-systems$/);

  /* the prospect detail prints the chip TWICE for one record — in the header,
     and again beside the number it lists — and both mark the same card */
  const res = await page.request.post("/api/b-systems/partners-pipeline", {
    data: { kind: "agent", name: "Twin Chip Agent", number: "01055599977" },
  });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: string };

  await page.goto(`/b-systems/partners-pipeline/${id}`);
  const headerChip = page
    .locator(".page-actions")
    .getByRole("link", { name: "WhatsApp", exact: true });
  const inlineChip = page.locator(".fields-grid").getByRole("link", { name: "WhatsApp", exact: true });
  await expect(headerChip).toHaveCount(1);
  await expect(inlineChip).toHaveCount(1);

  await pressChip(page, headerChip);

  /* the sibling goes green WITH it, with no reload in between: a record that is
     green in one place and plain in another is the confusion ADR-069 exists to
     remove, and the optimistic state is the RECORD's, not one element's */
  await expect(page.locator('.fields-grid [data-wa-sent="true"]')).toHaveCount(1);
  await expect(
    page.locator(".page-actions").getByRole("link", { name: /^WhatsApp sent/ }),
  ).toHaveClass(/wa-sent/);

  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${id}`)).ok()).toBe(true);
});

test("Arabic: the chip says who sent it and when, in Arabic", async ({ page }) => {
  await stubWhatsApp(page);
  await login(page, ADMIN.id, ADMIN.password, /\/b-systems$/);

  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Green Signal Arabic",
      number: "01099911144",
      type: "cold_call",
      companyName: "Green Signal Arabic Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto("/b-systems/crm");
  const card = page.locator('[data-deal-card="Green Signal Arabic"]');
  await pressChip(page, card.getByRole("link", { name: "WhatsApp", exact: true }));
  await expectGreenAfterReload(page, () => card.getByRole("link", { name: /^WhatsApp sent/ }));

  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  /* real Arabic, with the brand name left in latin exactly as dict/call has
     always kept it — and the date through the one shared formatter */
  const arabicChip = card.getByRole("link", { name: /^أرسل Elmur رسالة WhatsApp في / });
  await expect(arabicChip).toBeVisible();
  await expect(arabicChip).toHaveClass(/wa-sent/);

  await page.getByRole("button", { name: "EN", exact: true }).click();
  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});
