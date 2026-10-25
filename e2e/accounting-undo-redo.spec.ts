import { expect, test, type Locator, type Page } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* ============================================================================
   ADR-086 — THE ACCOUNTING UNDO/REDO PAIR, IN A REAL BROWSER.

   Everything else about this feature is pinned in SOURCE: the copy, the refusal
   table, the glyph arithmetic, the engine's inverses. What no unit test can
   reach is the part that only exists once a browser is running it — the
   `router.refresh()` flip that makes the pair swap sides without a reload, the
   focus the in-flight `disabled` takes away and the effect gives back, the live
   region's announcement, and the geometry that is the whole reason both halves
   render together. On a money screen those are not source facts, they are
   behaviour, so they are tested here.

   WHO ACTS. The pair is PERSONAL, and the single seeded accounting account
   (admin@byteforce.com) is the account every other accounting spec has already
   been acting as — its stack is whatever the file before this one left behind.
   So this spec makes its OWN two administrators through the real Add-user form
   (the same way module-access.spec.ts does), which gives two things no seeded
   account can: a provably CLEAN history for the "renders nothing" case, and a
   second pair of eyes for the personal-scope case that cannot be confused with
   another spec's leftovers.

   MONEY ISOLATION. Every row is booked into 2095-07 — a month no other spec
   touches — and left PENDING, so no cash lands in the current month and no
   absolute figure asserted anywhere else in the suite can move. Rows carry the
   "E2E UR" prefix and each test deletes what it made.
   ========================================================================== */

const PASSWORD = "undoredo123";
const ALPHA = { name: "UR Alpha", email: "ur.alpha@b-systems.example" };
const BETA = { name: "UR Beta", email: "ur.beta@b-systems.example" };

const COMPANY = "byteforce";
const MONTH = "2095-07";
const INCOME = `/accounting/income?company=${COMPANY}&month=${MONTH}`;

/* The copy, as a bookkeeper reads it. Repeated here rather than imported: a
   spec that imports the dictionary cannot notice the dictionary changing. */
const EN = {
  undo: "Undo",
  redo: "Redo",
  nothingToUndo: "Nothing to undo",
  nothingToRedo: "Nothing to redo",
  undoing: "Undoing…",
  group: "Undo and redo",
  scope: "One step back, and only your own accounting entries.",
  changed: "This record changed since then, so the step was refused. Nothing was touched.",
  noLonger: "That step is no longer available. The page has been refreshed.",
  applied: "That step was already applied. The page has been refreshed.",
  generic: "Something went wrong",
  deleteConfirm: "Delete this record? You can undo it for a few minutes.",
  addedIncome: "Added income",
  deletedIncome: "Deleted income",
};

/* Arabic, assembled from its parts so no bidirectional run has to be read in
   one piece in this file: acct.undoBtn / undoNameWhat / undoDone / redoDone /
   redoNothing, and acctLabel.incomeCreated's own stored sentence. */
const AR = {
  undo: "تراجع",
  undoPrefix: "تراجع عن:",
  undonePrefix: "تم التراجع عن:",
  redonePrefix: "تمت إعادة:",
  nothingToRedo: "لا يوجد ما يمكن إعادته",
  addedIncome: "إضافة دخل",
  deleteConfirm: "حذف هذا السجل؟ يمكنك التراجع عنه خلال الدقائق القليلة التالية.",
};

/* ------------------------------------------------------------------ fixtures */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

const loginAsFounder = (page: Page) =>
  login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

/** A second accounting administrator, through the real Add-user form — the
    module boxes stay ticked, so he is born with Accounting (module-access.spec
    covers withholding it). */
async function createAdmin(page: Page, who: { name: string; email: string }) {
  await page.goto("/b-systems/users");
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password (min 8)").fill(PASSWORD);
  await page.getByRole("checkbox", { name: "B-Systems admin" }).check();
  const modules = page.getByRole("group", { name: "Modules" });
  await expect(modules.getByRole("checkbox", { name: "Accounting" })).toBeChecked();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("row", { name: new RegExp(who.name) })).toBeVisible();
}

/** Book a PENDING income row through the modal, exactly as accounting.spec does. */
async function addIncome(page: Page, client: string, egp: string) {
  await page.getByRole("button", { name: "+ Add income" }).click();
  const modal = page.locator(".modal");
  await modal.getByLabel("Client name").fill(client);
  await modal.getByLabel("Amount (EGP)").fill(egp);
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator("tr", { hasText: client })).toHaveCount(1);
}

/** Delete a row through the native confirm, handing back what the dialog SAID. */
async function deleteIncome(page: Page, client: string): Promise<string> {
  let said = "";
  page.once("dialog", (d) => {
    said = d.message();
    void d.accept();
  });
  await page.locator("tr", { hasText: client }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator("tr", { hasText: client })).toHaveCount(0);
  return said;
}

