import { expect, test, type Locator, type Page } from "@playwright/test";

/* Founder, on his phone: "the scroller of the columns and the CRM is not
   working — when I try to scroll using the cards it drags the card. I should
   have a button to drag the card, otherwise I'm just scrolling even if I'm
   touching the card... I cannot reach the leads under the column because I
   cannot scroll."

   The contract this spec pins:
   · a finger that lands on the CARD pans — the column's inner scroll, the
     board's horizontal scroll — and never moves the card between stages;
   · a finger that lands on the GRIP drags, exactly like a mouse;
   · a tap on the grip never opens the lead.

   Playwright's `page.touchscreen` only exposes tap(), so a touch PAN has to be
   driven over CDP `Input.dispatchTouchEvent` (chromium-only; the config
   declares no projects, so every test runs on chromium). */

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

async function touchSwipe(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y }],
  });
  const steps = 18;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400); // let the fling settle before measuring
  await cdp.detach();
}

const center = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

async function loginByteForce(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/byteforce$/);
}

async function seedLeads(page: Page, prefix: string, count: number) {
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const res = await page.request.post("/api/byteforce/leads", {
      data: { name: `${prefix} ${i}`, number: `0103000${i}000`, type: "cold_call" },
    });
    expect(res.status()).toBe(201);
    ids.push(((await res.json()) as { id: string }).id);
  }
  return ids;
}

/* ADR-043: archived leaves the board — the ByteForce API has no lead delete */
async function archiveAll(page: Page, ids: string[]) {
  for (const id of ids) {
    const res = await page.request.post(`/api/byteforce/leads/${id}/archive`, {
      data: { value: true },
    });
    expect(res.ok()).toBe(true);
  }
}

const scrollTopOf = (list: Locator) => list.evaluate((el) => el.scrollTop);

