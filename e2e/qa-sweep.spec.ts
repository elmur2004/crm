import { expect, test, type Page } from "@playwright/test";

/* §15 Global DoD sweep: no console errors; no horizontal overflow at
   1440 / 1024 / 768 / 390 px on every major screen, per role. */

const VIEWPORTS = [1440, 1024, 768, 390];

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
  await page.goto("/byteforce/login");
  await page.getByLabel("Email").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/byteforce$/);
  await sweep(page, errors, ["/byteforce", "/byteforce/leads", "/byteforce/crm", "/byteforce/clients"]);
  expect(errors).toEqual([]);
});

test("B-Systems screens: clean console, no horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/b-systems/login");
  await page.getByLabel("Email").fill("omar@b-systems.example");
  await page.getByLabel("Password").fill("bsystems123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/b-systems$/);
  await sweep(page, errors, [
    "/b-systems",
    "/b-systems/leads",
    "/b-systems/crm",
    "/b-systems/clients",
    "/b-systems/partners-pipeline",
    "/b-systems/partners",
  ]);
  expect(errors).toEqual([]);
});

test("Portal rep + public screens: clean console, no horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await sweep(page, errors, ["/portal", "/portal/login", "/portal/signup"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/portal/login");
  await page.getByLabel("Phone number").fill("01001234567");
  await page.getByLabel("Password").fill("partner123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/portal\/crm/);
  await sweep(page, errors, ["/portal/crm", "/portal/won-deals", "/portal/profile"]);
  expect(errors).toEqual([]);
});

test("Portal admin screens: clean console, no horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/portal/login");
  await page.getByLabel("Phone number").fill("admin@b-systems.example");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/portal\/admin$/);
  await sweep(page, errors, [
    "/portal/admin",
    "/portal/admin/crm",
    "/portal/admin/won-deals",
    "/portal/admin/sales-team",
  ]);
  expect(errors).toEqual([]);
});
