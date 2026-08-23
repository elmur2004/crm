import { expect, test, type Page } from "@playwright/test";

/* Founder 2.2/2.3 (ADR-062) — the To-Do completion checkbox and the Done
   section. "The task can be completed in two ways: 1. Automatically through
   CRM movement... 2. Manually: by marking the task as completed."

   Setup drives the existing APIs (the house todo.spec pattern — the "drag"
   event IS the board's move, without dnd choreography); the assertions are the
   user's: an accessible checkbox on every row, the checked task moving under
   Done struck through and labelled, the uncheck restoring it, and the
   auto-completed row offering NO restore. The server wall is fired directly:
   an agent posting a record id on a lead he cannot see gets 403. */

const cairoDate = (dayOffset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000),
  );

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

/** A B-Systems lead parked in Following Up with a follow-up due today. */
async function leadDueToday(page: Page, name: string, number: string) {
  const created = await page.request.post("/api/b-systems/leads", {
    data: { name, number, type: "cold_call", companyName: `${name} Co` },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "drag", to: "following_up" },
      group: { group: "follow_up", data: { date: cairoDate(), time: "10:00", method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

const todoRow = (page: Page, title: string) =>
  page.getByRole("listitem").filter({ hasText: title });

test("admin: check → Done (struck through, named), uncheck → back to Today, CRM move → auto-done with no restore", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const leadId = await leadDueToday(page, "Checkable Today Lead", "0109990201");

  await page.goto("/b-systems/todo");
  /* a real accessible control, first in the row */
  const markBox = page.getByRole("checkbox", { name: "Mark done: Checkable Today Lead" });
  await expect(markBox).toBeVisible();
  await expect(markBox).not.toBeChecked();
  await markBox.click(); // .click(): the checked state arrives with the refresh (journey5 precedent)

  /* the task leaves the active list and appears under Done — visually
     distinguished (struck through) and labelled with who completed it */
  await expect(page.getByRole("heading", { name: /^Done — \d+$/ })).toBeVisible();
  /* review: the day scope is stated ON the page, not only in the ADR — a
     money tick that reappears tomorrow must not read as a bug */
  await expect(page.getByText("Completed today")).toBeVisible();
  const restoreBox = page.getByRole("checkbox", { name: "Restore to Today: Checkable Today Lead" });
  await expect(restoreBox).toBeVisible();
  await expect(restoreBox).toBeChecked();
  const doneRow = todoRow(page, "Checkable Today Lead");
  await expect(doneRow.getByText("Done · Elmur")).toBeVisible();
  await expect(doneRow.getByRole("link", { name: "Checkable Today Lead" })).toHaveClass(
    /line-through/,
  );
  await expect(markBox).toHaveCount(0); // no unchecked twin left behind

  /* MANUAL completions restore: uncheck puts it back under Today */
  await restoreBox.click();
  await expect(page.getByRole("checkbox", { name: "Mark done: Checkable Today Lead" })).toBeVisible();
  await expect(restoreBox).toHaveCount(0);

  /* AUTOMATIC completion — the founder's own example: the follow-up completes
     when the lead moves to Meeting Setting (the board's drag event) */
  const movedRes = await page.request.post(`/api/b-systems/leads/${leadId}/event`, {
    data: {
      event: { type: "drag", to: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: cairoDate(), time: "18:30", mode: "online" },
      },
    },
  });
  expect(movedRes.ok()).toBeTruthy();

  await page.goto("/b-systems/todo");
  /* the old follow-up reads Moved to Meeting Setting and offers NO restore —
     reversing the CRM is a CRM action, not a To-Do action */
  const autoBox = page.getByRole("checkbox", {
    name: "Completed by CRM activity: Checkable Today Lead",
  });
  await expect(autoBox).toBeVisible();
  await expect(autoBox).toBeChecked();
  await expect(autoBox).toBeDisabled();
  await expect(
    todoRow(page, "Checkable Today Lead").getByText("Moved to Meeting Setting"),
  ).toBeVisible();
  /* ...while the NEW meeting task arrives in Today, unchecked */
  const meetingBox = page.getByRole("checkbox", { name: "Mark done: Checkable Today Lead" });
  await expect(meetingBox).toBeVisible();
  await expect(meetingBox).not.toBeChecked();
});

test("agent: checks HIS own task; the server wall 403s him off a lead he cannot see", async ({
  browser,
}) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* one lead handed to the seeded agent, one kept in the admin's own bucket */
  await leadDueToday(admin, "Agent Checkable Lead", "0109990202");
  await admin.goto("/b-systems/todo");
  await todoRow(admin, "Agent Checkable Lead").getByRole("button", { name: "Assign owner" }).click();
  await admin.getByLabel("Responsible for this lead").selectOption({ label: "Karim Adel — Agent" });
  await admin.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(todoRow(admin, "Agent Checkable Lead").getByText("Agents · Karim Adel")).toBeVisible();

  await leadDueToday(admin, "Walled Today Lead", "0109990203");
  await admin.goto("/b-systems/todo");
  const walledRecordId = await todoRow(admin, "Walled Today Lead")
    .getByRole("checkbox")
    .getAttribute("data-record-id");
  expect(walledRecordId).toBeTruthy();

  const agentCtx = await browser.newContext();
  const agent = await agentCtx.newPage();
  await login(agent, "01001234567", "partner123", /\/b-systems\/crm$/);
  await agent.goto("/b-systems/todo");

  /* every role gets the checkbox on its own visible tasks */
  const box = agent.getByRole("checkbox", { name: "Mark done: Agent Checkable Lead" });
  await expect(box).toBeVisible();
  await box.click();
  await expect(
    agent.getByRole("checkbox", { name: "Restore to Today: Agent Checkable Lead" }),
  ).toBeChecked();
  await expect(todoRow(agent, "Agent Checkable Lead").getByText("Done · Karim Adel")).toBeVisible();

  /* the wall is server-side: the admin-bucket lead's record id, posted from
     the agent's session, is refused — kind/recordId are never trusted */
  const walled = await agent.request.post("/api/b-systems/todo/done", {
    data: { kind: "follow_up", recordId: walledRecordId, done: true },
  });
  expect(walled.status()).toBe(403);

  /* and the money kinds are admin-only outright */
  const money = await agent.request.post("/api/b-systems/todo/done", {
    data: { kind: "milestone", recordId: "whatever", done: true },
  });
  expect(money.status()).toBe(403);

  await adminCtx.close();
  await agentCtx.close();
});

/* SPEC §5.8 (review clarification) — of the three meeting outcomes only
   Attended and Cancelled COMPLETE the task. Delayed reschedules it: T-7 nulls
   the outcome as it writes the new datetime, so the row leaves today's list
   and returns to Today on its new date, with no Done row. Pinned here because
   the alternative reading (a "Meeting delayed" Done row) is flagged for the
   founder and would show up as a diff right here. */
test("a meeting delayed to ANOTHER day leaves Today with no Done row; delayed to later TODAY it stays, unchecked", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  async function meetingToday(name: string, number: string) {
    const created = await page.request.post("/api/b-systems/leads", {
      data: { name, number, type: "cold_call", companyName: `${name} Co` },
    });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
      data: {
        event: { type: "drag", to: "meeting_setting" },
        group: {
          group: "meeting",
          data: { arranged: true, date: cairoDate(), time: "09:00", mode: "online" },
        },
      },
    });
    expect(moved.ok()).toBeTruthy();
    return id;
  }

  const awayId = await meetingToday("Delayed Away Lead", "0109990204");
  const stayId = await meetingToday("Delayed Same Day Lead", "0109990205");

  /* both start as today's meeting tasks */
  await page.goto("/b-systems/todo");
  await expect(page.getByRole("checkbox", { name: "Mark done: Delayed Away Lead" })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Mark done: Delayed Same Day Lead" }),
  ).toBeVisible();

  const delay = (leadId: string, date: string, time: string) =>
    page.request.post(`/api/b-systems/leads/${leadId}/event`, {
      data: {
        event: { type: "meeting_outcome", outcome: "delayed" },
        group: { group: "meeting_reschedule", data: { date, time } },
      },
    });
  expect((await delay(awayId, cairoDate(1), "11:00")).ok()).toBeTruthy();
  expect((await delay(stayId, cairoDate(), "20:00")).ok()).toBeTruthy();

  await page.goto("/b-systems/todo");
  /* moved out of today entirely — not in Today, and NOT in Done either */
  await expect(page.getByText("Delayed Away Lead")).toHaveCount(0);
  /* still today's task, still waiting to be ticked */
  const sameDay = page.getByRole("checkbox", { name: "Mark done: Delayed Same Day Lead" });
  await expect(sameDay).toBeVisible();
  await expect(sameDay).not.toBeChecked();
});