/* ---------------------------------------------------------------- the control */

const pairOf = (page: Page) => page.locator(".acct-ur");
const halves = (page: Page) => pairOf(page).locator(".acct-ur-btn");
/* ORDER IS THE CONTRACT: undo at the inline start, redo after it. Asserted as
   order (nth) AND as meaning (the accessible name), so a swapped pair fails. */
const undoHalf = (page: Page) => halves(page).nth(0);
const redoHalf = (page: Page) => halves(page).nth(1);
/** the accounting control's own live region — role=status, never the CRM's */
const liveRegion = (page: Page) => page.locator('div.toast-wrap[role="status"]');
const liveText = (page: Page) => liveRegion(page).locator("p");
/** the month's figure for a pending row */
const pendingTile = (page: Page) =>
  page.locator(".tile", { hasText: "Pending (still receivable)" }).locator(".tile-value");

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(l: Locator): Promise<Box> {
  const b = await l.boundingBox();
  if (!b) throw new Error("no layout box — the element is not on the page");
  return b;
}

/** do two horizontal spans overlap at all */
const sameColumn = (a: Box, b: Box) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0;

const position = (l: Locator) => l.evaluate((el) => getComputedStyle(el).position);

/** the accessible name of whatever holds focus. Read as a name rather than as a
    boolean so that a focus failure SAYS which half the keyboard was left on. */
const focusedName = (page: Page) =>
  page.evaluate(
    () =>
      document.activeElement?.getAttribute("aria-label") ??
      document.activeElement?.tagName ??
      "nothing",
  );

/* Every test signs a fresh context in, so the accounts must exist before the
   first one runs — and tests 1 and 7 need histories nothing else has touched. */
test.describe.configure({ mode: "serial" });

/* ========================================================================== 1
   THE PAIR IS NOT PERMANENT FURNITURE. This is the decision that stops an
   always-lit Redo teaching people to distrust it, so it gets a test of its own:
   an administrator who has never written a line in these books sees NO control
   at all — not a greyed one, not a half of one. */
