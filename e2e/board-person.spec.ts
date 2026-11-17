import { expect, test, type Browser, type Page } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* ============================================================================
   ADR-109 — founder, 2026-11-17, verbatim:

     "I need to add like a button on top of the CRMs, both CRMs, called main
      [Mine]. It's just visible for the admin because all other users just see
      their CRM by default. And the button I can change it either mine or
      either this person or this person, so I can basically filter by person
      the CRM, the entire CRM."

   Every account and lead here is made by this file, so the seeded people the
   other journeys count on keep their leads.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

async function signedIn(browser: Browser, identifier: string, password: string, landing: RegExp) {
  const page = await (await browser.newContext()).newPage();
  await login(page, identifier, password, landing);
  return page;
}

async function makeAccount(
  admin: Page,
  who: { name: string; email: string; password: string; roles: string[] },
): Promise<string> {
  const res = await admin.request.post("/api/b-systems/users", { data: who });
  expect(res.status(), `create ${who.email}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function makeLead(
  page: Page,
  company: "b-systems" | "byteforce",
  data: { name: string; number: string; ownerUserId?: string },
): Promise<string> {
  const res = await page.request.post(`/api/${company}/leads`, {
    data: { type: "cold_call", companyName: `${data.name} Ltd`, ...data },
  });
  expect(res.status(), `create ${data.name}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test("the admin's Showing switch narrows each board to one person, Mine or Unassigned — and remembers it, per company", async ({
  browser,
}) => {
  /* two boards, five choices and a round trip through a lead page */
  test.setTimeout(180_000);
  const admin = await signedIn(browser, "admin@byteforce.com", "password123", /\/b-systems$/);
  const agentId = await makeAccount(admin, {
    name: "Person Pick Agent",
    email: "person.pick.agent@b-systems.example",
    password: "person-pick-1",
    roles: ["bsystems_agent"],
  });
  const staffId = await makeAccount(admin, {
    name: "Person Pick Staff",
    email: "person.pick.staff@byteforce.example",
    password: "person-pick-2",
    roles: ["byteforce_staff"],
  });

  /* B-Systems: one the admin adds (his), one for the agent, one nobody owns */
  const hersId = await makeLead(admin, "b-systems", { name: "PersonPick Hers", number: "0109995501" });
  await makeLead(admin, "b-systems", { name: "PersonPick Mine", number: "0109995502" });
  const entry = await signedIn(browser, "entry@b-systems.example", "entry123", /\/b-systems\/entry$/);
  await makeLead(entry, "b-systems", { name: "PersonPick Loose", number: "0109995503" });
  await entry.context().close();
  const handed = await admin.request.post(`/api/users/${agentId}/assign-leads`, {
    data: { leadIds: [hersId] },
  });
  expect(handed.status()).toBe(200);
  /* ByteForce: one for the staff account, one nobody owns */
  await makeLead(admin, "byteforce", { name: "PersonPick BF Staff", number: "0109995504", ownerUserId: staffId });
  await makeLead(admin, "byteforce", { name: "PersonPick BF Loose", number: "0109995505" });

  const card = (name: string) => admin.locator(`[data-deal-card="${name}"]`);
  const showing = admin.getByRole("combobox", { name: "Showing" });

  /* the B-Systems board opens on Everyone, as it always has */
  await admin.goto("/b-systems/crm");
  await expect(showing).toHaveValue("all");
  for (const name of ["PersonPick Hers", "PersonPick Mine", "PersonPick Loose"]) {
    await expect(card(name)).toBeVisible();
  }
  /* each person with how many leads they hold on this board */
  await expect(showing.locator(`option[value="user:${agentId}"]`)).toHaveText("Person Pick Agent — Agent (1)");

  /* one person */
  await showing.selectOption(`user:${agentId}`);
  await expect(card("PersonPick Loose")).toHaveCount(0);
  await expect(card("PersonPick Mine")).toHaveCount(0);
  await expect(card("PersonPick Hers")).toBeVisible();

  /* remembered: into a lead and back with "Back to the CRM board" */
  await admin.goto(`/b-systems/crm/lead/${hersId}`);
  await admin.getByRole("link", { name: "Back to the CRM board" }).click();
  /* the back link carries the company (ADR-106) — and nothing else */
  await admin.waitForURL(/\/b-systems\/crm\?company=bsystems$/);
  await expect(showing).toHaveValue(`user:${agentId}`);
  await expect(card("PersonPick Hers")).toBeVisible();
  await expect(card("PersonPick Loose")).toHaveCount(0);

  /* Unassigned, then Mine */
  await showing.selectOption("unassigned");
  await expect(card("PersonPick Loose")).toBeVisible();
  await expect(card("PersonPick Hers")).toHaveCount(0);
  await expect(card("PersonPick Mine")).toHaveCount(0);
  await showing.selectOption("mine");
  await expect(card("PersonPick Mine")).toBeVisible();
  await expect(card("PersonPick Loose")).toHaveCount(0);
  await expect(card("PersonPick Hers")).toHaveCount(0);

  /* the ByteForce board has its own switch and its own choice */
  await admin.goto("/b-systems/crm?company=byteforce");
  await expect(showing).toHaveValue("all");
  await expect(card("PersonPick BF Staff")).toBeVisible();
  await expect(card("PersonPick BF Loose")).toBeVisible();
  await showing.selectOption(`user:${staffId}`);
  await expect(card("PersonPick BF Loose")).toHaveCount(0);
  await expect(card("PersonPick BF Staff")).toBeVisible();
  await admin.goto("/b-systems/crm");
  await expect(showing).toHaveValue("mine");
  await admin.goto("/b-systems/crm?company=byteforce");
  await expect(showing).toHaveValue(`user:${staffId}`);

  /* a search hop (ADR-085) lands on everyone: from B-Systems, a lead only
     ByteForce has — even though ByteForce's own choice is the staff account */
  await admin.goto("/b-systems/crm?q=PersonPick+BF+Loose");
  await admin.waitForURL(/company=byteforce&switched=bsystems$/);
  await expect(card("PersonPick BF Loose")).toBeVisible();
  await expect(showing).toHaveValue("all");
  /* picking someone there drops the hop marker and applies at once */
  await showing.selectOption(`user:${staffId}`);
  await admin.waitForURL((url) => !url.searchParams.has("switched") && url.searchParams.get("company") === "byteforce");
  await expect(card("PersonPick BF Loose")).toHaveCount(0);
  await expect(admin.getByText("None of Person Pick Staff's leads match these filters.")).toBeVisible();

  /* a search the switch emptied says so, and one press shows everyone */
  await admin.goto("/b-systems/crm?q=PersonPick+Loose");
  await expect(admin.getByText("None of your leads match these filters.")).toBeVisible();
  await admin.getByRole("button", { name: "Show everyone's leads" }).click();
  await expect(card("PersonPick Loose")).toBeVisible();
  await expect(showing).toHaveValue("all");

  /* the notice's "Back" keeps ADR-085's loop guard: picking someone there
     applies on THIS board and does not hop him back to the other company */
  await admin.goto("/b-systems/crm?q=PersonPick+BF+Loose");
  await admin.waitForURL(/company=byteforce&switched=bsystems$/);
  await admin.getByRole("link", { name: "Back to B-Systems" }).click();
  await admin.waitForURL(/company=bsystems&switched=bsystems$/);
  const saved = admin.waitForResponse(
    (r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined,
  );
  await showing.selectOption("unassigned");
  await saved;
  await expect(admin.locator(".person-switch[data-pending]")).toHaveCount(0);
  await expect(admin).toHaveURL(/\/b-systems\/crm\?q=PersonPick\+BF\+Loose&company=bsystems&switched=bsystems$/);
  /* a bounce to the other company would read "all" here */
  await expect(showing).toHaveValue("unassigned");
  await admin.reload();
  await expect(admin).toHaveURL(/\/b-systems\/crm\?q=PersonPick\+BF\+Loose&company=bsystems&switched=bsystems$/);
  await expect(showing).toHaveValue("unassigned");

  await admin.context().close();
});

test("nobody but the admin has the switch — and a hand-written cookie shows a teammate only his own cards, in both companies", async ({
  browser,
}) => {
  const admin = await signedIn(browser, "admin@byteforce.com", "password123", /\/b-systems$/);
  const agentId = await makeAccount(admin, {
    name: "Person Wall Agent",
    email: "person.wall.agent@b-systems.example",
    password: "person-wall-1",
    roles: ["bsystems_agent"],
  });
  const hisId = await makeLead(admin, "b-systems", { name: "PersonWall His", number: "0109995601" });
  await makeLead(admin, "b-systems", { name: "PersonWall Admin's", number: "0109995602" });
  const handed = await admin.request.post(`/api/users/${agentId}/assign-leads`, {
    data: { leadIds: [hisId] },
  });
  expect(handed.status()).toBe(200);
  /* and a ByteForce lead nobody owns */
  await makeLead(admin, "byteforce", { name: "PersonWall BF Loose", number: "0109995603" });
  await admin.context().close();

  /* a ByteForce teammate who is not the admin, asking for the leads nobody owns */
  const staff = await signedIn(browser, "sara@byteforce.example", "byteforce123", /\/b-systems\/crm\?company=byteforce$/);
  await staff.context().addCookies([
    { name: "board_person_byteforce", value: "unassigned", domain: new URL(staff.url()).hostname, path: "/" },
  ]);
  await staff.goto("/b-systems/crm?company=byteforce");
  await expect(staff.locator(".page-head")).toBeVisible();
  await expect(staff.locator('[data-deal-card="PersonWall BF Loose"]')).toHaveCount(0);
  await expect(staff.getByRole("combobox", { name: "Showing" })).toHaveCount(0);
  await staff.context().close();

  const agent = await signedIn(browser, "person.wall.agent@b-systems.example", "person-wall-1", /\/b-systems\/crm$/);
  /* he asks for the admin's lead and for the leads nobody owns */
  const host = new URL(agent.url()).hostname;
  for (const value of ["unassigned", "all", `user:${agentId}`]) {
    await agent.context().addCookies([{ name: "board_person_bsystems", value, domain: host, path: "/" }]);
    await agent.goto("/b-systems/crm");
    await expect(agent.locator('[data-deal-card="PersonWall His"]')).toBeVisible();
    await expect(agent.locator(`[data-deal-card="PersonWall Admin's"]`)).toHaveCount(0);
    await expect(agent.getByRole("combobox", { name: "Showing" })).toHaveCount(0);
  }
  await agent.context().close();
});
