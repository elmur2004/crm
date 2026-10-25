import { expect, test, type Page } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* ============================================================================
   The Home's MOTION, with motion switched ON (dashboard spec §5.3, §9.5).

   The Home's other spec (dashboard.spec) runs under reduced motion. This file
   runs WITH motion, explicitly, to prove the one thing motion must never do:
   show a wrong number. BUG-026 was
   every figure dropping to 0 and climbing back on every visit; the fix is that
   numbers count only when they CHANGE. So from the very first frame the
   visible text of every KPI must equal its server value (`data-value`), and it
   must keep equalling it while the bars and lines draw in around it.
   ========================================================================== */

test.use({ contextOptions: { reducedMotion: "no-preference" } });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems$/);
}

/** What `formatEGP` / LiveNumber print for a server value. */
function expected(format: "egp" | "int" | "pct", raw: string): string {
  const n = Number(raw);
  if (format === "pct") return raw === "" ? "—" : `${n}%`;
  const grouped = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (format === "int") return grouped(n);
  const pounds = n / 100;
  return n % 100 === 0
    ? `EGP ${grouped(pounds)}`
    : `EGP ${pounds.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const KPIS: Array<[string, "egp" | "int" | "pct"]> = [
  ["won_period", "egp"],
  ["new_leads", "int"],
  ["win_rate", "pct"],
  ["pipeline_value", "egp"],
];

async function readKpis(page: Page) {
  return page.evaluate((keys) => {
    return keys.map((key) => {
      const card = document.querySelector(`[data-metric="${key}"]`);
      return {
        key,
        value: card?.getAttribute("data-value") ?? null,
        text: card?.querySelector(".db-kpi-value")?.textContent?.trim() ?? null,
      };
    });
  }, KPIS.map(([k]) => k));
}

test("first load: every KPI shows its server value from the first frame — no frame shows 0", async ({ page }) => {
  await login(page);
  /* motion really is on here, or this test would prove nothing */
  const animated = await page
    .locator(".db-stagebar-fill")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animated).toBe("db-grow-y");

  await page.goto("/b-systems", { waitUntil: "commit" });
  await page.waitForSelector('[data-metric="won_period"]');
  const deadline = Date.now() + 1200;
  let samples = 0;
  while (Date.now() < deadline) {
    for (const row of await readKpis(page)) {
      const format = KPIS.find(([k]) => k === row.key)![1];
      expect(row.text, `${row.key} @ sample ${samples}`).toBe(expected(format, row.value ?? ""));
    }
    samples += 1;
  }
  expect(samples).toBeGreaterThan(3);
});

test("the bars draw once; switching the period keeps the DOM, so they ease instead of redrawing", async ({
  page,
}) => {
  await login(page);
  const fill = page.locator('[data-metric="stage:won"] .db-stagebar-fill');
  await expect
    .poll(() => fill.evaluate((el) => el.getAnimations().filter((a) => a.playState === "running").length))
    .toBe(0);
  /* stamp the node, then switch the range with the picker (a client
     navigation — the same DOM-keeping render a refresh does) */
  await fill.evaluate((el) => el.setAttribute("data-probe", "kept"));
  await page.getByRole("button", { name: /Period/ }).click();
  await page.locator("#db-range-menu").getByRole("link", { name: /Last 30 days/ }).click();
  await page.waitForURL(/range=30d/);
  await expect(page.locator(".db-range-value")).toHaveText("Last 30 days");
  /* the same element is still there — no remount, so no second draw-in */
  await expect(page.locator('[data-metric="stage:won"] .db-stagebar-fill[data-probe="kept"]')).toHaveCount(1);
  const redraws = await fill.evaluate(
    (el) => el.getAnimations().filter((a) => (a as CSSAnimation).animationName === "db-grow-y").length,
  );
  expect(redraws).toBe(0);
});

test("under reduced motion nothing on the Home animates", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
  const page = await context.newPage();
  await login(page);
  const names = await page
    .locator(".db *")
    .evaluateAll((els) =>
      [...new Set(els.map((el) => getComputedStyle(el).animationName).filter((n) => n.startsWith("db-")))],
    );
  expect(names).toEqual([]);
  await context.close();
});