test("a clean history renders no pair at all — not even a quiet Redo", async ({ page, browser }) => {
  await loginAsFounder(page);
  await createAdmin(page, ALPHA);
  await createAdmin(page, BETA);

  const ctx = await browser.newContext();
  const fresh = await ctx.newPage();
  await login(fresh, ALPHA.email, PASSWORD, /\/b-systems$/);

  /* the module dashboard */
  await fresh.goto(`/accounting?company=${COMPANY}`);
  await expect(fresh.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(pairOf(fresh)).toHaveCount(0);
  await expect(fresh.getByRole("group", { name: EN.group })).toHaveCount(0);

  /* and a month-scoped page, which is where the writing happens. The figure
     tile proves the page really rendered, so "count 0" is the control's
     absence and not a blank screen. */
  await fresh.goto(INCOME);
  await expect(pendingTile(fresh)).toBeVisible();
  await expect(pairOf(fresh)).toHaveCount(0);
  await expect(fresh.getByRole("button", { name: EN.nothingToRedo })).toHaveCount(0);
  await expect(fresh.getByRole("button", { name: EN.nothingToUndo })).toHaveCount(0);
  /* nor the live region, which is mounted BY the control */
  await expect(liveRegion(fresh)).toHaveCount(0);

  await ctx.close();
});

/* ========================================================================== 2
   THE HAPPY PATH, END TO END — and the three things only a browser can show:
   the row leaves the page with no reload, the pair flips from the server, and
   the keyboard gets its place back. */
test("the pair appears, names the action, undoes without a reload, and flips in place", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Income";
  const WHAT = `${EN.addedIncome}: ${NAME}`;
  await addIncome(page, NAME, "500");
  const row = page.locator("tr", { hasText: NAME });
  await expect(pendingTile(page)).toHaveText("EGP 500");

  /* ---- the control arrived with the action, and SAYS WHAT IT WILL REVERSE */
  await expect(pairOf(page)).toBeVisible();
  await expect(page.getByRole("group", { name: EN.group })).toBeVisible();
  await expect(halves(page)).toHaveCount(2);
  await expect(undoHalf(page)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);
  await expect(undoHalf(page)).toHaveAttribute("title", `${EN.undo}: ${WHAT}`);
  /* never a bare arrow: the drawing is hidden from the name, and the founder's
     two choices are the control's accessible DESCRIPTION */
  await expect(undoHalf(page).locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(undoHalf(page)).toHaveAccessibleDescription(EN.scope);
  await expect(undoHalf(page).locator(".acct-ur-verb")).toHaveText(EN.undo);
  await expect(undoHalf(page).locator(".acct-ur-what")).toHaveText(WHAT);
  /* the quiet side is there, unavailable, and explains itself */
  await expect(redoHalf(page)).toHaveAccessibleName(EN.nothingToRedo);
  await expect(redoHalf(page)).toHaveAttribute("aria-disabled", "true");
  /* the live region is mounted BEFORE anything has happened (a region that
     appears with its first message is announced unreliably) */
  await expect(liveRegion(page)).toHaveAttribute("aria-live", "polite");
  await expect(liveRegion(page)).toHaveAttribute("aria-atomic", "true");
  await expect(liveText(page)).toHaveCount(0);

  /* ---- the geometry, before the press */
  const groupBefore = await boxOf(pairOf(page));
  const undoBefore = await boxOf(undoHalf(page));
  const redoBefore = await boxOf(redoHalf(page));
  expect(Math.abs(redoBefore.y - undoBefore.y)).toBeLessThanOrEqual(1); // one row
  expect(redoBefore.x).toBeGreaterThan(undoBefore.x); // undo at the inline start
  await expect(page.locator(".page-head > .page-actions > :first-child")).toHaveClass(/acct-ur/);

  /* a stamp on the window: a full reload would wipe it, so if it survives the
     press then the row left the page through router.refresh() and nothing else */
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__urAlive = "yes";
  });

  /* ---- PRESS UNDO ---------------------------------------------------------- */
  await undoHalf(page).click();

  /* the row is gone from the page with no navigation of any kind */
  await expect(row).toHaveCount(0);
  await expect(pendingTile(page)).toHaveText("EGP 0");
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__urAlive)).toBe(
    "yes",
  );
  expect(page.url()).toContain(INCOME.split("?")[0]);

  /* the announcement, in the region that was already mounted. Containment, not
     equality: the toast carries a decorative "!" which is aria-hidden, so the
     sentence below is exactly what a screen reader reads out and the glyph is
     exactly what it does not. */
  await expect(liveText(page)).toContainText(`Undone: ${WHAT}`);
  await expect(liveText(page).locator(".toast-icon")).toHaveAttribute("aria-hidden", "true");
  await expect(liveText(page)).toHaveClass(/toast--ok/);

  /* ---- THE FLIP: undo quiet, redo lit, BOTH still there, same place -------- */
  await expect(halves(page)).toHaveCount(2);
  await expect(undoHalf(page)).toHaveAccessibleName(EN.nothingToUndo);
  await expect(undoHalf(page)).toHaveAttribute("aria-disabled", "true");
  await expect(redoHalf(page)).toHaveAccessibleName(`${EN.redo}: ${WHAT}`);
  expect(await redoHalf(page).getAttribute("aria-disabled")).toBeNull();

  const groupAfter = await boxOf(pairOf(page));
  const redoAfter = await boxOf(redoHalf(page));
  const undoAfter = await boxOf(undoHalf(page));
  /* IN THE SAME PLACE. Nothing was hidden, so nothing reflowed: the pair keeps
     its line and its height, both halves keep theirs, and the Redo that just
     lit up occupies the column it was already sitting in. */
  expect(Math.abs(groupAfter.y - groupBefore.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(groupAfter.height - groupBefore.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(redoAfter.y - redoBefore.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(redoAfter.height - redoBefore.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(undoAfter.y - undoBefore.y)).toBeLessThanOrEqual(1);
  expect(sameColumn(redoAfter, redoBefore)).toBe(true);
  expect(redoAfter.x).toBeGreaterThan(undoAfter.x); // still undo-then-redo
  await expect(page.locator(".page-head > .page-actions > :first-child")).toHaveClass(/acct-ur/);

  /* THE KEYBOARD, as far as this test goes: the in-flight `disabled` blurs the
     pressed button, and focus comes back INSIDE the pair rather than being
     dropped on <body>. WHICH half it comes back to is a separate claim, and the
     browser does not bear it out — see the last test in this file. */
  await expect(pairOf(page).locator(":focus")).toHaveCount(1);

  /* ---- PRESS REDO: the record comes back and the pair flips again ---------- */
  await redoHalf(page).click();
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("EGP 500");
  await expect(pendingTile(page)).toHaveText("EGP 500");
  await expect(liveText(page)).toContainText(`Redone: ${WHAT}`);
  await expect(undoHalf(page)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);
  await expect(redoHalf(page)).toHaveAccessibleName(EN.nothingToRedo);
  await expect(redoHalf(page)).toHaveAttribute("aria-disabled", "true");
  /* and again: focus is still somewhere in the pair, not on <body> */
  await expect(pairOf(page).locator(":focus")).toHaveCount(1);

  await deleteIncome(page, NAME);
});

/* ========================================================================== 3
   TOGGLE IT THREE TIMES. The counter-entry is fingerprinted against the state
   the previous application wrote, so toggling must not drift — and a drift here
   is a money bug, so the row, the row's own figure and the month's total are
   all read at every stop. */
test("three full toggles, with the page and the figures right at every stop", async ({ page }) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Toggle";
  const WHAT = `${EN.addedIncome}: ${NAME}`;
  await addIncome(page, NAME, "700");
  const row = page.locator("tr", { hasText: NAME });

  const there = async (stop: string) => {
    await expect(row, stop).toHaveCount(1);
    await expect(row, stop).toContainText("EGP 700");
    await expect(pendingTile(page), stop).toHaveText("EGP 700");
    await expect(undoHalf(page), stop).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);
    await expect(redoHalf(page), stop).toHaveAccessibleName(EN.nothingToRedo);
  };
  const gone = async (stop: string) => {
    await expect(row, stop).toHaveCount(0);
    await expect(pendingTile(page), stop).toHaveText("EGP 0");
    await expect(page.getByText("No income recorded for this month."), stop).toBeVisible();
    await expect(undoHalf(page), stop).toHaveAccessibleName(EN.nothingToUndo);
    await expect(redoHalf(page), stop).toHaveAccessibleName(`${EN.redo}: ${WHAT}`);
  };

  await there("stop 0 — booked");
  for (const n of [1, 2, 3]) {
    await undoHalf(page).click();
    await expect(liveText(page)).toContainText(`Undone: ${WHAT}`);
    await gone(`stop ${n}a — undone`);

    await redoHalf(page).click();
    await expect(liveText(page)).toContainText(`Redone: ${WHAT}`);
    await there(`stop ${n}b — redone`);
  }

  /* and the truth survives a real page load, not just the refreshed DOM */
  await page.goto(INCOME);
  await expect(row).toHaveCount(1);
  await expect(pendingTile(page)).toHaveText("EGP 700");

  await deleteIncome(page, NAME);
});

