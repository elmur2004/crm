import { expect, test } from "@playwright/test";

/* Founder (filters round 2): the Leads controls live in a sidebar and lead with
   ONE search box — name, company, or number, matched server-side. This covers
   the partial-number path (with a space in the query), the "no matches" empty
   state, the Clear filters reset, and the 390px disclosure.
   getByLabel("Search", { exact: true }) is deliberate: creating a lead arms the
   ADR-045 undo pill, whose accessible name ("Undo: Added Sidebar Search Lead")
   would otherwise also match a substring locator. */

test("admin: search the Leads sidebar by a partial number, then clear the filters", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Sidebar Search Lead",
      number: "0107776001",
      type: "cold_call",
      companyName: "Findable Industries",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto("/b-systems/leads");
  await expect(page.getByRole("link", { name: "Sidebar Search Lead" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Delta Fresh Foods" })).toBeVisible();

  /* Partial number WITH a space — the query is matched digits-only too. */
  await page.getByLabel("Search", { exact: true }).fill("010 7776");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/q=010\+7776/);
  await expect(page.locator("table.table tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Sidebar Search Lead" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Delta Fresh Foods" })).toHaveCount(0);

  /* A query that matches nothing says so plainly. */
  await page.getByLabel("Search", { exact: true }).fill("zzqqx");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("No leads match these filters.")).toBeVisible();

  /* Clear filters returns the full list. */
  await page.getByRole("link", { name: "Clear filters" }).click();
  await page.waitForURL(/\/b-systems\/leads$/);
  await expect(page.getByRole("link", { name: "Delta Fresh Foods" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(0);

  /* Arabic goes in and comes back out (the platform is bilingual — the search
     box, and the database under it, must carry non-Latin text). */
  const arabic = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "دلتا للأغذية",
      number: "0107776002",
      type: "cold_call",
      companyName: "شركة النيل",
    },
  });
  expect(arabic.status()).toBe(201);
  const { id: arabicId } = (await arabic.json()) as { id: string };
  await page.goto("/b-systems/leads");
  await page.getByLabel("Search", { exact: true }).fill("للأغذية");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("table.table tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "دلتا للأغذية" })).toBeVisible();
  expect((await page.request.delete(`/api/b-systems/leads/${arabicId}`)).ok()).toBe(true);

  /* 390px: the sidebar collapses behind the Filters disclosure. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems/leads");
  await expect(page.getByLabel("Search", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByLabel("Search", { exact: true })).toBeVisible();

  /* ...but when something IS filtered it opens on its own, showing what is on. */
  await page.goto("/b-systems/leads?q=Findable");
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue("Findable");
  await expect(page.getByRole("link", { name: "Sidebar Search Lead" })).toBeVisible();

  /* Leave the shared e2e database as we found it. */
  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

/* Founder (filters round 3): the same search + filters on the CRM board — an
   inline disclosure above the full-bleed board, on both apps' boards. */
test("admin: search and filter the CRM board cards; ByteForce board filters too", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  await page.goto("/b-systems/crm");
  await expect(page.locator('[data-deal-card="Delta Fresh Foods"]')).toBeVisible();
  await expect(page.locator('[data-deal-card="Fresh Deal"]')).toBeVisible();

  /* The panel is a disclosure at EVERY width here (the board is full-bleed). */
  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByLabel("Search", { exact: true }).fill("Delta Fresh");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/q=Delta\+Fresh/);
  await expect(page.locator('[data-deal-card="Delta Fresh Foods"]')).toBeVisible();
  await expect(page.locator('[data-deal-card="Fresh Deal"]')).toHaveCount(0);

  /* With a filter on, the panel comes back open showing what is applied. */
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue("Delta Fresh");
  await page.getByRole("link", { name: "Clear filters" }).click();
  await page.waitForURL(/\/b-systems\/crm$/);
  await expect(page.locator('[data-deal-card="Fresh Deal"]')).toBeVisible();

  /* Type narrowing, and a dead query gets the board's own empty state. */
  await page.goto("/b-systems/crm?type=organic");
  await expect(page.getByText("No cards match these filters.")).toBeVisible();

  /* ByteForce board: Search + Type (no owner buckets there). */
  await page.goto("/b-systems/crm?company=byteforce&q=Cairo+Textiles");
  await expect(page.locator('[data-deal-card="Cairo Textiles"]')).toBeVisible();
  await expect(page.locator('[data-deal-card="Cairo Logistics"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await page.waitForURL(/\/b-systems\/crm\?company=byteforce$/);
  await expect(page.locator('[data-deal-card="Cairo Logistics"]')).toBeVisible();
});
