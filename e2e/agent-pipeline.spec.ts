import { expect, test, type Locator, type Page } from "@playwright/test";

/* ADR-057 — founder: "agents stages : lead , contacted , didn't answer ,
   meeting settting , qualified , lost , when he is in qualified he becomes an
   agent and we create a user for hiim and fill in the data of him and I can
   assing leads for agents also".

   The two kinds run different columns, so the default (Kind = All) view stacks
   TWO boards on one page: a Partners section, then an Agents section, each with
   its own columns and its own drag rules. These tests cover what only the live
   page can prove — the column sets and their order, that a drag lands in the
   right board, that a card cannot be dropped onto the other board, the Arabic
   pass, and the founder's second sentence end to end. */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

async function dragTo(page: Page, card: Locator, column: Locator) {
  await column.scrollIntoViewIfNeeded();
  const from = (await card.locator(".bcard-grip").boundingBox())!;
  const to = (await column.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 14 });
  const settled = (await column.boundingBox())!;
  await page.mouse.move(settled.x + settled.width / 2, settled.y + 60, { steps: 2 });
  await page.mouse.up();
}

const columnTitles = (page: Page, pipeline: string) =>
  page.locator(`[data-pipeline="${pipeline}"] .col-title`).allTextContents();

test("Kind = All stacks both boards, each with its own columns and its own drops", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  const agentRes = await page.request.post("/api/b-systems/partners-pipeline", {
    data: { kind: "agent", name: "Stacked Agent", number: "01077700011" },
  });
  expect(agentRes.status()).toBe(201);
  const agentId = ((await agentRes.json()) as { id: string }).id;
  const partnerRes = await page.request.post("/api/b-systems/partners-pipeline", {
    data: {
      kind: "partner",
      name: "Stacked Contact",
      companyName: "Stacked Partners Co",
      number: "0105557711",
      businessActivity: "HR company",
    },
  });
  expect(partnerRes.status()).toBe(201);
  const partnerId = ((await partnerRes.json()) as { id: string }).id;

  await page.goto("/b-systems/partners-pipeline");

  /* two sections, named, in the founder's order: partners first */
  await expect(page.getByRole("heading", { level: 2, name: "Partners" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Agents" })).toBeVisible();
  await expect(page.locator(".board")).toHaveCount(2);

  /* each board's columns, in order — the agent set is the founder's dictation */
  expect(await columnTitles(page, "partner")).toEqual([
    "Lead",
    "Didn't Answer",
    "Following Up",
    "Meeting Setting",
    "Won",
    "Lost",
  ]);
  expect(await columnTitles(page, "agent")).toEqual([
    "Lead",
    "Contacted",
    "Didn't Answer",
    "Meeting Setting",
    "Qualified",
    "Lost",
  ]);
  /* neither board carries the other's exclusive columns */
  await expect(page.locator('[data-pipeline="partner"] [data-stage="contacted"]')).toHaveCount(0);
  await expect(page.locator('[data-pipeline="partner"] [data-stage="qualified"]')).toHaveCount(0);
  await expect(page.locator('[data-pipeline="agent"] [data-stage="following_up"]')).toHaveCount(0);
  await expect(page.locator('[data-pipeline="agent"] [data-stage="won"]')).toHaveCount(0);

  /* an agent card drags into ITS follow-up column and opens the follow-up form */
  const agentCard = page.locator('[data-pipeline="agent"] [data-deal-card="Stacked Agent"]');
  await expect(agentCard).toBeVisible();
  await dragTo(page, agentCard, page.locator('[data-pipeline="agent"] [data-stage="contacted"]'));
  await expect(page.getByLabel("Follow-up date")).toBeVisible();
  await page.getByLabel("Follow-up date").fill("2026-09-25");
  await page.getByLabel("Follow-up time").fill("09:30");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(
    page.locator('[data-pipeline="agent"] [data-stage="contacted"] [data-deal-card="Stacked Agent"]'),
  ).toBeVisible();

  /* the partner board's own drag is completely independent on the same page */
  const partnerCard = page.locator('[data-pipeline="partner"] [data-deal-card="Stacked Partners Co"]');
  await dragTo(
    page,
    partnerCard,
    page.locator('[data-pipeline="partner"] [data-stage="didnt_answer"]'),
  );
  await expect(page.getByText("Number dialed — which number(s) went unanswered?")).toBeVisible();
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(
    page.locator(
      '[data-pipeline="partner"] [data-stage="didnt_answer"] [data-deal-card="Stacked Partners Co"]',
    ),
  ).toBeVisible();

  /* dropping an agent card onto the PARTNER board is a no-op: separate drag
     contexts, so the drop never registers and no form opens */
  await dragTo(
    page,
    page.locator('[data-pipeline="agent"] [data-deal-card="Stacked Agent"]'),
    page.locator('[data-pipeline="partner"] [data-stage="following_up"]'),
  );
  await expect(page.locator(".modal")).toHaveCount(0);
  await expect(
    page.locator('[data-pipeline="agent"] [data-stage="contacted"] [data-deal-card="Stacked Agent"]'),
  ).toBeVisible();

  /* filtering gives one board — the one that was asked for */
  await page.goto("/b-systems/partners-pipeline?kind=partner");
  await expect(page.locator(".board")).toHaveCount(1);
  expect(await columnTitles(page, "partner")).toContain("Following Up");
  await page.goto("/b-systems/partners-pipeline?kind=agent");
  await expect(page.locator(".board")).toHaveCount(1);
  expect(await columnTitles(page, "agent")).toContain("Qualified");

  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${agentId}`)).ok()).toBe(true);
  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${partnerId}`)).ok()).toBe(
    true,
  );
});

