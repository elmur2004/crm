import { expect, test, type Page } from "@playwright/test";

/* ADR-059 — the founder's second sentence, end to end: an agent is qualified
   (which asks for nothing at all), his login is created afterwards on purpose,
   and the account is a lead owner from that moment. The board's own columns,
   drags and Arabic pass live in prospect-pipeline.spec.ts. */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

/* Founder: "...and I can assing leads for agents also." ADR-059 split the
   account off the stage move, so this is the whole founder sentence end to end:
   qualify him (which asks for nothing), THEN create his login on purpose, and
   the account is assignable immediately — proven through the UI, from the
   button to the agent's own board and To-Do. */
test("an agent qualified, then given a login, can be handed a lead and sees it as his own", async ({
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
  /* founder 1.3 — qualifying asks for NOTHING: no email, no password, no form */
  await page.getByLabel("Next action").selectOption("qualified");
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Qualified")).toBeVisible();

  /* the honest state: qualified, no login yet, and the button is right there */
  await expect(page.getByRole("heading", { level: 1 }).getByText("No login yet")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Converted")).toHaveCount(0);
  await expect(page.getByText("Qualified, no account yet")).toBeVisible();

  /* §7.2b — the SEPARATE action, whenever the admin is ready */
  await page.getByRole("button", { name: "Create the agent's account" }).click();
  const accountModal = page.locator(".modal");
  await accountModal.getByLabel("Address").fill("5 El Thawra St, Heliopolis");
  await accountModal.getByLabel("Speciality").fill("Integrations");
  await accountModal.getByLabel("Email").fill("handover.agent@example.com");
  await accountModal.getByLabel("Password").fill("handover123");
  await accountModal.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Converted")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).getByText("No login yet")).toHaveCount(0);
  await expect(page.getByText(/Agent account created/)).toBeVisible();

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