/* ========================================================================== 4
   THE QUIET HALF IS REACHABLE BY KEYBOARD — the whole reason it carries
   `aria-disabled` instead of `disabled`. And the second half of that same
   decision: `disabled` is reserved for the in-flight moment, where a second
   press must not land. */
test("the quiet half keeps its place in the tab order, and `disabled` is kept for in flight", async ({
  page,
}) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Keys";
  const WHAT = `${EN.addedIncome}: ${NAME}`;
  await addIncome(page, NAME, "100");

  /* ---- TAB REACHES THE SIDE WITH NOTHING ON OFFER ------------------------- */
  await undoHalf(page).focus();
  await expect(undoHalf(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(redoHalf(page)).toBeFocused();
  /* focusable, and it says WHY it cannot be pressed — the explanation a real
     `disabled` would have hidden from exactly the people who need it */
  await expect(redoHalf(page)).toHaveAccessibleName(EN.nothingToRedo);
  await expect(redoHalf(page)).toHaveAttribute("aria-disabled", "true");
  expect(await redoHalf(page).getAttribute("disabled")).toBeNull();
  expect(await redoHalf(page).evaluate((el) => (el as HTMLButtonElement).disabled)).toBe(false);
  await expect(redoHalf(page)).toHaveAccessibleDescription(EN.scope);
  /* and back again: it is a real stop in the order, not a one-way trap */
  await page.keyboard.press("Shift+Tab");
  await expect(undoHalf(page)).toBeFocused();

  /* pressing it does nothing at all — no request, no announcement, no error.
     The presses are driven at the element rather than through locator.click():
     Playwright reads aria-disabled as disabled and would wait for the button to
     become "enabled" until it timed out — which is itself a small proof that
     the attribute is doing the job the real `disabled` was kept out of. */
  let posted = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/accounting\/(undo|redo)$/.test(r.url())) posted += 1;
  });
  await redoHalf(page).focus();
  await expect(redoHalf(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await redoHalf(page).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(liveText(page)).toHaveCount(0);
  await expect(undoHalf(page)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);
  expect(posted).toBe(0);

  /* ---- IN FLIGHT: the real `disabled`, on BOTH halves, and the verb says so.
     The response is held open so the state is readable rather than raced. */
  await page.route("**/api/accounting/undo", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await undoHalf(page).click();
  await expect(undoHalf(page).locator(".acct-ur-verb")).toHaveText(EN.undoing);
  /* the real DOM property, not just an attribute spelling */
  const reallyDisabled = (half: Locator) =>
    half.evaluate((el) => (el as HTMLButtonElement).disabled);
  await expect.poll(() => reallyDisabled(undoHalf(page))).toBe(true);
  await expect.poll(() => reallyDisabled(redoHalf(page))).toBe(true);
  /* the in-flight half drops its description: the verb carries the state */
  await expect(undoHalf(page).locator(".acct-ur-what")).toHaveCount(0);

  /* and it settles into the flip */
  await expect(liveText(page)).toContainText(`Undone: ${WHAT}`);
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(0);
  await page.unroute("**/api/accounting/undo");
  expect(await reallyDisabled(undoHalf(page))).toBe(false);
  expect(posted).toBe(1);

  await redoHalf(page).click();
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(1);
  await deleteIncome(page, NAME);
});

/* ========================================================================== 5
   A DOUBLE-CLICK APPLIES ONCE. Two clicks dispatched inside one frame share the
   handler's closure, so the React state alone is not a guarantee — the belt is
   a ref. What must not happen on a money screen is the second press producing a
   second effect, OR a false error telling a bookkeeper something went wrong
   when his one click landed exactly once. */
test("two clicks in one tick apply once — one request, one effect, no false error", async ({
  page,
}) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Twice";
  const WHAT = `${EN.addedIncome}: ${NAME}`;
  await addIncome(page, NAME, "900");
  await expect(pendingTile(page)).toHaveText("EGP 900");

  let posted = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/accounting\/undo$/.test(r.url())) posted += 1;
  });

  /* both clicks in ONE tick — not two awaited clicks, which would be two ticks */
  await undoHalf(page).evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });

  /* ONE application: one request, the figure moved one step, one announcement */
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(0);
  await expect(pendingTile(page)).toHaveText("EGP 0");
  await expect(liveText(page)).toContainText(`Undone: ${WHAT}`);
  await expect(liveText(page)).toHaveClass(/toast--ok/);
  /* and NOT the sentence a second landed press would have produced */
  await expect(liveRegion(page)).not.toContainText(EN.applied);
  await expect(liveRegion(page)).not.toContainText(EN.generic);
  expect(posted).toBe(1);

  /* the stack is intact, not spent twice: one redo brings back exactly one row */
  await redoHalf(page).click();
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(1);
  await expect(pendingTile(page)).toHaveText("EGP 900");

  await deleteIncome(page, NAME);
});

