import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-070 — the Data Vault's LINKS section, end to end.

   Founder: "I want a section for saving the important, repeated links we keep
   needing to find again — a portfolio, a content calendar, a video used over
   and over, a Google Drive folder or Sheet, a document, an image, a website, a
   reference… so the Vault is not only a place for Sheets, Forms and Archive,
   but also a central place to keep any important or repeated resources and
   links we use constantly, instead of hunting for them every time."

   The whole loop, through the real UI: add one with a SUGGESTED category, add
   one with a category he TYPED himself, open it in a new tab, edit it, archive
   it and find it in the Archive, filter fifty down to one — and an admin
   blocked from the Data Vault (ADR-066) reaching none of it.
   ========================================================================== */

const PORTFOLIO = "ADR-070 ByteForce Portfolio";
const VIDEO = "ADR-070 Client Onboarding Video";
const BLOCKED_EMAIL = "linksnovault@b-systems.example";
const BLOCKED_PASSWORD = "links12345";

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const loginAsFounder = (page: Page) =>
  login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

/** Fill the Add/Edit link modal and save. */
async function fillLink(
  page: Page,
  fields: { name: string; url: string; company: string; type: string; category: string },
) {
  const modal = page.locator(".modal");
  await modal.getByLabel("Name").fill(fields.name);
  await modal.getByLabel("URL").fill(fields.url);
  await modal.getByLabel("Company").selectOption({ label: fields.company });
  /* by role + an anchored name: the Category field's own hint contains the word
     "type", so a substring getByLabel("Type") matches both boxes */
  await modal.getByRole("combobox", { name: /^Type/ }).selectOption({ label: fields.type });
  await modal.getByLabel("Category").fill(fields.category);
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
}

test.describe.configure({ mode: "serial" });