/* six 218px columns + gaps is ~1370px, wider than the default 1280 viewport, so
   Lost sits outside it and page.mouse — which works in VIEWPORT coordinates —
   could never reach the card. Give this one test a board that fits. */
test.describe("stacked boards, whole board visible", () => {
  test.use({ viewport: { width: 1800, height: 1000 } });

test("the two stacked boards share ONE toast slot, so nothing stale is left behind", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/partners-pipeline");

  /* `.toast-wrap` is position:fixed at one coordinate. A terminal card refuses
     to move and says so; with per-pipeline state the partner board's sentence
     stayed on screen UNDER the agent board's, two alerts in the same spot with
     the older one lying. Both drags are rejected client-side — nothing is
     written, so this is safe on the shared serial database. */
  const lostPartner = page.locator(
    '[data-pipeline="partner"] [data-stage="lost"] [data-deal-card="Luxor Analytics"]',
  );
  await expect(lostPartner).toBeVisible();
  /* a column well clear of Lost: dnd-kit scores collisions on the dragged
     CARD's rect, not the pointer, so a drop one column over can still overlap
     the source more than the target and register as a no-op */
  await dragTo(
    page,
    lostPartner,
    page.locator('[data-pipeline="partner"] [data-stage="didnt_answer"]'),
  );
  /* the <p> also holds the aria-hidden "!" icon, so match the sentence itself */
  await expect(page.locator(".toast")).toContainText("Won and Lost cards can no longer be moved.");

  const lostAgent = page.locator(
    '[data-pipeline="agent"] [data-stage="lost"] [data-deal-card="Amr Shaker"]',
  );
  await expect(lostAgent).toBeVisible();
  await dragTo(
    page,
    lostAgent,
    page.locator('[data-pipeline="agent"] [data-stage="didnt_answer"]'),
  );
  await expect(page.locator(".toast")).toHaveCount(1);
  await expect(page.locator(".toast")).toContainText(
    "Qualified and Lost cards can no longer be moved.",
  );
  /* and the partner sentence is GONE, not merely covered */
  await expect(page.locator(".toast")).not.toContainText("Won and Lost");

  /* neither card moved */
  await expect(lostPartner).toBeVisible();
  await expect(lostAgent).toBeVisible();
});
});

test("an empty SECTION says why it is empty — filtered out, not non-existent", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  /* a search that only an AGENT matches: the partner section is empty because
     of the filter, so "No partner cards yet." would be a lie */
  await page.goto("/b-systems/partners-pipeline?q=Amr+Shaker");
  await expect(page.getByRole("heading", { level: 2, name: "Partners" })).toBeVisible();
  await expect(page.getByText("No cards match these filters.")).toBeVisible();
  await expect(page.getByText("No partner cards yet.")).toHaveCount(0);
  await expect(
    page.locator('[data-pipeline="agent"] [data-deal-card="Amr Shaker"]'),
  ).toBeVisible();
});

