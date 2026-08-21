import { expect, test, type Page } from "@playwright/test";

/* ADR-051 — the data-entry role. Founder: "I want to add a type of user called
   data entry. This user is just able to add leads or partners or agents...
   They are just adding, and they will not be the owner of what they add. It
   will be with no owner until the admin decides which owner is these leads."

   Two things have to be true and both are proved here: they CAN add a lead and
   a card through the real UI, and every other door in the system is shut
   server-side — not merely hidden. */

const ENTRY = { id: "entry@b-systems.example", password: "entry123" };

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing);
}

test("data entry: adds a lead and a card, owns neither, and is walled out of everything else", async ({
  page,
  browser,
}) => {
  /* signing in lands on their ONE page */
  await login(page, ENTRY.id, ENTRY.password, /\/b-systems\/entry$/);
  await expect(page.getByRole("heading", { level: 1, name: "Data entry" })).toBeVisible();

  /* the nav offers exactly one destination — the honest picture of the role */
  await expect(page.getByRole("link", { name: "CRM", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Won Leads", exact: true })).toHaveCount(0);

  /* ADD A LEAD */
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Delta Mills");
  await page.getByLabel("Number", { exact: true }).fill("0102003040");
  await page.getByLabel("Company name").fill("Delta Mills SAE");
  await page.getByRole("button", { name: "Save lead" }).click();
  await expect(page.getByRole("cell", { name: "Delta Mills", exact: true })).toBeVisible();
  /* it belongs to nobody until the admin says otherwise */
  await expect(page.getByRole("cell", { name: "Waiting for an owner" }).first()).toBeVisible();

  /* ADD A CARD on the Partners & Agents board */
  await page.getByRole("button", { name: "Add partner or agent" }).click();
  await page.getByLabel("What are you adding?").selectOption("agent");
  await page.getByLabel("First name").fill("Rania");
  await page.getByLabel("Last name").fill("Saad");
  await page.getByLabel("Phone number").fill("01055667788");
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page.getByRole("cell", { name: "Rania Saad" })).toBeVisible();

  /* A second card straight through the API — creating IS their permission, and
     its real id makes the refusals below prove AUTHORIZATION rather than a
     missing row (requireLeadAccess resolves the id before the role). */
  const created = await page.request.post("/api/b-systems/partners-pipeline", {
    data: {
      kind: "partner",
      name: "Sameh Nabil",
      companyName: "Nabil Trading",
      number: "0223339999",
      businessActivity: "HR company",
    },
  });
  expect(created.status()).toBe(201);
  const myCard = (await created.json()) as { id: string };

  /* An admin elsewhere owns a lead this person must never touch or even read. */
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await login(adminPage, "admin@byteforce.com", "password123", /\/b-systems$/);
  const adminLeadRes = await adminPage.request.post("/api/b-systems/leads", {
    data: { name: "Admin Owned", number: "0109990000", type: "cold_call", companyName: "Admin Co" },
  });
  const adminLead = (await adminLeadRes.json()) as { id: string };

  /* EVERY OTHER DOOR — pages bounce back to their own landing, never to a
     sign-in form and never to someone else's data */
  for (const path of [
    "/b-systems",
    "/b-systems/crm",
    "/b-systems/leads",
    "/b-systems/won-leads",
    "/b-systems/partners-pipeline",
    "/b-systems/partners",
    "/b-systems/agents",
    "/b-systems/registrations",
    "/b-systems/statements",
    "/b-systems/users",
    "/b-systems/todo",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/b-systems\/entry$/);
  }

  /* ...and the APIs behind them refuse server-side (the real wall) */
  const forbidden = [
    /* not even on the card they entered themselves: moving a stage is not
       adding, and neither is deleting */
    ["post", `/api/b-systems/partners-pipeline/${myCard.id}/event`, { event: { type: "drag", to: "qualified" } }],
    /* §7.2b — minting a LOGIN from a data-entry session would be a real
       privilege escalation: the route is admin-only by construction */
    ["post", `/api/b-systems/partners-pipeline/${myCard.id}/account`, { email: "x@example.com", password: "sneaky123" }],
    /* someone else's lead — every mutation, and the read behind it */
    ["post", `/api/b-systems/leads/${adminLead.id}/event`, { event: { type: "next_action", action: "won" } }],
    ["post", `/api/b-systems/leads/${adminLead.id}/assign`, { userId: "any" }],
    ["post", `/api/b-systems/leads/${adminLead.id}/archive`, { archived: true }],
    ["post", `/api/b-systems/leads/${adminLead.id}/ready`, {}],
    ["post", `/api/b-systems/leads/${adminLead.id}/no-answer`, { noAnswer: true }],
    ["patch", `/api/b-systems/leads/${adminLead.id}`, { name: "Poached" }],
    ["post", `/api/b-systems/leads/${adminLead.id}/comments`, { body: "hello" }],
    /* the admin subsystems */
    ["post", "/api/b-systems/users", { name: "x", email: "x@y.z", password: "12345678", roles: ["bsystems_admin"] }],
    ["patch", "/api/b-systems/users/any-id", { active: false }],
    ["post", "/api/b-systems/reps", { name: "x" }],
    ["patch", "/api/b-systems/registrations/any-id", { action: "approve" }],
    ["patch", "/api/b-systems/milestones/any-id", { completed: true }],
  ] as const;
  for (const [method, url, data] of forbidden) {
    const res = await page.request[method](url, { data });
    expect(res.status(), `${method.toUpperCase()} ${url}`).toBe(403);
  }
  /* deleting is not adding — not even their own card */
  const del = await page.request.delete(`/api/b-systems/partners-pipeline/${myCard.id}`);
  expect(del.status()).toBe(403);
  /* but correcting their OWN untouched card IS allowed */
  const fix = await page.request.patch(`/api/b-systems/partners-pipeline/${myCard.id}`, {
    data: { name: "Sameh Nabil Ahmed" },
  });
  expect(fix.status()).toBe(200);

  /* the admin, meanwhile, FINDS the entered lead waiting under Unassigned and
     can hand it to someone — which is the whole point of the role */
  await adminPage.goto("/b-systems/leads?owner=unassigned");
  const entered = adminPage.getByRole("link", { name: "Delta Mills" });
  await expect(entered).toBeVisible();
  await expect(adminPage.getByRole("link", { name: "Admin Owned" })).toHaveCount(0);

  /* Clean up after ourselves: the suite shares ONE seeded database and the
     journeys drag specific cards by position, so a spec that leaves extra rows
     on the B-Systems board silently breaks whichever one runs next. */
  const lastSegment = (href: string | null) => href!.split("/").filter(Boolean).pop()!;
  const enteredLeadId = lastSegment(await entered.getAttribute("href"));
  await adminPage.goto("/b-systems/partners-pipeline");
  const enteredCardId = lastSegment(
    /* the NAME link specifically — the card also carries Call/WhatsApp links */
    await adminPage
      .locator('[data-deal-card="Rania Saad"]')
      .getByRole("link", { name: "Rania Saad" })
      .getAttribute("href"),
  );
  for (const url of [
    `/api/b-systems/leads/${enteredLeadId}`,
    `/api/b-systems/leads/${adminLead.id}`,
    `/api/b-systems/partners-pipeline/${enteredCardId}`,
    `/api/b-systems/partners-pipeline/${myCard.id}`,
  ]) {
    expect((await adminPage.request.delete(url)).ok(), url).toBe(true);
  }
  await adminCtx.close();
});
