import { expect, test, type Browser, type Page } from "@playwright/test";

/* Founder: "when I zoom in and out the UI gets so scattered."
 *
 * THE TRAP THIS SPEC EXISTS TO ESCAPE: headless Chromium launches with
 * `--hide-scrollbars` (playwright-core bundles it for every headless launch),
 * so `100vw === documentElement.clientWidth` in the test suite and NOWHERE
 * else. That is why qa-sweep's and nav-slider's overflow assertions have been
 * green all along while the founder's real Chrome overflowed. This file opts
 * out — scoped HERE and never in playwright.config.ts, which would move
 * geometry under the whole existing suite.
 *
 * Browser zoom is modelled with three knobs, because no single one is zoom:
 *  (a) LAYOUT — the CSS viewport shrinks: setViewportSize(1440/z, 760/z).
 *      This is what moves media queries and what vh/vw resolve to.
 *  (b) SCROLLBAR — a classic scrollbar keeps a FIXED PHYSICAL thickness, so in
 *      CSS px it is 15/z. Forced per zoom with `html::-webkit-scrollbar`,
 *      injected via addInitScript: injecting it after load does NOT relayout
 *      an already-created scrollbar (learned the hard way — it silently keeps
 *      measuring 15px).
 *  (c) FRACTIONAL PIXELS — documentElement.style.zoom, used only for the
 *      overlap check. It does not move a media query, so it must never be used
 *      to test breakpoints.
 */

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

/* 1440 device px wide, the founder's monitor; his zoom steps plus the extremes */
const ZOOMS = [0.25, 0.5, 0.67, 0.8, 0.9, 1, 1.25, 1.5, 2, 3];
const BOARDS = ["/b-systems/crm", "/b-systems/partners-pipeline", "/byteforce/crm"];
const ORDINARY = ["/b-systems", "/b-systems/leads", "/accounting", "/vault"];

async function signedInState(browser: Browser, baseURL: string) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 760 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

/** One browser context standing in for the browser at zoom `z`. */
async function atZoom(
  browser: Browser,
  baseURL: string,
  storageState: Awaited<ReturnType<typeof signedInState>>,
  z: number,
  run: (page: Page, scrollbar: number) => Promise<void>,
) {
  const scrollbar = Math.max(1, Math.round(15 / z));
  const ctx = await browser.newContext({
    baseURL,
    storageState,
    viewport: { width: Math.round(1440 / z), height: Math.round(760 / z) },
  });
  await ctx.addInitScript((w) => {
    const apply = () => {
      const s = document.createElement("style");
      /* `overflow-y: scroll` models the founder's everyday page: one long
         enough to scroll, so the classic scrollbar EXISTS. Without it a huge
         zoomed-out viewport makes the page short, the scrollbar disappears and
         the bug hides — the same way --hide-scrollbars hides it. */
      s.textContent = `html{overflow-y:scroll}html::-webkit-scrollbar{width:${w}px;height:${w}px}`;
      document.head.appendChild(s);
    };
    if (document.head) apply();
    else document.addEventListener("DOMContentLoaded", apply);
  }, scrollbar);
  const page = await ctx.newPage();
  try {
    await run(page, scrollbar);
  } finally {
    await ctx.close();
  }
}

const metrics = (page: Page) =>
  page.evaluate(() => {
    const de = document.scrollingElement as HTMLElement;
    const rect = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: +r.left.toFixed(2), right: +r.right.toFixed(2), top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2) };
    };
    const board = document.querySelector(".board");
    const shell = board?.closest(".shell-body") ?? null;
    return {
      clientWidth: de.clientWidth,
      scrollbar: window.innerWidth - de.clientWidth,
      overflow: de.scrollWidth - de.clientWidth,
      board: rect(".board"),
      firstColumn: rect(".board .col"),
      h1: rect(".page h1"),
      header: rect("header"),
      main: rect("main.page"),
      boardMarginStart: board ? getComputedStyle(board).marginInlineStart : null,
      shellContainerType: shell ? getComputedStyle(shell).containerType : null,
    };
  });