test("Arabic: both sections read right-to-left with the agent columns translated", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/partners-pipeline");
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await expect(page.getByRole("heading", { level: 2, name: "الشركاء" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "الوكلاء" })).toBeVisible();
  expect(await columnTitles(page, "agent")).toEqual([
    "عميل محتمل",
    "تم التواصل",
    "لم يرد",
    "تحديد اجتماع",
    "مؤهَّل",
    "خسارة",
  ]);

  /* the founder's order is the READING order in both languages: in RTL the
     first column sits to the RIGHT of the last */
  const cols = page.locator('[data-pipeline="agent"] .col');
  const first = (await cols.first().boundingBox())!;
  const last = (await cols.last().boundingBox())!;
  expect(first.x).toBeGreaterThan(last.x);

  /* stacking is block-axis, so Partners still sits ABOVE Agents in Arabic */
  const partnerBoard = (await page.locator('[data-pipeline="partner"]').boundingBox())!;
  const agentBoard = (await page.locator('[data-pipeline="agent"]').boundingBox())!;
  expect(partnerBoard.y).toBeLessThan(agentBoard.y);

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(await columnTitles(page, "agent")).toEqual([
    "Lead",
    "Contacted",
    "Didn't Answer",
    "Meeting Setting",
    "Qualified",
    "Lost",
  ]);
});

/* Founder: "...and I can assing leads for agents also." The account the
   Qualified gate mints is assignable immediately — proven through the UI, from
   the gate to the agent's own board and To-Do. */
test("an agent minted at Qualified can be handed a lead and sees it as his own", async ({
  page,
  browser,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  const created = await page.request.post("/api/b-systems/partners-pipeline", {
    data: { kind: "agent", name: "Handover Agent", number: "01088800022" },
  });
  expect(created.status()).toBe(201);
  const agentCardId = ((await created.json()) as { id: string }).id;

  await page.goto(`/b-systems/partners-pipeline/${agentCardId}`);
  await page.getByLabel("Next action").selectOption("qualified");
  const gate = page.locator("form").filter({ hasText: "Qualified creates the agent's account" });
  await gate.getByLabel("Address").fill("5 El Thawra St, Heliopolis");
  await gate.getByLabel("Speciality").fill("Integrations");
  await gate.getByLabel("Email").fill("handover.agent@example.com");
  await gate.getByLabel("Password").fill("handover123");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Qualified")).toBeVisible();

  /* a lead to hand over */
  const leadRes = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Handover Corp",
      number: "0109998877",
      type: "cold_call",
      companyName: "Handover Co",
    },
  });
  expect(leadRes.status()).toBe(201);
  const leadId = ((await leadRes.json()) as { id: string }).id;

  /* the newly minted agent is in the roster on the lead itself */
  await page.goto(`/b-systems/crm/lead/${leadId}`);
  await page.getByRole("button", { name: "Assign owner" }).click();
  const owner = page.getByLabel("Responsible for this lead");
  await expect(owner.getByRole("option", { name: /Handover Agent/ })).toHaveCount(1);
  /* the option label is "{name} — {role}" — select by its VALUE so the test
     never depends on that formatting */
  const optionValue = await owner
    .getByRole("option", { name: /Handover Agent/ })
    .getAttribute("value");
  await owner.selectOption(optionValue!);
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.getByText("Handover Agent").first()).toBeVisible();

  /* give the lead a dated follow-up so it lands on his To-Do too */
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const moved = await page.request.post(`/api/b-systems/leads/${leadId}/event`, {
    data: {
      event: { type: "drag", to: "following_up" },
      group: { group: "follow_up", data: { date: today, time: "10:00", method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();

  /* he signs in with the admin-set credentials and it is HIS lead */
  const agentCtx = await browser.newContext();
  const agentPage = await agentCtx.newPage();
  await login(agentPage, "handover.agent@example.com", "handover123", /\/b-systems\/crm$/);
  await expect(agentPage.locator('[data-deal-card="Handover Corp"]')).toBeVisible();
  await agentPage.goto("/b-systems/todo");
  await expect(agentPage.getByText("Handover Corp")).toBeVisible();
  await agentCtx.close();
});
