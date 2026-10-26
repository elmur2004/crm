import { expect, test, type Browser, type Page } from "@playwright/test";
import { LAUNCHER_URL } from "./helpers/after-sign-in";

/* The founder, after asking for the launcher, the new Home and the glass
   sign-in: "after you finish everything do a complete round of testing to make
   sure everything works perfectly for a phone interface and a tablet interface
   also".

   qa-sweep.spec.ts already walks every screen at fixed widths in a desktop
   browser, English, light. This walks the screens he actually opens on REAL
   device profiles — mobile viewport, touch, device pixel ratio, a phone user
   agent — in both themes and both languages, and on each one demands: no
   sideways scroll, no console or page error, the page's heading on screen, and
   (on touch) no undersized tap target in the header. A screenshot of every
   stop is attached to the report. */

const DEVICES = [
  { name: "phone 390×844", width: 390, height: 844, scale: 3, mobile: true },
  { name: "small phone 360×740", width: 360, height: 740, scale: 3, mobile: true },
  /* a phone held sideways: the 601–820px band, where the header keeps its
     language and theme switches instead of moving them into the sheet */
  { name: "phone landscape 740×360", width: 740, height: 360, scale: 3, mobile: true },
  { name: "tablet portrait 768×1024", width: 768, height: 1024, scale: 2, mobile: true },
  { name: "tablet landscape 1024×768", width: 1024, height: 768, scale: 2, mobile: true },
] as const;

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const TABLET_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/* The founder's screens, in the order he moves through them — one app at a
   time from the launcher (one way to each page): each CRM opens on its board
   and its menu leads on; the dashboards and the daily report open from
   Reports & Dashboards; the To-Do is one page with company tabs; Partners &
   Agents has its own menu. */
const FOUNDER_PATHS = [
  "/apps",
  "/b-systems/crm?company=bsystems",
  "/b-systems/leads?company=bsystems",
  "/b-systems/calendar?company=bsystems",
  "/b-systems/crm?company=byteforce",
  "/b-systems/leads?company=byteforce",
  "/b-systems/partners-pipeline?company=bsystems",
  "/b-systems/partners?company=bsystems",
  "/b-systems/agents?company=bsystems",
  "/b-systems/todo?company=bsystems",
  "/b-systems/todo?company=byteforce",
  "/apps/reports",
  "/b-systems?company=bsystems",
  "/b-systems?company=byteforce",
  "/b-systems/daily-report?company=byteforce",
  "/accounting",
  "/vault",
];

async function deviceContext(
  browser: Browser,
  base: string,
  d: (typeof DEVICES)[number],
  theme: string,
  locale: string,
) {
  const context = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: d.scale,
    isMobile: d.mobile,
    hasTouch: true,
    userAgent: d.name.includes("phone") ? PHONE_UA : TABLET_UA,
  });
  await context.addCookies([
    { name: "theme", value: theme, url: base },
    { name: "locale", value: locale, url: base },
  ]);
  return context;
}

function collectErrors(page: Page, sink: string[]) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) sink.push(msg.text());
  });
  page.on("pageerror", (err) => sink.push(String(err)));
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="identifier"]').fill("admin@byteforce.com");
  await page.locator('input[name="password"]').fill("password123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(LAUNCHER_URL);
}

for (const d of DEVICES) {
  for (const [theme, locale] of [
    ["light", "en"],
    ["dark", "ar"],
  ] as const) {
    test(`${d.name} · ${theme} · ${locale}: every screen fits, renders and stays error-free`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(300_000);
      const base = testInfo.project.use.baseURL ?? "http://localhost:3100";
      const context = await deviceContext(browser, base, d, theme, locale);
      const page = await context.newPage();
      const errors: string[] = [];
      collectErrors(page, errors);

      /* the sign-in page itself, before any session */
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      const loginOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(loginOverflow, `/login overflows on ${d.name}`).toBeLessThanOrEqual(1);
      await testInfo.attach(`login-${theme}-${locale}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });

      await signIn(page);

      for (const path of FOUNDER_PATHS) {
        await page.goto(path);
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
        expect(page.url(), `${path} redirected away on ${d.name}`).toContain(path.split("?")[0]);
        await expect(page.getByRole("heading", { level: 1 }).first(), `${path} has its heading`).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} overflows horizontally on ${d.name} (${theme}, ${locale})`).toBeLessThanOrEqual(1);
        /* on a touch screen the header's controls are what a thumb hits first */
        const small = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>("header a[href], header button"))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              return r.width > 0 && r.height > 0 && style.visibility !== "hidden";
            })
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.height < 32 || r.width < 32)
            .map(({ el, r }) => `${el.getAttribute("aria-label") ?? el.textContent?.trim()} ${Math.round(r.width)}×${Math.round(r.height)}`),
        );
        expect(small, `${path}: header targets under 32px on ${d.name}`).toEqual([]);
        /* one way to each page: the header's one way back to the launcher, and
           no module or company switch anywhere on the screen */
        if (!path.startsWith("/apps")) {
          expect(await page.locator("header a[href='/apps']").count(), `${path}: All apps`).toBe(1);
        }
        expect(await page.locator(".switcher--bar, .switcher-entity, .company-switch").count(), path).toBe(0);
        await testInfo.attach(`${path.replace(/[/?=&]+/g, "_")}-${theme}-${locale}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
      }
      expect(errors, `console/page errors on ${d.name}`).toEqual([]);
      await context.close();
    });
  }
}