/* ========================================================================== 6
   A REFUSAL EXPLAINS ITSELF HONESTLY. A real changed-since: the row is edited
   BY SOMEBODY ELSE through the real UI (which is the only way to change it
   without retiring the author's own offer — every accounting mutation retires
   the actor's stack, so an edit by the same hand would simply replace the
   offer). The founder's account does the editing; UR Alpha then presses Undo.

   What must come back is "this record changed, nothing was touched" — and
   crucially NOT "already applied", which would tell him his click landed twice
   when in truth it never landed at all. */
test("somebody else edits the row first — the refusal says so, and touches nothing", async ({
  page,
  browser,
}) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Contested";
  const WHAT = `${EN.addedIncome}: ${NAME}`;
  await addIncome(page, NAME, "1234");
  await expect(undoHalf(page)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);

  /* ---- the colleague's edit, through the real modal ----------------------- */
  const ctx = await browser.newContext();
  const founder = await ctx.newPage();
  await loginAsFounder(founder);
  await founder.goto(INCOME);
  const theirs = founder.locator("tr", { hasText: NAME });
  await expect(theirs).toHaveCount(1);
  await theirs.getByRole("button", { name: "Edit", exact: true }).click();
  const modal = founder.locator(".modal");
  await modal.getByLabel("Amount (EGP)").fill("4321");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  await expect(theirs).toContainText("EGP 4,321");
  await ctx.close();

  /* ---- and now the author presses Undo ------------------------------------ */
  await undoHalf(page).click();

  /* the honest sentence, and NOT any of the near misses */
  await expect(liveText(page)).toContainText(EN.changed);
  await expect(liveText(page)).not.toHaveClass(/toast--ok/);
  await expect(liveRegion(page)).not.toContainText(EN.applied);
  await expect(liveRegion(page)).not.toContainText(EN.generic);
  /* no English server prose leaked onto the screen */
  await expect(liveRegion(page)).not.toContainText("fingerprint");

  /* NOTHING WAS TOUCHED: the row is still there, still carrying the colleague's
     amount, and the month's figure is his and not the author's */
  const row = page.locator("tr", { hasText: NAME });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("EGP 4,321");
  await expect(pendingTile(page)).toHaveText("EGP 4,321");
  await page.goto(INCOME); // from the server, not the refreshed DOM
  await expect(page.locator("tr", { hasText: NAME })).toContainText("EGP 4,321");
  /* the offer was not spent either — a refused step is not a consumed one */
  await expect(undoHalf(page)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);

  await deleteIncome(page, NAME);
});