test("a finger on a card SCROLLS the column and the board — it never moves the card", async ({
  page,
}) => {
  await loginByteForce(page);
  const ids = await seedLeads(page, "Touch Lead", 7);

  await page.goto("/byteforce/crm");
  const column = page.locator('[data-stage="new"]');
  const list = column.locator(".col-cards");
  await expect(list.locator('[data-deal-card^="Touch Lead"]')).toHaveCount(7);
  /* the column really is capped and scrollable — otherwise the assertions
     below would be vacuously true */
  expect(
    await list.evaluate((el) => el.scrollHeight > el.clientHeight),
    "the >5-card column must overflow, or this test proves nothing",
  ).toBe(true);

  const card = column.locator('[data-deal-card^="Touch Lead"]').first();
  const box = (await card.boundingBox())!;

  /* THE GEOMETRY/STYLE CONTRACT — cheap, and it catches a stray `touch-none`
     coming back long before anyone has to read a gesture failure. */
  await expect(card).toHaveCSS("touch-action", "manipulation");
  const grip = card.locator(".bcard-grip");
  await expect(grip).toBeVisible();
  await expect(grip).toHaveCSS("touch-action", "none");
  const gb = (await grip.boundingBox())!;
  expect(gb.width, "WCAG 2.5.8 target minimum").toBeGreaterThanOrEqual(24);
  expect(gb.height, "WCAG 2.5.8 target minimum").toBeGreaterThanOrEqual(24);
  /* the existing mouse drag helpers grab `card.width - 10`: that point has to
     stay inside the rail, or those journeys silently stop covering the grip */
  expect(gb.width).toBeGreaterThan(10);
  /* ...and BOUNDED. The grip is the app's only touch-action:none surface, so a
     full-card-height one stacks into a single unbroken no-scroll strip down the
     whole column — the founder's complaint in a 26px-wide disguise. Half a card
     is the line; (1b) below proves the gutter it leaves actually scrolls. */
  expect(gb.height, "the no-scroll rail must not span the card").toBeLessThanOrEqual(
    box.height / 2,
  );

  /* (1) THE FOUNDER'S LITERAL COMPLAINT — a swipe UP that starts on a card
     scrolls the column. This was 0 before the fix. */
  await touchSwipe(page, { x: box.x + 40, y: box.y + 12 }, 0, -140);
  const afterCardSwipe = await scrollTopOf(list);
  expect(afterCardSwipe, "a finger on the card must scroll the column").toBeGreaterThan(20);

  /* ...and the card did NOT go anywhere: no drag started, nothing left New */
  await expect(page.locator(".bcard--lift")).toHaveCount(0);
  await expect(page.locator('[data-stage="new"] [data-deal-card^="Touch Lead"]')).toHaveCount(7);

  /* (1b) the gutter the bounded grip leaves is ordinary card again: a finger
     landing in the rail's own COLUMN but BELOW the button scrolls like any
     other card surface. The sample point is chosen off live geometry — the
     column has already scrolled by an amount the fling decides, so a card
     picked by index could be half off screen. */
  const gutter = await page.evaluate(() => {
    const el = document.querySelector('[data-stage="new"] .col-cards') as HTMLElement;
    const lr = el.getBoundingClientRect();
    for (const card of [...el.querySelectorAll(".bcard")] as HTMLElement[]) {
      const cr = card.getBoundingClientRect();
      const g = card.querySelector(".bcard-grip")!.getBoundingClientRect();
      const y = cr.bottom - 5;
      if (cr.top > lr.top + 10 && y < lr.bottom - 10 && y > g.bottom + 4) {
        return { x: g.left + g.width / 2, y, room: el.scrollHeight - el.clientHeight - el.scrollTop };
      }
    }
    return null;
  });
  expect(gutter, "no whole card is on screen to sample the grip's gutter from").not.toBeNull();
  expect(gutter!.room, "the column must still have room to scroll").toBeGreaterThan(60);
  await touchSwipe(page, { x: gutter!.x, y: gutter!.y }, 0, -120);
  expect(
    await scrollTopOf(list),
    "the rail's gutter, off the button, must scroll like any card surface",
  ).toBeGreaterThan(afterCardSwipe + 20);

  /* Put the column back with REAL swipes. Never `el.scrollTop = 0`: a
     programmatic reset can leave the scroller in a state where the very next
     touch sequence that starts inside it is swallowed, and then (2)/(3) below
     pass or fail for a reason that has nothing to do with the CSS under test.
     (3) in particular needs scrollTop 0 for a different reason — dnd-kit
     auto-scrolls a scrollable ancestor while dragging near its edge, and only
     at the top is "did not scroll" an honest reading. */
  for (let i = 0; i < 5 && (await scrollTopOf(list)) > 0; i++) {
    const l = (await list.boundingBox())!;
    await touchSwipe(page, { x: l.x + 40, y: l.y + 30 }, 0, 320);
  }
  expect(await scrollTopOf(list), "the column must be back at the top").toBe(0);

  /* (3) the GRIP still owns the gesture: a swipe that starts on the button
     drags, so the column must NOT scroll under it */
  const gb2 = (await card.locator(".bcard-grip").boundingBox())!;
  await touchSwipe(page, center(gb2), 0, -140);
  expect(await scrollTopOf(list), "the grip drags — it must not scroll").toBe(0);

  /* (2) the BOARD's horizontal pan works from a card too (this is the one a
     `touch-action: pan-y` "fix" would leave broken). Last, so it needs no
     reset of its own. */
  const board = page.locator(".board");
  const box2 = (await card.boundingBox())!;
  await touchSwipe(page, center(box2), -160, 0);
  expect(
    await board.evaluate((el) => el.scrollLeft),
    "a finger on the card must pan the board sideways",
  ).toBeGreaterThan(20);

  /* (4) a plain TAP on the grip must not open the lead (the grip stops both
     the click and the pointerdown, exactly like the Call/WhatsApp chips) */
  await page.reload();
  const first = page.locator('[data-stage="new"] [data-deal-card^="Touch Lead"]').first();
  const gb3 = (await first.locator(".bcard-grip").boundingBox())!;
  await page.touchscreen.tap(gb3.x + gb3.width / 2, gb3.y + gb3.height / 2);
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/byteforce\/crm$/);

  /* (5) ...while a tap on the card body still opens it */
  const rep = (await first.locator(".bcard-rep").boundingBox())!;
  await page.touchscreen.tap(rep.x + rep.width / 2, rep.y + rep.height / 2);
  await page.waitForURL(/\/byteforce\/leads\/lead\//);

  await archiveAll(page, ids);
});

