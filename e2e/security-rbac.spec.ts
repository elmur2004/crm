import { expect, test, type Page } from "@playwright/test";

/* §15 Global DoD security proofs, at the API level (not UI):
   - reps cannot touch milestones or admin won-deal management (403)
   - reps cannot mutate another rep's deals (403)
   - internal apps are invisible to portal roles and vice versa
   - staff cannot cross brands through the partitioned API namespaces
   Runs after the journeys (alphabetical) but is self-sufficient via seeds. */

async function portalLogin(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/portal\/(crm|admin)/);
}

test("reps cannot touch milestones or admin management (server-side 403)", async ({ page }) => {
  await portalLogin(page, "01001234567", "partner123"); // seeded rep Karim

  /* Guard fires before id resolution — any id proves the wall. */
  const milestone = await page.request.patch("/api/portal/admin/milestones/any-id", {
    data: { completed: true },
  });
  expect(milestone.status()).toBe(403);

  const values = await page.request.patch("/api/portal/admin/won-deals/any-id", {
    data: { estimatedValue: 1 },
  });
  expect(values.status()).toBe(403);

  const define = await page.request.post("/api/portal/admin/won-deals/any-id/milestones", {
    data: { values: [1] },
  });
  expect(define.status()).toBe(403);
});

test("a rep cannot mutate another rep's deal (API 403/404, nothing changes)", async ({
  browser,
}) => {
  /* Rep B signs up via the public API. */
  const repB = await browser.newContext();
  const pageB = await repB.newPage();
  await pageB.goto("/portal/signup");
  const signup = await pageB.request.post("/api/portal/signup", {
    multipart: {
      firstName: "Isolated",
      lastName: "Rep",
      phone: "01717171717",
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
  await portalLogin(pageB, "01717171717", "isolated123");

  /* Rep A (seeded Karim) owns a seeded deal — find its id via A's own board. */
  const repA = await browser.newContext();
  const pageA = await repA.newPage();
  await portalLogin(pageA, "01001234567", "partner123");
  await pageA.goto("/portal/crm");
  const href = await pageA
    .locator('[data-stage="leads"] a[href^="/portal/crm/"]')
    .first()
    .getAttribute("href");
  const dealId = href!.split("/").pop()!;

  /* Rep B attacks A's deal: field edit + stage event both rejected. */
  const patch = await pageB.request.patch(`/api/portal/deals/${dealId}`, {
    data: { name: "Hijacked" },
  });
  expect(patch.status()).toBe(403);
  const event = await pageB.request.post(`/api/portal/deals/${dealId}/event`, {
    data: { event: { type: "drag", to: "lost" } },
  });
  expect(event.status()).toBe(403);

  /* A's deal is untouched. */
  await pageA.reload();
  await expect(pageA.locator(`a[href="/portal/crm/${dealId}"]`)).toBeVisible();

  await repA.close();
  await repB.close();
});

test("internal apps invisible to portal roles; portal invisible to staff; brands partitioned", async ({
  browser,
}) => {
  /* Portal rep cannot reach internal apps (redirected) nor their APIs (403). */
  const rep = await browser.newContext();
  const repPage = await rep.newPage();
  await portalLogin(repPage, "01001234567", "partner123");
  await repPage.goto("/byteforce");
  await expect(repPage).toHaveURL(/\/login/);
  const bfApi = await repPage.request.post("/api/byteforce/reps", { data: { name: "x" } });
  expect(bfApi.status()).toBe(403);

  /* ByteForce staff cannot reach B-Systems (page redirect + API 403) nor the portal APIs. */
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await staffPage.goto("/login");
  await staffPage.getByLabel("Email or phone").fill("sara@byteforce.example");
  await staffPage.getByLabel("Password").fill("byteforce123");
  await staffPage.getByRole("button", { name: "Sign in" }).click();
  await staffPage.waitForURL(/\/byteforce$/);

  await staffPage.goto("/b-systems");
  await expect(staffPage).toHaveURL(/\/login/);
  const crossBrand = await staffPage.request.post("/api/b-systems/leads", {
    data: { name: "x", number: "1", type: "cold_call" },
  });
  expect(crossBrand.status()).toBe(403);
  const portalApi = await staffPage.request.get("/api/portal/won-deals");
  expect(portalApi.status()).toBe(403);

  await rep.close();
  await staff.close();
});