/* ========================================================================== 7
   PERSONAL SCOPE, IN THE BROWSER. UR Beta has never written in these books. He
   can see the money — the books are shared — and he is offered nothing, because
   the offer belongs to the person who made the entry. */
test("one admin's action is not on offer to another admin", async ({ page, browser }) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Mine";
  const WHAT = `${EN.addedIncome}: ${NAME}`;
  await addIncome(page, NAME, "321");
  await expect(undoHalf(page)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await login(other, BETA.email, PASSWORD, /\/b-systems$/);
  await other.goto(INCOME);

  /* he sees the ROW … */
  await expect(other.locator("tr", { hasText: NAME })).toHaveCount(1);
  await expect(pendingTile(other)).toHaveText("EGP 321");
  /* … and no control whatsoever: not a quiet half, not a stale Redo */
  await expect(pairOf(other)).toHaveCount(0);
  await expect(other.getByRole("group", { name: EN.group })).toHaveCount(0);
  await expect(other.getByRole("button", { name: new RegExp(NAME) })).toHaveCount(0);
  await expect(other.getByRole("button", { name: EN.nothingToUndo })).toHaveCount(0);
  /* the module dashboard tells him the same thing */
  await other.goto(`/accounting?company=${COMPANY}`);
  await expect(other.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(pairOf(other)).toHaveCount(0);
  await ctx.close();

  /* and the author's own offer is untouched by any of that */
  await page.reload();
  await expect(undoHalf(page)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);

  await deleteIncome(page, NAME);
});

/* ========================================================================== 8
   IT DOES NOT COLLIDE WITH THE CRM'S OWN UNDO. ADR-045's pill is mounted by
   this very shell (`<UndoControl/>` in the accounting layout), so "the two do
   not collide" is a claim about one screen that can hold both — and this test
   lights each of them on that screen in turn. */
test("an accounting action never lights the CRM's pill, which lives somewhere else entirely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Pill";
  await addIncome(page, NAME, "150");

  /* ---- the accounting pair is lit; the CRM pill is DARK on the same page --- */
  await expect(pairOf(page)).toBeVisible();
  await expect(page.locator(".undo-fab")).toHaveCount(0);
  const pairBox = await boxOf(pairOf(page));
  expect(await position(pairOf(page))).not.toBe("fixed"); // it is page chrome
  await expect(page.locator(".page-head > .page-actions > .acct-ur")).toHaveCount(1);
  await expect(page.locator(".undo-fab .acct-ur")).toHaveCount(0);

  /* nor does the accounting pair leak out of its module */
  await page.goto("/b-systems/crm");
  await expect(page.locator(".undo-fab")).toHaveCount(0);
  await expect(pairOf(page)).toHaveCount(0);

  /* ---- now a CRM action too, so BOTH stacks are live at the same time. That
     is the real collision case: two controls, two kinds, two endpoints, two
     tables — and `recordUndo` retires nothing, so neither offer can quietly
     stand in for the other. */
  const made = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "UR Pill Lead",
      number: "0107775099",
      type: "cold_call",
      companyName: "UR Pill Co",
    },
  });
  expect(made.status()).toBe(201);
  const { id } = (await made.json()) as { id: string };
  expect((await page.request.post(`/api/b-systems/leads/${id}/no-answer`, { data: { value: true } })).ok()).toBe(
    true,
  );

  await page.goto(INCOME);
  const fab = page.locator(".undo-fab");
  const WHAT = `${EN.undo}: ${EN.addedIncome}: ${NAME}`;
  await expect(fab).toBeVisible(); // the pill DOES render on an accounting page
  await expect(pairOf(page)).toBeVisible(); // beside the money pair, not instead
  /* and each names ITS OWN action — the pill is not offering the money entry */
  await expect(undoHalf(page)).toHaveAccessibleName(WHAT);
  await expect(fab).not.toContainText(NAME);
  await expect(fab.getByRole("button", { name: /^Undo:/ })).toBeVisible();
  await expect(fab.locator(".acct-ur-btn")).toHaveCount(0);

  /* A DIFFERENT ELEMENT IN A DIFFERENT PLACE: page chrome at the top, beside
     the title, versus a snackbar pinned to the bottom of the viewport. */
  const fabBox = await boxOf(fab);
  expect(await position(fab)).toBe("fixed");
  expect(fabBox.y).toBeGreaterThan(pairBox.y + pairBox.height);

  /* ---- and pressing the PILL leaves the money stack alone: performUndo
     retires the CRM's kinds only, because killing the accounting offer here
     would take the founder's button away for a reason no screen explains */
  await fab.getByRole("button", { name: /^Undo:/ }).click();
  await expect(fab).toHaveCount(0);
  await expect(undoHalf(page)).toHaveAccessibleName(WHAT);
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(1);
  /* the accounting live region never spoke — that press was not its press */
  await expect(liveText(page)).toHaveCount(0);

  /* clean up: the lead goes, the money row goes */
  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  await page.goto(INCOME);
  await deleteIncome(page, NAME);
});

