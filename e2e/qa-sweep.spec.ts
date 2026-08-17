import { expect, test, type Page } from "@playwright/test";

/* §15 Global DoD sweep, V2 edition: no console errors; no horizontal overflow at
   1440 / 1024 / 768 / 390 px on every major screen, per role. */

const VIEWPORTS = [1440, 1024, 768, 560, 390];

function collectErrors(page: Page, sink: string[]) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("favicon")) return; // ByteForce mark not yet supplied (A-13)
    sink.push(text);
  });
  page.on("pageerror", (err) => sink.push(String(err)));
}

async function sweep(page: Page, errors: string[], paths: string[]) {
  for (const path of paths) {
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows horizontally at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
}

test("ByteForce screens: clean console, no horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/byteforce$/);
  await sweep(page, errors, ["/byteforce", "/byteforce/leads", "/byteforce/crm", "/byteforce/clients"]);
  expect(errors).toEqual([]);
});

test("B-Systems admin: all ten sections clean at every width", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
  await sweep(page, errors, [
    "/b-systems",
    "/b-systems/leads",
    "/b-systems/crm",
    "/b-systems/won-leads",
    "/b-systems/partners-pipeline",
    "/b-systems/partners",
    "/b-systems/agents",
    "/b-systems/registrations",
    "/b-systems/statements",
    "/b-systems/users",
  ]);
  expect(errors).toEqual([]);
});

test("B-Systems internal sales: CRM + Won Leads clean", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("omar@b-systems.example");
  await page.getByLabel("Password").fill("bsystems123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems\/crm$/);
  await sweep(page, errors, ["/b-systems/crm", "/b-systems/won-leads"]);
  expect(errors).toEqual([]);
});

test("mobile menu reaches EVERY admin section at 390px (incl. switcher + logout)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems");
  await page.getByRole("button", { name: "Open menu" }).click();
  for (const label of [
    "Home",
    "Leads",
    "CRM",
    "Won Leads",
    "Partners & Agents",
    "Partners",
    "Agents",
    "Registrations",
    "Statements",
    "Users",
  ]) {
    await expect(page.getByRole("menu").getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("menu").getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(page.getByRole("menu").getByRole("group", { name: "Switch company" })).toBeVisible();
  await page.getByRole("menu").getByRole("link", { name: "Statements", exact: true }).click();
  await page.waitForURL(/\/b-systems\/statements$/);
});

test("B-Systems agent + public screens: clean console, no horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await sweep(page, errors, ["/", "/login", "/portal", "/portal/signup"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("01001234567");
  await page.getByLabel("Password").fill("partner123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems\/crm$/);
  await sweep(page, errors, [
    "/b-systems/crm",
    "/b-systems/won-leads",
    "/b-systems/payments",
    "/b-systems/profile",
  ]);
  expect(errors).toEqual([]);
});