test("the section exists, is empty, and offers his eight categories as suggestions", async ({
  page,
}) => {
  await loginAsFounder(page);

  /* it is reachable from the module's own nav, beside Forms */
  await page.goto("/vault");
  await page.getByRole("link", { name: "Links", exact: true }).click();
  await page.waitForURL(/\/vault\/links/);
  await expect(page.getByRole("heading", { name: "Links" })).toBeVisible();

  /* the empty state invites the first one, in his own examples */
  await expect(
    page.getByText("No links yet. Save the first one — a portfolio, a calendar, a folder."),
  ).toBeVisible();

  /* the suggestions are the native datalist idiom: eight offered, and the box
     still takes anything he types (proved by the next test) */
  await page.getByRole("button", { name: "+ Add link" }).click();
  const options = page.locator("#vault-link-categories option");
  await expect(options).toHaveCount(8);
  await expect(options.nth(0)).toHaveAttribute("value", "Portfolio");
  await expect(options.nth(1)).toHaveAttribute("value", "Content Calendar");
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("a link with a SUGGESTED category reads back as his row: name, company, category, type, open", async ({
  page,
}) => {
  await loginAsFounder(page);
  await page.goto("/vault/links");
  const origin = new URL(page.url()).origin;

  await page.getByRole("button", { name: "+ Add link" }).click();
  await fillLink(page, {
    name: PORTFOLIO,
    /* the app's own origin, so "open it" is a real navigation this suite can
       follow rather than a request to the internet */
    url: `${origin}/login`,
    company: "ByteForce",
    type: "Website",
    category: "Portfolio",
  });

  const row = page.locator("tr", { hasText: PORTFOLIO });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("ByteForce", { exact: true })).toBeVisible();
  await expect(row.getByText("Portfolio", { exact: true })).toBeVisible();
  await expect(row.getByText("Website", { exact: true })).toBeVisible();
  await expect(row.getByRole("link", { name: /Open/ })).toBeVisible();

  /* WHERE IT POINTS, before he presses it */
  await expect(row.getByText(new URL(origin).host)).toBeVisible();
});

test("a category he TYPES himself is kept as his words, and joins the filter", async ({
  page,
}) => {
  await loginAsFounder(page);
  await page.goto("/vault/links");

  await page.getByRole("button", { name: "+ Add link" }).click();
  await fillLink(page, {
    name: VIDEO,
    url: "https://video.example/adr070-onboarding",
    company: "B-Systems",
    type: "Video",
    category: "Investor Deck Q4", // none of the eight
  });

  const row = page.locator("tr", { hasText: VIDEO });
  await expect(row.getByText("Investor Deck Q4", { exact: true })).toBeVisible();
  await expect(row.getByText("video.example")).toBeVisible();

  /* his category is now offered back in the filter — in HIS spelling, never
     translated (it is his word, not ours) */
  await expect(
    page.locator('select[name="category"] option', { hasText: "Investor Deck Q4" }),
  ).toHaveCount(1);

  /* and the datalist offers it too, on top of our eight */
  await page.getByRole("button", { name: "+ Add link" }).click();
  await expect(page.locator("#vault-link-categories option")).toHaveCount(9);
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("the filters cut the list down — by company, by category, by type, by search", async ({
  page,
}) => {
  await loginAsFounder(page);
  await page.goto("/vault/links");
  await expect(page.locator("tbody tr")).toHaveCount(2);

  const apply = async (field: string, label: string) => {
    await page.goto("/vault/links");
    await page.getByRole("combobox", { name: new RegExp(`^${field}`) }).selectOption({ label });
    await page.getByRole("button", { name: "Apply" }).click();
  };

  await apply("Company", "B-Systems");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(VIDEO);

  await apply("Type", "Website");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(PORTFOLIO);

  await apply("Category", "Investor Deck Q4");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(VIDEO);

  /* the search box reaches the name, the category and the address */
  await page.goto("/vault/links?q=video.example");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(VIDEO);

  /* a filter that matches nothing says so, and does not pretend the vault is
     empty */
  await page.goto("/vault/links?q=nothing-matches-this");
  await expect(page.getByText("No links match these filters.")).toBeVisible();
  await page.getByRole("link", { name: "Clear" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);

  /* a category filter that is no longer on file — archive the last link in a
     category and the query still carries it — keeps SHOWING what it is doing.
     It must never read "All" over an empty list with no visible reason. */
  await page.goto("/vault/links?category=Retired+Category");
  await expect(page.locator('select[name="category"]')).toHaveValue("Retired Category");
  await expect(page.getByText("No links match these filters.")).toBeVisible();

  /* and a `%` is a category, not a wildcard: an exact filter matches exactly */
  await page.goto("/vault/links?category=%25");
  await expect(page.getByText("No links match these filters.")).toBeVisible();
});

test("he opens it straight from the Vault — a NEW tab that cannot reach back", async ({
  page,
}) => {
  await loginAsFounder(page);
  await page.goto("/vault/links");
  const row = page.locator("tr", { hasText: PORTFOLIO });
  const open = row.getByRole("link", { name: /Open/ });

  /* the safety contract on every rendered link */
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", "noopener noreferrer");

  const [opened] = await Promise.all([page.context().waitForEvent("page"), open.click()]);
  await opened.waitForLoadState("domcontentloaded");
  expect(opened.url()).toContain("/login");
  /* the vault is still there behind it */
  await expect(page.locator("tr", { hasText: PORTFOLIO })).toBeVisible();
  await opened.close();
});

test("he edits it, and a re-typed category does not split into two", async ({ page }) => {
  await loginAsFounder(page);
  await page.goto("/vault/links");
  const row = page.locator("tr", { hasText: PORTFOLIO });
  await row.getByRole("button", { name: "Edit" }).click();

  const modal = page.locator(".modal");
  await expect(modal.getByLabel("Category")).toHaveValue("Portfolio");
  await modal.getByLabel("Name").fill(`${PORTFOLIO} 2026`);
  await modal.getByLabel("Category").fill("portfolio"); // his shift key, not a new category
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();

  const renamed = page.locator("tr", { hasText: `${PORTFOLIO} 2026` });
  await expect(renamed).toHaveCount(1);
  await expect(renamed.getByText("Portfolio", { exact: true })).toBeVisible();
  /* one category, not two spellings of one */
  await expect(
    page.locator('select[name="category"] option', { hasText: /^Portfolio$/ }),
  ).toHaveCount(1);
});

test("removing it is the vault's ARCHIVE — it leaves the list and rests in the Archive", async ({
  page,
}) => {
  await loginAsFounder(page);
  await page.goto("/vault/links");
  const row = page.locator("tr", { hasText: VIDEO });

  await row.getByRole("button", { name: "Archive" }).first().click();
  await row.getByRole("button", { name: "Archive" }).last().click();
  await expect(page.locator("tr", { hasText: VIDEO })).toHaveCount(0);

  /* it is in the Archive, under its own Links heading, restorable in one click */
  await page.goto("/vault/archive");
  await expect(page.getByRole("heading", { name: /Links/ })).toBeVisible();
  const archived = page.locator("tr", { hasText: VIDEO });
  await expect(archived.getByText("Archived", { exact: true })).toBeVisible();
  await archived.getByRole("button", { name: "Unarchive" }).click();
  await expect(page.locator("tr", { hasText: VIDEO })).toHaveCount(0);

  /* and back it comes, whole */
  await page.goto("/vault/links");
  const back = page.locator("tr", { hasText: VIDEO });
  await expect(back).toHaveCount(1);
  await expect(back.getByText("Investor Deck Q4", { exact: true })).toBeVisible();
});

test("Arabic: the section speaks Arabic and RTL, and his own category does not", async ({
  page,
}) => {
  await loginAsFounder(page);
  await page.goto("/vault/links");
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await expect(page.getByRole("heading", { name: "الروابط" })).toBeVisible();
  /* the visible words, and an accessible name that BEGINS with them (so voice
     input reaches it by what he can see — WCAG 2.5.3) and then says which link */
  await expect(page.getByText("فتح الرابط").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^فتح الرابط — .+ \(تبويب جديد\)$/ }).first(),
  ).toBeVisible();
  /* OUR vocabulary is translated… */
  await expect(page.locator("tbody").getByText("فيديو", { exact: true })).toBeVisible();
  /* …HIS is not. A stored category is his words, printed verbatim in both
     languages (ADR-070 §4). */
  await expect(page.locator("tbody").getByText("Investor Deck Q4", { exact: true })).toBeVisible();
  /* including in the filter he uses to find it again */
  await expect(
    page.locator('select[name="category"] option', { hasText: "Investor Deck Q4" }),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("an admin blocked from the Data Vault reaches neither the page nor the API", async ({
  page,
}) => {
  await loginAsFounder(page);

  /* make him through the real Add-user form, with the Data Vault withheld */
  await page.goto("/b-systems/users");
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Name").fill("Links NoVault");
  await page.getByLabel("Email").fill(BLOCKED_EMAIL);
  await page.getByLabel("Password (min 8)").fill(BLOCKED_PASSWORD);
  await page.getByRole("checkbox", { name: "B-Systems admin" }).check();
  await page
    .getByRole("group", { name: "Modules" })
    .getByRole("checkbox", { name: "Data Vault" })
    .uncheck();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("row", { name: /Links NoVault/ })).toBeVisible();

  await login(page, BLOCKED_EMAIL, BLOCKED_PASSWORD, /\/b-systems$/);

  /* the PAGE refuses him by name, and does not leak the section into his nav */
  await page.goto("/vault/links");
  await page.waitForURL(/\/no-access\?module=vault/);
  await expect(
    page.getByRole("heading", { name: "The Data Vault is not open to your account" }),
  ).toBeVisible();

  /* the API is the real wall — all three doors, and it says which module */
  for (const [method, url] of [
    ["POST", "/api/vault/links"],
    ["PATCH", "/api/vault/links/whatever"],
    ["POST", "/api/vault/links/whatever/archive"],
  ] as Array<[string, string]>) {
    const res = await page.request.fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      data: "{}",
    });
    expect(res.status(), `${method} ${url}`).toBe(403);
    expect(JSON.stringify(await res.json())).toContain("Data Vault");
  }
});
