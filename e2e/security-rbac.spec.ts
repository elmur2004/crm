import { expect, test, type Page } from "@playwright/test";

/* §15 Global DoD security proofs at the API level, V2 edition:
   - agents cannot touch admin surfaces (milestones, statements, users, documents)
   - an agent cannot mutate another agent's lead
   - internal sales cannot touch agent-owned leads (bucket rule) nor admin APIs
   - brands stay partitioned; role walls hold on pages and APIs alike */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

test("agents cannot touch admin surfaces (server-side 403)", async ({ page }) => {
  await login(page, "01001234567", "partner123", /\/b-systems\/crm$/); // seeded agent Karim

  /* Guards fire before id resolution — any id proves the wall. */
  const milestone = await page.request.patch("/api/b-systems/milestones/any-id", {
    data: { completed: true },
  });
  expect(milestone.status()).toBe(403);

  const statement = await page.request.post("/api/b-systems/statements", {
    data: { milestoneId: "any-id" },
  });
  expect(statement.status()).toBe(403);

  const users = await page.request.post("/api/b-systems/users", {
    data: { name: "x", email: "x@x.example", password: "12345678", roles: ["bsystems_admin"] },
  });
  expect(users.status()).toBe(403);

  const deactivate = await page.request.patch("/api/b-systems/users/any-id", {
    data: { active: false },
  });
  expect(deactivate.status()).toBe(403);

  /* founder (ADR-049): permanent user deletion is admin-only, same wall as
     every other Users action — the guard fires before the id is resolved. */
  const hardDelete = await page.request.delete("/api/b-systems/users/any-id");
  expect(hardDelete.status()).toBe(403);

  const documents = await page.request.post("/api/b-systems/won-leads/any-id/documents", {
    multipart: { kind: "contract", file: { name: "c.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") } },
  });
  expect(documents.status()).toBe(403);

  const prospects = await page.request.post("/api/b-systems/partners-pipeline", {
    data: { name: "x", companyName: "x", number: "1", businessActivity: "x" },
  });
  expect(prospects.status()).toBe(403);

  /* founder (assignment): handing a lead to someone is a MANAGEMENT act —
     an agent can neither push their own lead onto a colleague nor pull one
     to themselves, even on a lead they own. */
  const assign = await page.request.post("/api/b-systems/leads/any-id/assign", {
    data: { userId: "any-user" },
  });
  expect(assign.status()).toBe(403);
});