/* ========================================================================== 9
   BOTH LANGUAGES. Arabic is half this product's usage, and the two glyphs are
   each other's mirror — so direction is the ONLY thing telling undo from redo,
   and an undo arrow pointing the reading-forward way is a real defect. */
test("in Arabic the pair carries Arabic names, mirrors its arrows, and still applies", async ({
  page,
}) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Arabic";
  await addIncome(page, NAME, "250");

  /* ---- the English baseline, so the mirror below means something ---------- */
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  const glyph = (half: Locator) => half.locator("svg.acct-ur-icon");
  expect(await glyph(undoHalf(page)).evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  /* the two halves draw DIFFERENT arrows (the mirror pair, not one glyph twice) */
  const undoPath = await undoHalf(page).locator("svg path").first().getAttribute("d");
  const redoPath = await redoHalf(page).locator("svg path").first().getAttribute("d");
  expect(undoPath).toBe("M3.4 6.4a5.2 5.2 0 1 1-.7 3.3");
  expect(redoPath).toBe("M12.6 6.4a5.2 5.2 0 1 0 .7 3.3");

  /* ---- flip the app to Arabic from the module's own header ---------------- */
  await page.locator(".app-header .user").getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");

  const AR_WHAT = `${AR.addedIncome}: ${NAME}`;
  await expect(undoHalf(page)).toHaveAccessibleName(`${AR.undoPrefix} ${AR_WHAT}`);
  await expect(undoHalf(page).locator(".acct-ur-verb")).toHaveText(AR.undo);
  await expect(redoHalf(page)).toHaveAccessibleName(AR.nothingToRedo);
  await expect(redoHalf(page)).toHaveAttribute("aria-disabled", "true");

  /* the arrows mirror, so "back" still points backwards in a right-to-left
     line — and the undo half is still the inline-START one, which in RTL is on
     the right of the screen */
  expect(await glyph(undoHalf(page)).evaluate((el) => getComputedStyle(el).transform)).toBe(
    "matrix(-1, 0, 0, 1, 0, 0)",
  );
  expect(await glyph(redoHalf(page)).evaluate((el) => getComputedStyle(el).transform)).toBe(
    "matrix(-1, 0, 0, 1, 0, 0)",
  );
  const undoBox = await boxOf(undoHalf(page));
  const redoBox = await boxOf(redoHalf(page));
  expect(undoBox.x).toBeGreaterThan(redoBox.x);

  /* ---- and it WORKS in Arabic, with the Arabic sentence announced --------- */
  await undoHalf(page).click();
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(0);
  await expect(liveText(page)).toContainText(`${AR.undonePrefix} ${AR_WHAT}`);
  await expect(redoHalf(page)).toHaveAccessibleName(`إعادة تنفيذ: ${AR_WHAT}`);

  await redoHalf(page).click();
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(1);
  await expect(liveText(page)).toContainText(`${AR.redonePrefix} ${AR_WHAT}`);

  /* ---- the Arabic delete sentence, read not assumed ----------------------- */
  let said = "";
  page.once("dialog", (d) => {
    said = d.message();
    void d.accept();
  });
  await page.locator("tr", { hasText: NAME }).getByRole("button", { name: "حذف", exact: true }).click();
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(0);
  expect(said).toBe(AR.deleteConfirm);

  /* back to English for whatever runs next */
  await page.locator(".app-header .user").getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

/* ========================================================================= 10
   THE REWORDED DELETE CONFIRM. This dialog used to say money records cannot be
   undone, and the moment this feature shipped that sentence became false on
   every accounting delete. It is the one string a bookkeeper reads before
   destroying a money row, so it is READ here — and then the promise it makes is
   held to: the row really does come back. */
test("the delete confirm now promises the undo, and the promise is kept", async ({ page }) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Delete";
  await addIncome(page, NAME, "60");
  await expect(pendingTile(page)).toHaveText("EGP 60");

  const said = await deleteIncome(page, NAME);
  expect(said).toBe(EN.deleteConfirm);
  expect(said).not.toContain("cannot be undone");
  await expect(pendingTile(page)).toHaveText("EGP 0");

  /* the sentence's promise, kept: the delete is on offer and puts the row back */
  const WHAT = `${EN.deletedIncome}: ${NAME}`;
  await expect(undoHalf(page)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);
  await undoHalf(page).click();
  await expect(liveText(page)).toContainText(`Undone: ${WHAT}`);
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(1);
  await expect(pendingTile(page)).toHaveText("EGP 60");

  /* and away again, for good */
  expect(await deleteIncome(page, NAME)).toBe(EN.deleteConfirm);
  await expect(pendingTile(page)).toHaveText("EGP 0");
});

/* ====================================================================== 10.5
   THE STALE OFFER — the refusal a real bookkeeper is most likely to meet, and
   the one the refusal codes exist for. Two tabs of the SAME session both show
   the same offer; one spends it, and the other presses what is no longer there.
   It must read "no longer available", NOT "already applied": nothing of this
   press landed, and telling him it landed twice is the near miss ADR-086 was
   written about. */
test("a tab whose offer has already been spent is refused honestly, not told it landed twice", async ({
  page,
  context,
}) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Stale";
  const WHAT = `${EN.addedIncome}: ${NAME}`;
  await addIncome(page, NAME, "40");

  /* a second tab, same session, same offer on screen */
  const second = await context.newPage();
  await second.goto(INCOME);
  await expect(undoHalf(second)).toHaveAccessibleName(`${EN.undo}: ${WHAT}`);

  /* the first tab spends it */
  await undoHalf(page).click();
  await expect(liveText(page)).toContainText(`Undone: ${WHAT}`);
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(0);

  /* and the second tab presses an offer that is gone */
  await undoHalf(second).click();
  await expect(liveText(second)).toContainText(EN.noLonger);
  await expect(liveText(second)).not.toHaveClass(/toast--ok/);
  await expect(liveRegion(second)).not.toContainText(EN.applied);
  await expect(liveRegion(second)).not.toContainText(EN.generic);
  /* and the sentence told the truth about itself: the page DID refresh, so the
     stale tab now shows the undo that really happened */
  await expect(second.locator("tr", { hasText: NAME })).toHaveCount(0);
  await expect(redoHalf(second)).toHaveAccessibleName(`${EN.redo}: ${WHAT}`);
  await second.close();

  /* nothing was applied twice: one redo brings back exactly one row */
  await redoHalf(page).click();
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(1);
  await expect(pendingTile(page)).toHaveText("EGP 40");

  await deleteIncome(page, NAME);
});

