import { expect, test } from "@playwright/test";

/* Founder (filters round 2): the Leads controls live in a sidebar and lead with
   ONE search box — name, company, or number, matched server-side. This covers
   the partial-number path (with a space in the query), the "no matches" empty
   state, the Clear filters reset, and the 390px disclosure. */

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
  await page.getByLabel("Search").fill("010 7776");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/q=010\+7776/);
  await expect(page.locator("table.table tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Sidebar Search Lead" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Delta Fresh Foods" })).toHaveCount(0);

  /* A query that matches nothing says so plainly. */
  await page.getByLabel("Search").fill("zzqqx");
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
  await page.getByLabel("Search").fill("للأغذية");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("table.table tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "دلتا للأغذية" })).toBeVisible();
  expect((await page.request.delete(`/api/b-systems/leads/${arabicId}`)).ok()).toBe(true);

  /* 390px: the sidebar collapses behind the Filters disclosure. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems/leads?q=Findable");
  await expect(page.getByLabel("Search")).toBeHidden();
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByLabel("Search")).toHaveValue("Findable");
  await expect(page.getByRole("link", { name: "Sidebar Search Lead" })).toBeVisible();

  /* Leave the shared e2e database as we found it. */
  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});
