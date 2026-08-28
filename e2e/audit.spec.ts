import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/* Visual responsiveness audit (opt-in: AUDIT=1). Screenshots every role's
   pages at key widths into .audit/ for human review. Not an assertion suite —
   qa-sweep enforces; this one shows. */

const RUN = Boolean(process.env.AUDIT);
const WIDTHS = [320, 390, 560, 768, 1024];
const DIR = ".audit";

async function shoot(page: Page, name: string, path: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400); // settle animations
    await page.screenshot({ path: `${DIR}/${name}-${width}.png`, fullPage: true });
  }
}

async function login(page: Page, id: string, pw: string, landing: RegExp) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(id);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

test.skip(!RUN, "audit is opt-in (AUDIT=1)");

test("audit: admin pages", async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await shoot(page, "admin-home", "/b-systems");
  await shoot(page, "admin-leads", "/b-systems/leads");
  await shoot(page, "admin-crm", "/b-systems/crm");
  await shoot(page, "admin-won", "/b-systems/won-leads");
  await shoot(page, "admin-partnership", "/b-systems/partners-pipeline");
  await shoot(page, "admin-registrations", "/b-systems/registrations");
  await shoot(page, "admin-statements", "/b-systems/statements");
  await shoot(page, "admin-users", "/b-systems/users");
});

test("audit: agent + public + byteforce", async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  await shoot(page, "public-login", "/login");
  await shoot(page, "public-portal", "/portal");
  await shoot(page, "public-signup", "/portal/signup");
  await login(page, "01001234567", "partner123", /\/b-systems\/crm$/);
  await shoot(page, "agent-crm", "/b-systems/crm");
  await shoot(page, "agent-won", "/b-systems/won-leads");
  await shoot(page, "agent-profile", "/b-systems/profile");
  await page.goto("/login");
  await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);
  await shoot(page, "bf-home", "/b-systems?company=byteforce");
  await shoot(page, "bf-crm", "/b-systems/crm?company=byteforce");
});