/* ========================================================================= 11
   THE FOCUS RESTORATION — the one claim in this feature that a real browser
   does not bear out. It is LAST and alone on purpose: serial mode skips
   everything after a failure, and the ten facts above must stay provable while
   this one is red. Nothing is cleaned up after it because there is nothing to
   clean — the row it books is undone before the assertion is reached.

   WHAT THE CONTROL SAYS IT DOES (AcctUndoRedoButtons, the effect at `busy`):
   "once the request settles, put focus on the half that was pressed if it is
   still there, and otherwise on its partner — which, after a successful undo,
   is the Redo that just lit up in the same place."

   WHY THE PARTNER BRANCH CANNOT BE REACHED. `pressed.current` is cleared on the
   FIRST settle, and the first settle is the `setBusy(null)` render — which
   happens a server round trip BEFORE `router.refresh()` delivers the new
   `undoWhat`/`redoWhat`. At that moment the pressed half still carries its old
   LIVE label, so `mine.getAttribute("aria-disabled") !== "true"` holds and the
   pressed half is focused. When the refresh lands and that half goes quiet, the
   effect does re-run — `undoWhat`/`redoWhat` are in its deps for exactly this
   reason — but `pressed.current` is already null, so it returns at
   `if (!was) return` and focus is never moved.

   THE COST, in the keyboard's terms: focus is not lost (the quiet half is
   aria-disabled rather than disabled, so it keeps both its place in the order
   and the name that explains itself), but after pressing Undo the keyboard is
   left on "Nothing to undo", and the Redo that lit up in the same place is one
   Tab away. No money consequence; a real accessibility gap on a money screen,
   and the reason this file exists rather than a source-reading test. */
test("after a press, focus lands on the half that is still live", async ({ page }) => {
  await login(page, ALPHA.email, PASSWORD, /\/b-systems$/);
  await page.goto(INCOME);

  const NAME = "E2E UR Focus";
  const WHAT = `${EN.addedIncome}: ${NAME}`;
  await addIncome(page, NAME, "80");

  /* a real keyboard press, not a mouse click */
  await undoHalf(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("tr", { hasText: NAME })).toHaveCount(0);
  await expect(redoHalf(page)).toHaveAccessibleName(`${EN.redo}: ${WHAT}`);

  /* this much is true: the keyboard is still inside the control */
  await expect(pairOf(page).locator(":focus")).toHaveCount(1);
  /* and this is the claim — the half that is still live should hold it */
  await expect
    .poll(() => focusedName(page), { message: "the keyboard's place after the undo" })
    .toBe(`${EN.redo}: ${WHAT}`);
});
