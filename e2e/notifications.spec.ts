import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   Founder: "make a distict mark or a color for the un opened notifications"

   Until now the bell said "read" by DIMMING a row — an absence, which reads
   only against a brighter neighbour and not at all when every row is unread.
   An unread row now carries a POSITIVE mark: a tinted well, an accent bar down
   its logical inline start, a dot, and a heavier title, with the word "Unread"
   on the dot so the cue is never colour alone.

   Proved here on the built app, in BOTH brands and in Arabic, and — the half
   that matters — proved to STOP once the row is opened.
   ========================================================================== */

const ADMIN = { id: "admin@byteforce.com", password: "password123" };
const SARA = { id: "sara@byteforce.example", password: "byteforce123" };

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing);
}

/** the menu row whose title starts with this text (rows are buttons) */
const row = (page: Page, title: string) =>
  page.locator(".bell-menu .bell-item", { hasText: title });

/* WCAG 2.x contrast, measured on what the browser actually painted. The row's
   own background is the ground (the menu card behind it is opaque), so the
   ratio is computed from the row's background-color and the text's color. */
const contrastIn = (rowLocator: ReturnType<typeof row>, childSelector: string) =>
  rowLocator.evaluate((el, sel) => {
    const parse = (c: string) =>
      (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number];
    const lum = ([r, g, b]: [number, number, number]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bg = parse(getComputedStyle(el).backgroundColor);
    const fg = parse(getComputedStyle(el.querySelector(sel)!).color);
    const [a, b] = [lum(bg), lum(fg)].sort((x, y) => y - x);
    return (a! + 0.05) / (b! + 0.05);
  }, childSelector);

const contrastOfBody = (r: ReturnType<typeof row>) => contrastIn(r, ".feed-text");
const contrastOfTitle = (r: ReturnType<typeof row>) => contrastIn(r, ".bell-item-title");

test("an unread notification is MARKED, and opening it takes the mark away", async ({
  page,
}) => {
  await login(page, ADMIN.id, ADMIN.password, /\/b-systems$/);

  /* Two real notifications, made the way the app makes them: marking a lead
     ready to close broadcasts to every admin (V2 §3). Two, because the whole
     point is that an unread row is distinguishable from a read one AT THE SAME
     TIME, in the same menu. */
  const leads: string[] = [];
  for (const name of ["Unread Mark Alpha", "Unread Mark Beta"]) {
    const created = await page.request.post("/api/b-systems/leads", {
      data: { name, number: "0107770001", type: "cold_call", companyName: `${name} SAE` },
    });
    expect(created.status()).toBe(201);
    const lead = (await created.json()) as { id: string };
    leads.push(lead.id);
    expect((await page.request.post(`/api/b-systems/leads/${lead.id}/ready`)).ok()).toBe(true);
  }

  await page.goto("/b-systems");
  const bell = page.getByRole("button", { name: /^Notifications/ });
  /* the count still works — it is the same unread arithmetic the mark uses */
  await expect(bell).toHaveAttribute("aria-label", /\(\d+ unread\)/);
  await bell.click();

  const alpha = row(page, "Ready to close: Unread Mark Alpha");
  const beta = row(page, "Ready to close: Unread Mark Beta");
  await expect(alpha).toHaveAttribute("data-unread", "true");
  await expect(beta).toHaveAttribute("data-unread", "true");
  /* the mark is a WORD, not only a colour — this is the accessible half */
  await expect(alpha.getByRole("img", { name: "Unread" })).toBeVisible();
  await expect(beta.getByRole("img", { name: "Unread" })).toBeVisible();

  /* the mark is really painted, not merely an attribute: the row's own well
     differs from a plain menu row's, and it carries an accent bar */
  const paint = await alpha.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      barWidth: cs.borderInlineStartWidth,
      barColor: cs.borderInlineStartColor,
      weight: getComputedStyle(el.querySelector(".bell-item-title")!).fontWeight,
    };
  });
  expect(paint.bg).not.toBe("rgba(0, 0, 0, 0)"); // a tinted well, not the card
  expect(paint.barWidth).toBe("3px");
  expect(paint.barColor).not.toBe(paint.bg);
  expect(Number(paint.weight)).toBeGreaterThanOrEqual(700);

  /* ...and the well must not have made the row HARDER to read. The brand audit
     measured the muted body line at 4.17:1 on the B-Systems tint — under the
     4.5:1 AA bar for 12.5px text, on exactly the rows this feature exists to
     draw the eye to. Measured live, in both brands, rather than trusted. */
  expect(await contrastOfBody(alpha)).toBeGreaterThanOrEqual(4.5);
  expect(await contrastOfTitle(alpha)).toBeGreaterThanOrEqual(4.5);

  /* OPEN one: it marks read and deep-links to the lead (unchanged behaviour) */
  await alpha.click();
  await expect(page).toHaveURL(new RegExp(`/b-systems/crm/lead/${leads[0]}$`));

  await page.goto("/b-systems");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const alphaAgain = row(page, "Ready to close: Unread Mark Alpha");
  await expect(alphaAgain).toHaveAttribute("data-unread", "false");
  await expect(alphaAgain.getByRole("img", { name: "Unread" })).toHaveCount(0);
  /* ...while its neighbour, untouched, is still marked — the two states sit in
     the same menu and are told apart at a glance */
  await expect(row(page, "Ready to close: Unread Mark Beta")).toHaveAttribute(
    "data-unread",
    "true",
  );

  /* ARABIC / RTL: the mark keeps its word and moves to the right-hand edge */
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  const betaAr = row(page, "Ready to close: Unread Mark Beta");
  await expect(betaAr.getByRole("img", { name: "غير مقروء" })).toBeVisible();
  const rtlBar = await betaAr.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { start: cs.borderInlineStartWidth, left: cs.borderLeftWidth, right: cs.borderRightWidth };
  });
  expect(rtlBar.start).toBe("3px");
  expect(rtlBar.right).toBe("3px"); // logical start === right under RTL
  expect(rtlBar.left).toBe("0px");
  await page.getByRole("button", { name: "EN", exact: true }).click();

  /* ---- the OTHER brand: the same component, the same mark, ByteForce chrome.
     A ByteForce lead-chat mention is the notification that lands in that bell
     (founder V5), so Sara raises one for the admin. ---- */
  const bfLeadRes = await page.request.post("/api/byteforce/leads", {
    data: { name: "Unread Mark Gamma", number: "0107770003", type: "cold_call" },
  });
  expect(bfLeadRes.status()).toBe(201);
  const bfLead = (await bfLeadRes.json()) as { id: string };

  const saraCtx = await page.context().browser()!.newContext();
  const saraPage = await saraCtx.newPage();
  await login(saraPage, SARA.id, SARA.password, /\/b-systems\?company=byteforce$/);
  const mention = await saraPage.request.post(`/api/byteforce/leads/${bfLead.id}/comments`, {
    data: { body: "@Elmur can you look at Unread Mark Gamma?" },
  });
  expect(mention.ok()).toBe(true);
  await saraCtx.close();

  await page.goto("/b-systems?company=byteforce");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const gamma = row(page, "mentioned you");
  await expect(gamma).toHaveAttribute("data-unread", "true");
  await expect(gamma.getByRole("img", { name: "Unread" })).toBeVisible();
  const bfPaint = await gamma.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, bar: cs.borderInlineStartColor };
  });
  expect(bfPaint.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bfPaint.bar).not.toBe(bfPaint.bg);
  /* the same AA bar on the ByteForce feed. ADR-067 merged the two apps into one
     shell, so this is no longer "the other brand's tokens" — the chrome is
     B-Systems in both companies now. What it still proves is that the unread
     mark is legible on the OTHER company's rows, which is the point. */
  expect(await contrastOfBody(gamma)).toBeGreaterThanOrEqual(4.5);
  expect(await contrastOfTitle(gamma)).toBeGreaterThanOrEqual(4.5);

  /* ---- clean up after ourselves: the suite shares ONE seeded database, and a
     spec that leaves extra cards on a board breaks whichever journey runs next.
     Notification rows carry no FK to the lead, so they outlive it — mark every
     one of ours read so no later spec inherits a lit-up bell. ---- */
  const bsFeed = (await (await page.request.get("/api/b-systems/notifications")).json()) as Array<{
    id: string;
    readAt: string | null;
  }>;
  for (const n of bsFeed.filter((x) => !x.readAt)) {
    await page.request.patch(`/api/b-systems/notifications/${n.id}`);
  }
  const bfFeed = (await (await page.request.get("/api/byteforce/notifications")).json()) as Array<{
    id: string;
    readAt: string | null;
  }>;
  for (const n of bfFeed.filter((x) => !x.readAt)) {
    await page.request.patch(`/api/byteforce/notifications/${n.id}`);
  }
  for (const id of leads) {
    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  }
  /* the ByteForce namespace has no DELETE (only B-Systems does) — archiving is
     the sanctioned soft-hide (ADR-043) and it drops the card out of the board,
     the counts and the To-Do, which is all a later spec can see */
  const archived = await page.request.post(`/api/byteforce/leads/${bfLead.id}/archive`, {
    data: { value: true },
  });
  expect(archived.ok()).toBe(true);
});
