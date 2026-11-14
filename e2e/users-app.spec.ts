import { expect, test, type Browser, type Page } from "@playwright/test";
import { afterSignIn, LAUNCHER_URL } from "./helpers/after-sign-in";

/* ============================================================================
   ADR-103 — the founder, 2026-11-14, verbatim:

     "the sales rep in byteforce or bsystems just sees the assigned leads for
      him … the admin has a click or option for each lead to assign it or to
      change the assignee of that lead … Also make sure that in the main page
      the welcome page there is a dedicated icon for the users … for the admin
      he of course can change all the users and all of that. If it's for a
      normal user, he can click on it to change his information too, so he can
      change his name, he can change his password and all of that."

   Every account here that gets EDITED is made by this file (through the
   admin's own Add-user API), so the seeded people the other journeys count on
   keep their names, passwords and leads.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

/** The admin's own session, for setup through the real admin API. */
async function adminPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  return page;
}

async function makeAccount(
  admin: Page,
  who: { name: string; email: string; password: string; roles: string[] },
): Promise<string> {
  const res = await admin.request.post("/api/b-systems/users", { data: who });
  expect(res.status(), `create ${who.email}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test("a sales rep opens Users from his launcher and changes his own name, phone and password", async ({
  browser,
  page,
}) => {
  const admin = await adminPage(browser);
  await makeAccount(admin, {
    name: "Mona Self",
    email: "mona.self@b-systems.example",
    password: "mona-pass-1",
    roles: ["bsystems_sales"],
  });

  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("mona.self@b-systems.example");
  await page.getByLabel("Password").fill("mona-pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(LAUNCHER_URL);
  await page.locator('[data-app="users"]').click();
  await page.waitForURL(/\/users$/);
  await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "All users" })).toHaveCount(0);

  /* his details */
  const name = page.getByLabel("Name", { exact: true });
  await expect(name).toHaveValue("Mona Self");
  await name.fill("Mona Selim");
  await page.getByLabel("Phone").fill("01012340099");
  await page.getByRole("button", { name: "Save changes" }).click();
  /* by its text: Next keeps a role="alert" route announcer on every page, so
     "the" alert or status alone is ambiguous */
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  /* the launcher's own bar greets the new name at once */
  await expect(page.locator(".lx-user")).toHaveText("Mona Selim");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Mona Selim");
  await expect(page.getByLabel("Phone")).toHaveValue("01012340099");

  /* a clash with somebody else's email is refused, in words */
  await page.getByLabel("Email").fill("omar@b-systems.example");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That email belongs to another account" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Email")).toHaveValue("mona.self@b-systems.example");

  /* his password: the current one first */
  await page.getByLabel("Current password").fill("wrong-one");
  await page.getByLabel("New password (min 8 characters)").fill("mona-pass-2");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Current password is wrong" })).toBeVisible();
  await page.getByLabel("Current password").fill("mona-pass-1");
  await page.getByLabel("New password (min 8 characters)").fill("mona-pass-2");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Password updated." })).toBeVisible();

  /* …and it is the password from now on — he signs in by his new phone too */
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel("Email or phone").fill("01012340099");
  await page.getByLabel("Password").fill("mona-pass-2");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(LAUNCHER_URL);

  /* the admin's All users shows the new name and — his standing rule — the new password */
  await admin.goto("/users");
  const row = admin.getByRole("row", { name: /Mona Selim/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("mona-pass-2")).toBeVisible();
  await admin.context().close();
});

test("an agent's My account is his profile — and Profile is no longer in his CRM menu", async ({ page }) => {
  await login(page, "01001234567", "partner123", /\/b-systems\/crm$/);
  /* no second way to it: the menu has no Profile */
  await expect(page.locator(".app-header").getByRole("link", { name: "Profile", exact: true })).toHaveCount(0);
  await page.goto("/apps");
  await page.locator('[data-app="users"]').click();
  await page.waitForURL(/\/users$/);
  await expect(page.getByLabel("First name")).toHaveValue("Karim");
  await expect(page.getByLabel("Last name")).toHaveValue("Adel");
  await expect(page.getByLabel("Address")).not.toHaveValue("");
  await expect(page.getByLabel("Speciality")).not.toHaveValue("");
  /* he signs in with his phone, so it is required */
  await expect(page.getByLabel("Phone")).toHaveAttribute("required", "");
  await expect(page.getByRole("heading", { name: "CV" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload new CV" })).toBeVisible();
  /* an agent's name is his first + last name — no separate Name box */
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
});

test("data entry has the Users tile too — beside its one CRM page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("entry@b-systems.example");
  await page.getByLabel("Password").fill("entry123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\/entry$/);
  await page.goto("/apps");
  expect(
    await page.locator("[data-app]").evaluateAll((els) => els.map((e) => e.getAttribute("data-app"))),
  ).toEqual(["crm-bsystems", "users"]);
  await page.locator('[data-app="users"]').click();
  await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Hala Nabil");
});

test("B-Systems: every row of the admin's Leads list has Assign owner — the rep then sees the lead", async ({
  browser,
}) => {
  const admin = await adminPage(browser);
  await makeAccount(admin, {
    name: "Row Assign Rep",
    email: "row.assign@b-systems.example",
    password: "row-assign-1",
    roles: ["bsystems_sales"],
  });
  const created = await admin.request.post("/api/b-systems/leads", {
    data: { name: "Row Assign Co", number: "0109993301", type: "cold_call", companyName: "Row Assign" },
  });
  expect(created.status()).toBe(201);

  const repCtx = await browser.newContext();
  const rep = await repCtx.newPage();
  await login(rep, "row.assign@b-systems.example", "row-assign-1", /\/b-systems\/crm$/);
  await expect(rep.locator('[data-deal-card="Row Assign Co"]')).toHaveCount(0);

  await admin.goto("/b-systems/leads?company=bsystems&q=Row+Assign+Co");
  const row = admin.getByRole("row", { name: /Row Assign Co/ });
  await row.getByRole("button", { name: "Assign owner" }).click();
  await admin.getByLabel("Responsible for this lead").selectOption({ label: "Row Assign Rep — Internal sales" });
  await admin.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(admin.getByRole("row", { name: /Row Assign Co/ })).toContainText("Row Assign Rep");

  await rep.goto("/b-systems/crm?company=bsystems");
  await expect(rep.locator('[data-deal-card="Row Assign Co"]')).toBeVisible();
  await repCtx.close();
  await admin.context().close();
});

test("ByteForce: the admin hands an Unassigned lead to a teammate from the list row — it leaves Unassigned", async ({
  browser,
}) => {
  const admin = await adminPage(browser);
  await makeAccount(admin, {
    name: "Row Assign Staff",
    email: "row.staff@byteforce.example",
    password: "row-staff-1",
    roles: ["byteforce_staff"],
  });
  const created = await admin.request.post("/api/byteforce/leads", {
    data: { name: "BF Row Assign Co", number: "0109993302", type: "cold_call" },
  });
  expect(created.status()).toBe(201);

  await admin.goto("/b-systems/leads/rep/unassigned?company=byteforce");
  const row = admin.getByRole("row", { name: /BF Row Assign Co/ });
  await row.getByRole("button", { name: "Assign owner" }).click();
  await admin.getByLabel("Responsible for this lead").selectOption({ label: "Row Assign Staff — ByteForce staff" });
  await admin.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(admin.getByRole("row", { name: /BF Row Assign Co/ })).toHaveCount(0);

  const staffCtx = await browser.newContext();
  const staff = await staffCtx.newPage();
  await login(staff, "row.staff@byteforce.example", "row-staff-1", /\/b-systems\/crm\?company=byteforce$/);
  await expect(staff.locator('[data-deal-card="BF Row Assign Co"]')).toBeVisible();
  /* a teammate's own list has no Assign column — that is the admin's */
  await staff.goto("/b-systems/leads?company=byteforce");
  await expect(staff.getByRole("button", { name: "Assign owner" })).toHaveCount(0);
  await staffCtx.close();
  await admin.context().close();
});