test("A1-A4, A8, A10: no page overflow and the board stays put, at every zoom", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const state = await signedInState(browser, baseURL!);

  for (const z of ZOOMS) {
    await atZoom(browser, baseURL!, state, z, async (page, scrollbar) => {
      for (const path of BOARDS) {
        await page.goto(path);
        await page.locator(".board").first().waitFor();
        const m = await metrics(page);
        const at = `${path} @ zoom ${z} (scrollbar ${scrollbar}px, measured ${m.scrollbar}px)`;

        /* A1 — the headline. Measured BEFORE the fix: +22 at 25%, +7 at 50%,
           +2 at 80%, +1 at 90%. */
        expect(m.overflow, `A1 horizontal page overflow — ${at}`).toBeLessThanOrEqual(1);

        /* A2/A3 — the board itself is inside the viewport (its start edge was
           pushed OFF-SCREEN below ~94% zoom: -22px at 25%, -7px at 50%) */
        expect(m.board!.left, `A2 board start edge off-screen — ${at}`).toBeGreaterThanOrEqual(-1);
        expect(m.board!.right, `A3 board end edge past the viewport — ${at}`).toBeLessThanOrEqual(
          m.clientWidth + 1,
        );

        /* A4 — the founder's stated intent: the first column starts at the
           centered content edge, level with the page title */
        if (m.h1) {
          expect(
            Math.abs(m.firstColumn!.left - m.h1.left),
            `A4 first column is not level with the title — ${at}`,
          ).toBeLessThanOrEqual(2);
        }

        /* A8 — page chrome does not sit on top of the page content */
        if (m.header && m.main) {
          expect(m.header.bottom, `A8 header overlaps the page — ${at}`).toBeLessThanOrEqual(
            m.main.top + 1,
          );
        }

        /* A10 — the guard against the fix silently NOT applying. A missing
           .shell-body wrapper makes 50cqw fall back to the viewport size,
           i.e. straight back to today's bug, with no error anywhere. */
        expect(m.shellContainerType, `A10 no .shell-body query container — ${at}`).toBe(
          "inline-size",
        );
        expect(m.boardMarginStart, `A10 the ±8px scrollbar fudge is back — ${at}`).not.toContain(
          "8px",
        );
      }
    });
  }
});