test("dragging BY THE GRIP still moves a card between stages, on touch", async ({ page }) => {
  await loginByteForce(page);
  const ids = await seedLeads(page, "Grip Lead", 1);

  await page.goto("/byteforce/crm");
  const card = page.locator('[data-deal-card="Grip Lead 1"]');
  await expect(card).toBeVisible();
  const grip = (await card.locator(".bcard-grip").boundingBox())!;
  const target = (await page.locator('[data-stage="following_up"]').boundingBox())!;

  /* the second column is only partly on screen at 390px — aim at the part
     that IS, exactly as a thumb would */
  const dropX = Math.min(target.x + target.width / 2, 350);
  const start = center(grip);
  await touchSwipe(page, start, dropX - start.x, target.y + 70 - start.y);

  /* the drop opened the stage's form — the move is real, not a scroll */
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await page.getByLabel("Follow-up date").fill("2026-10-03");
  await page.getByLabel("Follow-up time").fill("11:15");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(
    page.locator('[data-stage="following_up"] [data-deal-card="Grip Lead 1"]'),
  ).toBeVisible();

  await archiveAll(page, ids);
});

/* The DragOverlay clone renders the same body, so it renders a grip too — it
   must stay OUT of the accessibility tree and out of the tab order, or every
   drag would briefly double the card's buttons. Mouse-driven on purpose: this
   is the desktop path, and it doubles as the proof that a mouse still drags
   the whole card body. */
test.describe(() => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 900 } });

  test("desktop: the mouse drags the whole card, and the overlay clone stays inert", async ({
    page,
  }) => {
    await loginByteForce(page);
    const ids = await seedLeads(page, "Mouse Lead", 1);

    await page.goto("/byteforce/crm");
    const card = page.locator('[data-deal-card="Mouse Lead 1"]');
    await expect(card).toBeVisible();
    const label = "Drag to move this card";
    const gripsBefore = await page.getByRole("button", { name: label }).count();
    expect(gripsBefore).toBeGreaterThan(0);

    /* grab the SUBTITLE — plain text in the card body, nowhere near the grip:
       proves the whole-card mouse drag survived the touch gate */
    const from = (await card.locator(".bcard-rep").boundingBox())!;
    const to = (await page.locator('[data-stage="following_up"]').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 14, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 14 });

    /* mid-drag: the overlay is up, the source ghosts, and the clone's grip is
       neither focusable nor a second button in the a11y tree */
    await expect(page.locator(".bcard--lift")).toHaveCount(1);
    await expect(card).toHaveClass(/bcard--ghost/);
    await expect(page.locator(".bcard--lift .bcard-grip")).toHaveAttribute("tabindex", "-1");
    expect(await page.getByRole("button", { name: label }).count()).toBe(gripsBefore);

    const settled = (await page.locator('[data-stage="following_up"]').boundingBox())!;
    await page.mouse.move(settled.x + settled.width / 2, settled.y + 60, { steps: 2 });
    await page.mouse.up();
    await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await archiveAll(page, ids);
  });
});

/* The grip is added three times, in three files — the partners board is the
   one that needed a brand-new import and is the easiest to miss. */
test.describe(() => {
  test.use({ hasTouch: true, isMobile: false, viewport: { width: 1280, height: 900 } });

  test("all three boards carry the grip, and it speaks Arabic", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or phone").fill("admin@byteforce.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/b-systems$/);

    for (const path of ["/b-systems/crm", "/b-systems/partners-pipeline", "/byteforce/crm"]) {
      await page.goto(path);
      const card = page.locator(".bcard[data-deal-card]").first();
      await expect(card, `${path} needs at least one card to prove the grip`).toBeVisible();
      await expect(
        card.getByRole("button", { name: "Drag to move this card" }),
        `${path} card is missing the drag grip`,
      ).toBeVisible();
      await expect(card).toHaveCSS("touch-action", "manipulation");
      await expect(card.locator(".bcard-grip")).toHaveCSS("touch-action", "none");
    }

    /* Arabic: the label is translated and the rail flips to the card's LEFT */
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const rtlCard = page.locator(".bcard[data-deal-card]").first();
    await expect(rtlCard.getByRole("button", { name: "اسحب لنقل هذه البطاقة" })).toBeVisible();
    const cb = (await rtlCard.boundingBox())!;
    const gb = (await rtlCard.locator(".bcard-grip").boundingBox())!;
    expect(gb.x, "the grip must sit on the inline START edge in RTL").toBeLessThan(
      cb.x + cb.width / 2,
    );
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });
});
