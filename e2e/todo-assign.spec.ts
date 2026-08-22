import { expect, test, type Page } from "@playwright/test";

/* Founder, looking at /b-systems/todo: "I can assign these to do as an admin
   or just take it myself."

   A to-do row is a projection over a LEAD's dated records, so assigning the
   task IS reassigning the lead — through the existing admin-only endpoint, no
   new state. "Take it myself" parks the lead in the admin bucket with the
   admin as its owner (the same state an admin-created lead already has).
   Admin only: agents and internal sales keep the plain list they always had,
   and the admin-owned money subsystems (statements, milestones) have nobody
   to hand over to, so those rows stay bare. (Partner-prospect rows left the
   To-Do entirely — ADR-061.)
   Review: the row wears the app's owner CHIP — bucket first, then the name
   (owner account, else internal rep, else the referring partner company) —
   so a lead that is assigned never reads as "Unassigned" here. */

const cairoDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

/** A B-Systems lead parked in Following Up with a follow-up due on `date`. */
async function leadDueOn(page: Page, name: string, number: string, date: string) {
  const created = await page.request.post("/api/b-systems/leads", {
    data: { name, number, type: "cold_call", companyName: `${name} Co` },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "drag", to: "following_up" },
      group: { group: "follow_up", data: { date, time: "10:00", method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

/** The row is a plain <li>; scope every control to it (buttons repeat per row). */
const todoRow = (page: Page, title: string) =>
  page.getByRole("listitem").filter({ hasText: title });

/** Hands the row's lead to `optionLabel` through the row's Assign modal. */
async function assignFromRow(page: Page, title: string, optionLabel: string) {
  await todoRow(page, title).getByRole("button", { name: "Assign owner" }).click();
  await page.getByLabel("Responsible for this lead").selectOption({ label: optionLabel });
  await page.getByRole("button", { name: "Assign", exact: true }).click();
}

test("admin: a lead row carries its owner, Assign and Take it — a prospect card never lists (ADR-061)", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  /* ADR-061: only TODAY lists — an overdue row would simply be invisible, so
     the handover row under test is due today */
  const today = cairoDate();
  const leadId = await leadDueOn(page, "Today Handover Lead", "0109990101", today);

  /* the same day on the ADMIN-ONLY partnership board — since ADR-061 that
     funnel does not reach the To-Do at all, recorded follow-up or not */
  const prospect = await page.request.post("/api/b-systems/partners-pipeline", {
    data: {
      kind: "partner",
      name: "Prospect Todo Contact",
      companyName: "Prospect Todo Co",
      number: "0105559911",
      businessActivity: "Consulting",
    },
  });
  expect(prospect.status()).toBe(201);
  const prospectId = ((await prospect.json()) as { id: string }).id;
  const prospectMoved = await page.request.post(
    `/api/b-systems/partners-pipeline/${prospectId}/event`,
    {
      data: {
        event: { type: "next_action", action: "follow_up_again" },
        group: { group: "follow_up", data: { date: today, method: "call" } },
      },
    },
  );
  expect(prospectMoved.ok()).toBeTruthy();

  await page.goto("/b-systems/todo");
  /* founder (ADR-061): the Overdue section is gone for good… */
  await expect(page.getByRole("heading", { name: "Overdue" })).toHaveCount(0);
  /* …and so is the partner row, its follow-up due today notwithstanding */
  await expect(todoRow(page, "Prospect Todo Co")).toHaveCount(0);

  /* An admin-created lead is already the admin's own, so there is nothing to
     take — the label names them and only Assign is offered. */
  const row = todoRow(page, "Today Handover Lead");
  await expect(row.getByText("Admins · Elmur")).toBeVisible();
  await expect(row.getByRole("button", { name: "Assign owner" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Take it" })).toHaveCount(0);

  /* Hand it to the seeded agent: the row now names him and offers Take it. */
  await assignFromRow(page, "Today Handover Lead", "Karim Adel — Agent");
  await expect(row.getByText("Agents · Karim Adel")).toBeVisible();
  await expect(row.getByRole("button", { name: "Take it" })).toBeVisible();

  /* …and taking it back parks it in the admin bucket, here AND on the lead. */
  await row.getByRole("button", { name: "Take it" }).click();
  await expect(row.getByText("Admins · Elmur")).toBeVisible();
  await expect(row.getByRole("button", { name: "Take it" })).toHaveCount(0);

  await page.goto(`/b-systems/crm/lead/${leadId}`);
  await expect(page.getByText("Admins · Elmur", { exact: true })).toBeVisible();
});

test("the agent it was assigned to finds the task on their own To-Do — with no controls", async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@byteforce.com", "password123", /\/b-systems$/);
  await leadDueOn(admin, "Handover Today Lead", "0109990102", cairoDate());

  await admin.goto("/b-systems/todo");
  await assignFromRow(admin, "Handover Today Lead", "Karim Adel — Agent");
  await expect(
    todoRow(admin, "Handover Today Lead").getByText("Agents · Karim Adel"),
  ).toBeVisible();

  const agentCtx = await browser.newContext();
  const agent = await agentCtx.newPage();
  await login(agent, "01001234567", "partner123", /\/b-systems\/crm$/);
  await agent.goto("/b-systems/todo");
  await expect(agent.getByRole("link", { name: "Handover Today Lead" })).toBeVisible();
  /* handing a lead over is a management act — the agent gets no controls */
  await expect(agent.getByRole("button", { name: "Assign owner" })).toHaveCount(0);
  await expect(agent.getByRole("button", { name: "Take it" })).toHaveCount(0);

  await adminCtx.close();
  await agentCtx.close();
});

test("internal sales sees their To-Do exactly as before — no assign controls", async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@byteforce.com", "password123", /\/b-systems$/);
  await leadDueOn(admin, "Internal Today Lead", "0109990103", cairoDate());

  await admin.goto("/b-systems/todo");
  await assignFromRow(admin, "Internal Today Lead", "Omar Farouk — Internal sales");
  await expect(
    todoRow(admin, "Internal Today Lead").getByText("Internal · Omar Farouk"),
  ).toBeVisible();

  const salesCtx = await browser.newContext();
  const sales = await salesCtx.newPage();
  await login(sales, "omar@b-systems.example", "bsystems123", /\/b-systems\/crm$/);
  await sales.goto("/b-systems/todo");
  await expect(sales.getByRole("link", { name: "Internal Today Lead" })).toBeVisible();
  await expect(sales.getByRole("button", { name: "Assign owner" })).toHaveCount(0);
  await expect(sales.getByRole("button", { name: "Take it" })).toHaveCount(0);

  await adminCtx.close();
  await salesCtx.close();
});