test("A1: the ordinary pages do not overflow sideways at any zoom either", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const state = await signedInState(browser, baseURL!);
  for (const z of [0.5, 0.67, 0.8, 1, 1.5, 2]) {
    await atZoom(browser, baseURL!, state, z, async (page, scrollbar) => {
      for (const path of ORDINARY) {
        await page.goto(path);
        await page.waitForLoadState("domcontentloaded");
        const m = await metrics(page);
        expect(
          m.overflow,
          `A1 horizontal page overflow — ${path} @ zoom ${z} (scrollbar ${scrollbar}px)`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }
});

/* A5 — THE JUMP. The one assertion that fails at 100% zoom, where every other
   assertion passes. `100vw` includes the scrollbar; the space the page can
   actually use does not. So the board slid sideways by half a scrollbar
   whenever the page grew long enough to scroll — 15.0px at 50% zoom, 7.5px at
   100%, 5.0px at 150% (measured). Filtering the board, or a lead list crossing
   the fold, moved the whole board under a title that did not move. */
test("A5: the board does not jump sideways when the page gains a scrollbar", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const state = await signedInState(browser, baseURL!);
  for (const z of [0.5, 0.8, 1, 1.5]) {
    await atZoom(browser, baseURL!, state, z, async (page) => {
      await page.goto("/b-systems/crm");
      await page.locator(".board").first().waitFor();
      const withBar = await page.evaluate(() => {
        document.documentElement.style.overflowY = "scroll";
        document.body.style.minHeight = "400vh"; // force a scrolling page
        void document.body.offsetHeight;
        return document.querySelector(".board")!.getBoundingClientRect().left;
      });
      const withoutBar = await page.evaluate(() => {
        document.documentElement.style.overflowY = "hidden";
        document.body.style.minHeight = "";
        void document.body.offsetHeight;
        return document.querySelector(".board")!.getBoundingClientRect().left;
      });
      expect(
        Math.abs(withBar - withoutBar),
        `A5 the board moved ${Math.abs(withBar - withoutBar).toFixed(1)}px sideways just because the page scrolls, @ zoom ${z}`,
      ).toBeLessThanOrEqual(1);
    });
  }
});

/* A6 — the founder asked for "about five cards"; what shipped was 2.5 at 100%
   zoom and 0.83 (not one whole card) at 300%, because the cap was written in
   vh against a fixed-px card. The cap must stay a CAP, but never collapse
   below two whole cards. */
test("A6: a long column shows at least two whole cards at every zoom, and still caps", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);

  const seed = await browser.newContext({ baseURL, viewport: { width: 1440, height: 760 } });
  const sp = await seed.newPage();
  await sp.goto("/login");
  await sp.getByLabel("Email or phone").fill("sara@byteforce.example");
  await sp.getByLabel("Password").fill("byteforce123");
  await sp.getByRole("button", { name: "Sign in" }).click();
  await sp.waitForURL(/\/byteforce$/);
  const ids: string[] = [];
  for (let i = 1; i <= 7; i++) {
    /* The names WRAP to the `.bcard-name` 2-line clamp on purpose. The floor is
       a frozen px constant while the oracle below is a LIVE card height, so the
       two can only be kept honest by seeding the case that separates them: a
       one-line name is ~15px shorter than a wrapped one, and with short names
       this test stayed green off a constant that no longer matched any real
       card. A realistic full name is the common case, not the exotic one. */
    const res = await sp.request.post("/api/byteforce/leads", {
      data: {
        name: `Zoom Lead ${i} Abdelrahman Mohamed Elsayed`,
        number: `0104000${i}000`,
        type: "cold_call",
      },
    });
    expect(res.status()).toBe(201);
    ids.push(((await res.json()) as { id: string }).id);
  }
  /* Review — the LAST lead is flagged twice, which makes it both the FIRST card
     in the column (`updatedAt desc`) and the richest one, so the live oracle
     below is taken from the tallest card a rep can actually produce. ADR-064
     turned the meta row's one flipping button into two side by side ("Didn't
     answer" always, "Answered — clear flag" once there is a tally) beside the
     ready-to-close button, and put a "No answer · 2" badge in the chips row:
     three inline buttons no longer share one line at the 218px six-column
     width, so a flagged card is a text line taller than the card `--bcard-h-max`
     was originally measured against. With unflagged fixtures this test measured
     a card shape the board no longer shows and the floor could go stale
     unnoticed — which is exactly what it did. */
  for (let i = 0; i < 2; i += 1) {
    const flag = await sp.request.post(`/api/byteforce/leads/${ids[ids.length - 1]}/no-answer`, {
      data: { value: true },
    });
    expect(flag.ok()).toBe(true);
  }
  const state = await seed.storageState();

  try {
    for (const z of ZOOMS) {
      await atZoom(browser, baseURL!, state, z, async (page) => {
        await page.goto("/byteforce/crm");
        const list = page.locator('[data-stage="new"] .col-cards');
        await list.waitFor();
        const m = await page.evaluate(() => {
          const el = document.querySelector('[data-stage="new"] .col-cards') as HTMLElement;
          const card = el.querySelector(".bcard") as HTMLElement;
          const gap = parseFloat(getComputedStyle(el).rowGap || "0");
          return {
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            /* derived from a LIVE card, never a hardcoded 176px — the cap has
               to survive future card content */
            cardHeight: card.getBoundingClientRect().height,
            gap,
          };
        });
        const twoCards = 2 * m.cardHeight + m.gap;
        expect(
          m.clientHeight,
          `A6 the column collapsed to ${(m.clientHeight / (m.cardHeight + m.gap)).toFixed(2)} cards @ zoom ${z} (card ${m.cardHeight.toFixed(1)}px)`,
        ).toBeGreaterThanOrEqual(twoCards - 1);
        expect(
          m.scrollHeight,
          `A6 the cap stopped capping — the long column is back @ zoom ${z}`,
        ).toBeGreaterThan(m.clientHeight);
      });
    }
  } finally {
    for (const id of ids) {
      await sp.request.post(`/api/byteforce/leads/${id}/archive`, { data: { value: true } });
    }
    await seed.close();
  }
});

/* A7 — sub-pixel rounding on the 9px gaps is only visible at FRACTIONAL zoom,
   which knob (a) alone cannot produce. */
test("A7: no card overlaps its neighbour at fractional zoom", async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const state = await signedInState(browser, baseURL!);
  await atZoom(browser, baseURL!, state, 1, async (page) => {
    await page.goto("/b-systems/crm");
    await page.locator(".board").first().waitFor();
    for (const z of [1.1, 1.25, 1.75, 2.5]) {
      const worst = await page.evaluate((zoom) => {
        document.documentElement.style.zoom = String(zoom);
        void document.body.offsetHeight;
        let worstOverlap = 0;
        for (const col of document.querySelectorAll(".col-cards")) {
          const rects = [...col.querySelectorAll(".bcard")]
            .map((c) => c.getBoundingClientRect())
            .sort((a, b) => a.top - b.top);
          for (let i = 0; i + 1 < rects.length; i++) {
            worstOverlap = Math.max(worstOverlap, rects[i]!.bottom - rects[i + 1]!.top);
          }
        }
        document.documentElement.style.zoom = "";
        return worstOverlap;
      }, z);
      expect(worst, `A7 cards overlap by ${worst.toFixed(2)}px at CSS zoom ${z}`).toBeLessThanOrEqual(
        1,
      );
    }
  });
});

