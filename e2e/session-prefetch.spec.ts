import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { LAUNCHER_URL } from "./helpers/after-sign-in";

/* BUG-027 — a background fetch must never write the session cookie.

   The proxy's auth wrapper re-issues the session cookie on every request (the
   sliding session). A prefetch carries the session it STARTED with, so one that
   landed after "Back to admin" (or a sign-out) wrote the old session back over
   the new one — the impersonation spec caught it once the launcher made it
   navigate after snapping back. These pin the contract directly, at the HTTP
   level, so the race needs no timing to reproduce.

   The proxy recognises a background fetch by the browser's `Sec-Fetch-Dest:
   empty` (Next strips its own router headers before the proxy runs), so these
   requests send exactly the headers a browser's prefetch sends. */

/* what Chromium sends with a router prefetch, and with a page load */
const PREFETCH = { "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors", RSC: "1", "Next-Router-Prefetch": "1" };
const DOCUMENT = { "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate" };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(LAUNCHER_URL);
}

const sessionCookies = (res: APIResponse) =>
  res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .filter((v) => /^(__Secure-)?authjs\.session-token(\.\d+)?=/.test(v));

test("a prefetch response carries no session cookie", async ({ page }) => {
  await signIn(page);
  const res = await page.request.get("/b-systems/crm?company=bsystems", {
    headers: PREFETCH,
    maxRedirects: 0,
  });
  expect(res.status()).toBeLessThan(400);
  expect(sessionCookies(res)).toEqual([]);
});

test("a real page load still refreshes the session (the sliding 24h stays)", async ({ page }) => {
  await signIn(page);
  const res = await page.request.get("/b-systems/crm?company=bsystems", {
    headers: DOCUMENT,
    maxRedirects: 0,
  });
  expect(res.status()).toBe(200);
  expect(sessionCookies(res)).toHaveLength(1);
});

test("a late prefetch cannot undo a sign-out", async ({ page, context }) => {
  await signIn(page);
  /* the cookie a prefetch would carry: the session from before the sign-out */
  const before = (await context.cookies()).find((c) => c.name.endsWith("authjs.session-token"));
  expect(before).toBeTruthy();
  await page.goto("/b-systems/crm?company=bsystems");
  await page.getByRole("button", { name: /log out|sign out/i }).first().click();
  await page.waitForURL(/\/login/);
  /* a prefetch that started before the sign-out and lands after it */
  const late = await page.request.get("/b-systems/todo?company=bsystems", {
    headers: { ...PREFETCH, Cookie: `${before!.name}=${before!.value}` },
    maxRedirects: 0,
  });
  expect(sessionCookies(late)).toEqual([]);
  await page.goto("/b-systems/crm?company=bsystems");
  await expect(page).toHaveURL(/\/login/);
});
