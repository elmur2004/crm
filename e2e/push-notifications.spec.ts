import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-065 — founder: "I want the website to sent actual notification so I
   installed the website as an app on my phone I want it to shoot me actual
   notifications."

   THE FIRST TEST IS THE ONE THAT MATTERS. This suite's server has no VAPID keys
   — which is EXACTLY what production is the moment this deploys, before the
   founder sets anything on the host. Everything must then behave precisely as
   it did before the feature existed: no control, no service worker installed at
   all, no error, a bell that works. That inert path is what actually ships.

   The second test drives the three honest states of the control by stubbing the
   key at the network edge, since no CI browser can hold a real push
   subscription.
   ========================================================================== */

const ADMIN = { id: "admin@byteforce.com", password: "password123" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(ADMIN.id);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/b-systems$/);
}

test("with NO keys configured the app is exactly what it was — and the worker is still served", async ({
  page,
  request,
}) => {
  /* ---- the service worker file is reachable, uncached, and really JS ---- */
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");
  /* a stale service worker at a CDN edge outlives the deploy that fixed it */
  expect(sw.headers()["cache-control"]).toContain("no-store");
  const swSource = await sw.text();
  expect(swSource).toContain('addEventListener("push"');
  expect(swSource).toContain('addEventListener("notificationclick"');
  /* it caches NOTHING: a fetch handler is how a deploy gets stranded */
  expect(swSource).not.toContain('addEventListener("fetch"');

  /* ---- the manifest (ADR-060) is untouched by this work ---- */
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect(((await manifest.json()) as { name: string }).name).toBe("B-Systems");

  /* ---- every push route refuses an anonymous caller ---- */
  for (const [method, url] of [
    ["get", "/api/push/public-key"],
    ["post", "/api/push/subscribe"],
    ["post", "/api/push/unsubscribe"],
  ] as const) {
    const res = await request[method](url, { data: {} });
    expect(res.status(), `${method} ${url}`).toBe(401);
  }

  await login(page);

  /* ---- signed in, the server honestly says "not configured" ---- */
  const keyRes = await page.request.get("/api/push/public-key");
  expect(keyRes.status()).toBe(200);
  expect(await keyRes.json()).toEqual({ key: null });

  /* ---- so the bell offers nothing new, and still works ---- */
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.locator(".bell-menu")).toBeVisible();
  await expect(page.locator(".bell-foot")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Turn on phone notifications" })).toHaveCount(0);

  /* ---- and NOTHING was installed on this device. The service worker is
     registered only when somebody presses the (absent) button, so with no keys
     the app has no worker at all — the strongest form of "unchanged". ---- */
  await page.goto("/b-systems/crm");
  await page.goto("/byteforce");
  const registrations = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return ["no-sw-api"];
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.map((r) => r.scope);
  });
  expect(registrations).toEqual([]);

  /* ---- no console error anywhere along that path ---- */
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/b-systems");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.locator(".bell-menu")).toBeVisible();
  expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
});

test("with a key configured the control tells the truth about this device", async ({ browser }) => {
  /* The key is stubbed at the network edge: no CI browser can hold a real push
     subscription, and no key material belongs in a test fixture. */
  const stubKey = async (page: Page) => {
    await page.route("**/api/push/public-key", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ key: "e2e-stub-public-key-not-a-real-vapid-key" }),
      }),
    );
  };
  const openBell = async (page: Page) => {
    await page.goto("/b-systems");
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await expect(page.locator(".bell-menu")).toBeVisible();
  };

  /* A browser that has never been ASKED reports permission "default". A fresh
     Playwright context reports "denied" instead (it pre-denies notifications),
     which is a different state of the world, so it is set explicitly rather
     than inherited from the harness. */
  const neverAsked = () =>
    Object.defineProperty(window.Notification, "permission", {
      configurable: true,
      get: () => "default",
    });

  /* ---- STATE 1: not enabled yet — a plain, pressable offer ---- */
  const fresh = await browser.newContext();
  await fresh.addInitScript(neverAsked);
  const page = await fresh.newPage();
  await stubKey(page);
  await login(page);
  await openBell(page);
  await expect(page.locator(".bell-foot")).toHaveAttribute("data-push-state", "off");
  await expect(page.getByRole("button", { name: "Turn on phone notifications" })).toBeVisible();

  /* ...and it says so in Arabic too */
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  await expect(page.getByRole("button", { name: "تفعيل إشعارات الهاتف" })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await fresh.close();

  /* ---- STATE 2: the browser is refusing. No button can undo that, so the
     control stops offering one and says where to go instead. ---- */
  const denied = await browser.newContext();
  await denied.addInitScript(() => {
    Object.defineProperty(window.Notification, "permission", {
      configurable: true,
      get: () => "denied",
    });
  });
  const deniedPage = await denied.newPage();
  await stubKey(deniedPage);
  await login(deniedPage);
  await openBell(deniedPage);
  await expect(deniedPage.locator(".bell-foot")).toHaveAttribute("data-push-state", "blocked");
  await expect(
    deniedPage.getByText(/Notifications are blocked for this site/),
  ).toBeVisible();
  await expect(
    deniedPage.getByRole("button", { name: "Turn on phone notifications" }),
  ).toHaveCount(0);
  await denied.close();

  /* ---- STATE 3: an iPhone that has NOT been added to the Home Screen. iOS
     delivers web push only to a home-screen install and exposes no PushManager
     in a tab — so the control names the one step that would fix it, rather than
     offering a button that could only ever fail. ---- */
  const iphone = await browser.newContext();
  await iphone.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    });
    try {
      // @ts-expect-error — modelling Safari-in-a-tab, which exposes none
      delete window.PushManager;
    } catch {
      /* some engines refuse; the assertion below then simply does not apply */
    }
  });
  const iphonePage = await iphone.newPage();
  await stubKey(iphonePage);
  await login(iphonePage);
  await openBell(iphonePage);
  await expect(iphonePage.locator(".bell-foot")).toHaveAttribute("data-push-state", "install");
  await expect(iphonePage.getByText(/add this app to your Home Screen first/)).toBeVisible();
  await expect(
    iphonePage.getByRole("button", { name: "Turn on phone notifications" }),
  ).toHaveCount(0);
  await iphone.close();
});
