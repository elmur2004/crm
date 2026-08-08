import { expect, test, type Locator, type Page } from "@playwright/test";

/* SPEC §13 journey 5 — Portal admin cycle:
   log in → combined and per-rep CRM views → move deal to Won → WonDeal
   auto-created → set Estimated value, commission, 3 milestones → rep sees
   Milestone 1 only, 2 & 3 locked → admin checks 1 → rep sees Milestone 2 →
   Sales Team table and admin dashboard numbers correct.
   Self-contained: the rep + deal are created inside this journey (two live browser
   sessions — the Phase 4 DoD's lock/unlock across sessions). Dashboard tiles are
   asserted as deltas so the journey is order-independent. */

async function dragTo(page: Page, card: Locator, column: Locator) {
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height - 8);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height + 4, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 14 });
  await page.mouse.up();
}

async function tileNumber(page: Page, label: string): Promise<number> {
  const text = await page.getByText(label).locator("..").locator("p").nth(1).textContent();
  return Number((text ?? "0").replace(/[^\d.]/g, "") || "0");
}

test("journey 5: admin runs the Won pipeline; milestone locks update live for the rep", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const repContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const rep = await repContext.newPage();

  /* Admin session first: email login (ADR-016) and dashboard BASELINE before the
     journey's own data exists — the final assertions are deltas. */
  await admin.goto("/portal/login");
  await admin.getByLabel("Phone number").fill("admin@b-systems.example");
  await admin.getByLabel("Password").fill("admin123");
  await admin.getByRole("button", { name: "Log in" }).click();
  await expect(admin).toHaveURL(/\/portal\/admin$/);
  const leadsBefore = await tileNumber(admin, "Total leads");
  const estimatedBefore = await tileNumber(admin, "Total estimated value");
  const wonBefore = await tileNumber(admin, "Won deals");
  const commissionsBefore = await tileNumber(admin, "Total commissions");

  /* Rep session: sign up (lands in the portal, ADR-025) and create the deal. */
  await rep.goto("/portal/signup");
  await rep.getByLabel("First name").fill("Farah");
  await rep.getByLabel("Last name").fill("Journey");
  await rep.getByLabel("Phone number").fill("01515151515");
  await rep.getByLabel("Address").fill("9 Test Ave, Giza");
  await rep.getByLabel("Speciality").fill("Field sales");
  await rep
    .locator('input[type="file"]')
    .setInputFiles({
      name: "farah-cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([Buffer.from("%PDF-1.7 j5"), Buffer.alloc(512, 6)]),
    });
  await rep.getByLabel("Password", { exact: true }).fill("farah12345");
  await rep.getByLabel("Confirm password").fill("farah12345");
  await rep.getByRole("button", { name: "Sign up" }).click();
  await expect(rep).toHaveURL(/\/portal\/crm$/);

  await rep.getByRole("button", { name: "Add deal" }).click();
  await rep.getByLabel("Name", { exact: true }).fill("Milestone Deal");
  await rep.getByLabel("Position").fill("Founder");
  await rep.getByLabel("Number", { exact: true }).fill("0109990000");
  await rep.getByLabel("Company name").fill("Milestone Co");
  await rep.getByLabel("Industry").fill("Fintech");
  await rep.getByRole("button", { name: "Save deal" }).click();
  await expect(rep.getByText("Milestone Deal")).toBeVisible();

  /* Combined CRM shows the rep-labeled card; per-rep view filters. */
  await admin.goto("/portal/admin/crm");
  await expect(admin.getByText("Milestone Deal")).toBeVisible();
  await expect(admin.getByText("Farah Journey").first()).toBeVisible();
  await admin.getByRole("link", { name: "Farah Journey" }).click();
  await expect(admin.getByText("Milestone Deal")).toBeVisible();
  await admin.getByRole("link", { name: "All reps combined" }).click();

  /* Admin moves the deal to Won by drag (P-6). */
  await dragTo(
    admin,
    admin.locator('[data-deal-card="Milestone Deal"]'),
    admin.locator('[data-stage="won"]'),
  );
  await expect(admin.locator('[data-stage="won"]').getByText("Milestone Deal")).toBeVisible();

  /* Won Deals management: values + 3 milestones (P-7) — scoped to THIS deal's
     manager card (the seed ships another won deal). */
  await admin.goto("/portal/admin/won-deals");
  const manager = admin.locator('[data-won-deal="Milestone Deal"]');
  await expect(manager).toBeVisible();
  await manager.getByLabel("Estimated value (EGP)").fill("10000");
  await manager.getByLabel("Total commission (EGP)").fill("1000");
  await manager.getByRole("button", { name: "Save values" }).click();
  await expect(manager.getByLabel("Number of milestones")).toHaveValue("3");
  await manager.getByLabel("Milestone 1 value (EGP)").fill("4000");
  await manager.getByLabel("Milestone 2 value (EGP)").fill("3500");
  await manager.getByLabel("Milestone 3 value (EGP)").fill("2500");
  await manager.getByRole("button", { name: "Save milestones" }).click();
  await expect(manager.getByLabel("Milestone 1", { exact: true })).toBeVisible();

  /* Rep's OPEN Won Deals page: M1 visible, M2/M3 locked with values absent. */
  await rep.goto("/portal/won-deals");
  await expect(rep.getByText("Milestone Deal")).toBeVisible();
  await expect(rep.getByText("EGP 4,000")).toBeVisible();
  await expect(rep.getByText("EGP 3,500")).toHaveCount(0); // redacted server-side
  await expect(rep.getByText("EGP 2,500")).toHaveCount(0);

  /* Admin checks Milestone 1 (P-8) — controlled input: click, then await the
     round-tripped state. The rep's page unlocks M2 live (≤5s poll). */
  await manager.getByLabel("Milestone 1", { exact: true }).click();
  await expect(manager.getByLabel("Milestone 1", { exact: true })).toBeChecked({
    timeout: 10_000,
  });
  await expect(rep.getByText("EGP 3,500")).toBeVisible({ timeout: 15_000 });
  await expect(rep.getByText("EGP 2,500")).toHaveCount(0); // M3 still locked

  /* Sales Team row for this rep (§8.5.4) — absolute per-row numbers. */
  await admin.goto("/portal/admin/sales-team");
  const row = admin.getByRole("row", { name: /Farah Journey/ });
  await expect(row.getByText("EGP 10,000")).toBeVisible();
  await expect(row.getByText("EGP 1,000", { exact: true })).toBeVisible();

  /* Dashboard deltas (§8.5.1). */
  await admin.goto("/portal/admin");
  expect(await tileNumber(admin, "Total leads")).toBe(leadsBefore + 1);
  expect(await tileNumber(admin, "Total estimated value")).toBe(estimatedBefore + 10_000);
  expect(await tileNumber(admin, "Won deals")).toBe(wonBefore + 1);
  expect(await tileNumber(admin, "Total commissions")).toBe(commissionsBefore + 1_000);

  await adminContext.close();
  await repContext.close();
});