test("an agent cannot mutate another agent's lead (403, nothing changes)", async ({ browser }) => {
  /* Agent B signs up via the public API. */
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.goto("/portal/signup");
  const signup = await pageB.request.post("/api/b-systems/signup", {
    multipart: {
      firstName: "Isolated",
      lastName: "Agent",
      phone: "01717171717",
      email: "isolated@agents.example",
      address: "1 Far St",
      speciality: "Sales",
      password: "isolated123",
      confirmPassword: "isolated123",
      cv: {
        name: "cv.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.concat([Buffer.from("%PDF-1.7 sec"), Buffer.alloc(256, 7)]),
      },
    },
  });
  expect(signup.status()).toBe(201);
  const { userId: pendingId } = (await signup.json()) as { userId: string };

  /* founder V3: signups are pending — the admin approves before B can sign in */
  const approver = await browser.newContext();
  const approverPage = await approver.newPage();
  await login(approverPage, "admin@byteforce.com", "password123", /\/b-systems$/);
  const approved = await approverPage.request.patch(`/api/b-systems/registrations/${pendingId}`, {
    data: { action: "approve" },
  });
  expect(approved.ok()).toBeTruthy();
  await approver.close();

  await login(pageB, "01717171717", "isolated123", /\/b-systems\/crm$/);

  /* Agent A (seeded Karim) owns "Follow-up Deal" — find its id on A's own board. */
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "01001234567", "partner123", /\/b-systems\/crm$/);
  const href = await pageA
    .getByRole("link", { name: "Follow-up Deal" })
    .getAttribute("href");
  const leadId = href!.split("/").pop()!;

  /* Agent B attacks A's lead: field edit + stage event + ready-flag all rejected. */
  const patch = await pageB.request.patch(`/api/b-systems/leads/${leadId}`, {
    data: { name: "Hijacked" },
  });
  expect(patch.status()).toBe(403);
  const event = await pageB.request.post(`/api/b-systems/leads/${leadId}/event`, {
    data: { event: { type: "drag", to: "lost" } },
  });
  expect(event.status()).toBe(403);
  const ready = await pageB.request.post(`/api/b-systems/leads/${leadId}/ready`);
  expect(ready.status()).toBe(403);
  const noAnswer = await pageB.request.post(`/api/b-systems/leads/${leadId}/no-answer`, {
    data: { value: true },
  });
  expect(noAnswer.status()).toBe(403);
  const archive = await pageB.request.post(`/api/b-systems/leads/${leadId}/archive`, {
    data: { value: true },
  });
  expect(archive.status()).toBe(403);
  /* founder V5: nor read or write A's lead CHAT. */
  const comment = await pageB.request.post(`/api/b-systems/leads/${leadId}/comments`, {
    data: { body: "sneaky @Elmur" },
  });
  expect(comment.status()).toBe(403);
  /* B cannot even VIEW A's lead. */
  await pageB.goto(`/b-systems/crm/lead/${leadId}`);
  await expect(pageB.getByText(/could not be found|404/i).first()).toBeVisible();

  /* A's lead is untouched. */
  await pageA.reload();
  await expect(pageA.getByRole("link", { name: "Follow-up Deal" })).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("internal sales: internal bucket only, no admin APIs; brands stay partitioned", async ({
  browser,
}) => {
  /* Find an agent-owned lead id (Karim's own board). */
  const agent = await browser.newContext();
  const agentPage = await agent.newPage();
  await login(agentPage, "01001234567", "partner123", /\/b-systems\/crm$/);
  const href = await agentPage
    .getByRole("link", { name: "Follow-up Deal" })
    .getAttribute("href");
  const agentLeadId = href!.split("/").pop()!;

  /* Internal sales (omar): agent-bucket lead mutations are rejected. */
  const sales = await browser.newContext();
  const salesPage = await sales.newPage();
  await login(salesPage, "omar@b-systems.example", "bsystems123", /\/b-systems\/crm$/);
  const crossBucket = await salesPage.request.patch(`/api/b-systems/leads/${agentLeadId}`, {
    data: { name: "Poached" },
  });
  expect(crossBucket.status()).toBe(403);
  const adminApi = await salesPage.request.patch("/api/b-systems/users/any-id", {
    data: { active: false },
  });
  expect(adminApi.status()).toBe(403);
  const partnersApi = await salesPage.request.post("/api/b-systems/partners-pipeline", {
    data: { name: "x", companyName: "x", number: "1", businessActivity: "x" },
  });
  expect(partnersApi.status()).toBe(403); // V2: Partners & Agents is admin-only

  /* Agents cannot reach ByteForce (page redirect + API 403). */
  await agentPage.goto("/byteforce");
  await expect(agentPage).toHaveURL(/\/login/);
  const bfApi = await agentPage.request.post("/api/byteforce/reps", { data: { name: "x" } });
  expect(bfApi.status()).toBe(403);

  /* ByteForce staff cannot reach B-Systems (page redirect + API 403). */
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await login(staffPage, "sara@byteforce.example", "byteforce123", /\/byteforce$/);
  await staffPage.goto("/b-systems");
  await expect(staffPage).toHaveURL(/\/login/);
  const crossBrand = await staffPage.request.post("/api/b-systems/leads", {
    data: { name: "x", number: "1", type: "cold_call" },
  });
  expect(crossBrand.status()).toBe(403);

  await agent.close();
  await sales.close();
  await staff.close();
});
