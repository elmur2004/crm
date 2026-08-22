import { expect, test, type Locator, type Page } from "@playwright/test";

/* ADR-052 Phase 2 — the accounting module end-to-end:
   (1) admin books a month: income + expense, approves it, watches the
       dashboard numbers move (cash basis + the approval gate, in the UI);
   (2) founder decision 5: the Media Buying tab does not exist under the
       B-Systems company filter, and its URL bounces to the dashboard;
   (3) the one-time import: upload a tiny fixture export, read back the
       derived reconciliation totals, see them on the dashboard;
   (4) the 403 matrix: every accounting route refuses sales, agent and
       data-entry sessions (partner accounts are provisioned mid-flow, not
       seeded — the identical requireBsAdmin wall refuses them by the same
       role list, proven here through three live non-admin roles). */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const cairoMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()); // "YYYY-MM"

test("admin books income + expense, approves it, and the dashboard moves", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* the nav item exists and lands on the dashboard */
  await page.goto("/accounting");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  /* ---- income: 4,321 EGP collected today (cash basis: lands this month) */
  await page.goto("/accounting/income");
  await page.getByRole("button", { name: "+ Add income" }).click();
  const modal = page.locator(".modal");
  await modal.getByLabel("Client name").fill("E2E Client");
  await modal.getByLabel("Amount (EGP)").fill("4321");
  await modal.getByLabel("Status").selectOption("true"); // Collected
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator("tr", { hasText: "E2E Client" }).getByText("Collected", { exact: true })).toBeVisible();

  /* ---- expense: 1,111 EGP, stays ON HOLD — must not touch cash yet */
  await page.goto("/accounting/expenses");
  await page.getByRole("button", { name: "+ Add expense" }).click();
  await modal.getByLabel("Name / payee").fill("E2E Hosting");
  await modal.getByLabel("Amount (EGP)").fill("1111");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  const row = page.locator("tr", { hasText: "E2E Hosting" });
  await expect(row.getByText("On hold", { exact: true })).toBeVisible();

  /* ---- dashboard: income counted, expense only in "to be paid", net = income */
  await page.goto("/accounting");
  await expect(page.getByText("EGP 4,321").first()).toBeVisible(); // collected + net
  await expect(page.getByText("EGP 1,111").first()).toBeVisible(); // on hold tile

  /* ---- approve the expense — NOW it hits cash */
  await page.goto("/accounting/expenses");
  await row.locator("button").first().click(); // the ✓ approve toggle
  await expect(row.getByText("Paid", { exact: true })).toBeVisible();

  await page.goto("/accounting");
  await expect(page.getByText("EGP 3,210").first()).toBeVisible(); // 4,321 − 1,111
});

/* Founder, by screenshot of the row action buttons: "when I click on the right
   sign it becomes green" — the ✓ now CARRIES the row's state, so the buttons
   column shows at a glance which rows are approved, and clicking a green one
   puts the row back on hold / pending. Proven on all three row kinds (manual
   expense, income, and the AUTO payroll row from the roster — the kind in the
   screenshot) and in BOTH directions.

   Asserted through aria-pressed + the state class, never a sampled colour —
   except once, under the OTHER brand, where the resolved paint IS the point
   (see there). The accessible NAME is fixed ("Collected" / "Paid") because
   aria-pressed carries the state; the flipping action wording lives in the
   title, and both are asserted.

   Money isolation: every row here is booked into a far-future month (2099-01)
   so no other test's absolute figures move. One honest caveat — the ✓ stamps
   the collection with TODAY's date, so between a click and its un-click an
   income row's cash sits in the CURRENT month by design (that is the cash
   basis, and the "moves back" case below leans on it deliberately). Every row
   ends un-settled, and the suite is serial (workers: 1) with this test after
   the absolute-total one. */
const SETTLED = /row-toggle--acct-settled/;
const FUTURE = "2099-01";
/* how the CSS-wide keyword `transparent` serializes out of getComputedStyle —
   the value a background falls back to when its var() resolves to nothing. Not
   a colour choice, so not a brand-token violation. */
const NO_PAINT = "rgba(0, 0, 0, 0)";

/* .row-toggle fades background-color over .15s (design-system.css §"transition"),
   so a single sample taken the instant the settled class lands catches the fade
   half way and serialises as rgba(230, 244, 236, 0.93) — a different value every
   run. The settled tint is OPAQUE, so poll until the paint has stopped moving.
   A scope that never declares the pair stays "rgba(0, 0, 0, 0)", which is not an
   rgb() either, so the missing-token failure this sampling exists to catch still
   fails — it just fails as a timeout instead of a mismatch. */
async function settledPaint(toggle: Locator): Promise<string> {
  await expect
    .poll(() => toggle.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toMatch(/^rgb\(/);
  return toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
}

test("the row ✓ turns green while the row is settled — and back again", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const modal = page.locator(".modal");

  /* ---- income: book a PENDING row; its ✓ must start un-settled */
  await page.goto(`/accounting/income?company=byteforce&month=${FUTURE}`);
  await page.getByRole("button", { name: "+ Add income" }).click();
  await modal.getByLabel("Client name").fill("Green Check Client");
  await modal.getByLabel("Amount (EGP)").fill("250");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();

  const incomeRow = page.locator("tr", { hasText: "Green Check Client" });
  await expect(incomeRow.getByText("Pending", { exact: true })).toBeVisible();
  /* ONE locator across the round trip: the accessible name is the STATE and
     never flips (WAI-ARIA APG for toggle buttons) — the action wording moves
     with the state in the title instead. */
  const collect = incomeRow.getByRole("button", { name: "Collected", exact: true });
  await expect(collect).toHaveAttribute("aria-pressed", "false");
  await expect(collect).toHaveAttribute("title", "Mark collected");
  await expect(collect).not.toHaveClass(SETTLED);

  /* click → the chip says Collected AND the button reports it */
  await collect.click();
  await expect(incomeRow.getByText("Collected", { exact: true })).toBeVisible();
  await expect(collect).toHaveAttribute("aria-pressed", "true");
  await expect(collect).toHaveAttribute("title", "Mark pending");
  await expect(collect).toHaveClass(SETTLED);

  /* the settled green actually PAINTS: the rule spends --color-acct-positive-tint
     through a bare var(), so a scope that fails to declare the pair leaves the
     background transparent. Kept for the cross-brand comparison at the end. */
  const settledBg = await settledPaint(collect);
  expect(settledBg).not.toBe(NO_PAINT);

  /* click again → both cues clear (the round trip, not just the way in) */
  await collect.click();
  await expect(incomeRow.getByText("Pending", { exact: true })).toBeVisible();
  await expect(collect).toHaveAttribute("aria-pressed", "false");
  await expect(collect).not.toHaveClass(SETTLED);

  /* ---- the round trip from the OTHER month the row shows in. Income is
     cash-basis: a collected row ALSO lists under the month its cash landed in.
     Un-settling it there clears that cash, so the row correctly LEAVES that
     month and is pending again under its own — that is the deliberate answer to
     "click a green ✓ and it goes back". Holding the row in the view instead
     would leave an uncollected amount, and its Pending receivable, in a month
     it does not belong to. */
  await collect.click();
  await expect(incomeRow.getByText("Collected", { exact: true })).toBeVisible();

  await page.goto(`/accounting/income?company=byteforce&month=${cairoMonth()}`);
  const cashRow = page.locator("tr", { hasText: "Green Check Client" });
  const cashToggle = cashRow.getByRole("button", { name: "Collected", exact: true });
  await expect(cashToggle).toHaveClass(SETTLED); // green on the cash month too
  await cashToggle.click();
  await expect(cashRow).toHaveCount(0); // the cash left the month, so did the row

  await page.goto(`/accounting/income?company=byteforce&month=${FUTURE}`);
  await expect(incomeRow.getByText("Pending", { exact: true })).toBeVisible();
  await expect(incomeRow.getByRole("button", { name: "Collected", exact: true })).not.toHaveClass(
    SETTLED,
  );

  /* ---- expenses: the same round trip on a manual row */
  await page.goto(`/accounting/expenses?company=byteforce&month=${FUTURE}`);
  await page.getByRole("button", { name: "+ Add expense" }).click();
  await modal.getByLabel("Name / payee").fill("Green Check Hosting");
  await modal.getByLabel("Amount (EGP)").fill("120");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();

  const expenseRow = page.locator("tr", { hasText: "Green Check Hosting" });
  await expect(expenseRow.getByText("On hold", { exact: true })).toBeVisible();
  const approve = expenseRow.getByRole("button", { name: "Paid", exact: true });
  await expect(approve).toHaveAttribute("aria-pressed", "false");
  await expect(approve).toHaveAttribute("title", "Approve / mark paid");
  await expect(approve).not.toHaveClass(SETTLED);

  await approve.click();
  await expect(expenseRow.getByText("Paid", { exact: true })).toBeVisible();
  await expect(approve).toHaveAttribute("aria-pressed", "true");
  await expect(approve).toHaveAttribute("title", "Mark on hold");
  await expect(approve).toHaveClass(SETTLED);

  await approve.click();
  await expect(expenseRow.getByText("On hold", { exact: true })).toBeVisible();
  await expect(approve).toHaveAttribute("aria-pressed", "false");
  await expect(approve).not.toHaveClass(SETTLED);

  /* ---- the AUTO payroll row (founder's screenshot): derived from the roster,
     its only other control is "Adjust this month only" (ADR-060 removed the
     old roster shortcut) — same treatment, same toggle */
  await page.goto(`/accounting/roster?company=byteforce&month=${FUTURE}`);
  await page.getByRole("button", { name: "+ Add person" }).click();
  await modal.getByLabel("Name", { exact: true }).fill("Green Check Payroll");
  await modal.getByLabel("Monthly salary (EGP)").fill("300");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();

  await page.goto(`/accounting/expenses?company=byteforce&month=${FUTURE}`);
  const autoRow = page.locator("tr", { hasText: "Green Check Payroll" });
  await expect(autoRow.getByText("from roster", { exact: true })).toBeVisible(); // the derived badge
  const autoApprove = autoRow.getByRole("button", { name: "Paid", exact: true });
  await expect(autoApprove).toHaveAttribute("aria-pressed", "false");
  await expect(autoApprove).not.toHaveClass(SETTLED);

  await autoApprove.click();
  await expect(autoRow.getByText("Paid", { exact: true })).toBeVisible();
  await expect(autoApprove).toHaveAttribute("aria-pressed", "true");
  await expect(autoApprove).toHaveClass(SETTLED);

  await autoApprove.click();
  await expect(autoRow.getByText("On hold", { exact: true })).toBeVisible();
  await expect(autoApprove).toHaveAttribute("aria-pressed", "false");
  await expect(autoApprove).not.toHaveClass(SETTLED);

  /* ---- and the green reads the same under the OTHER brand: the module
     re-stamps [data-brand] per company. The state CLASS proves nothing about
     brands (one React branch sets it either way), so this leg samples the PAINT
     and compares it with the ByteForce one above. The token-parity guard proper
     is src/lib/brand-tokens.test.ts, which reads the accounting pair out of
     each of the three brand SCOPES — the B-Systems file declared it inside
     `.bs-mesh`, not in its brand scope, until Run 058. */
  await page.goto(`/accounting/income?company=bsystems&month=${FUTURE}`);
  await page.getByRole("button", { name: "+ Add income" }).click();
  await modal.getByLabel("Client name").fill("Green Check B-Systems");
  await modal.getByLabel("Amount (EGP)").fill("90");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('div[data-brand="bsystems"]')).toBeVisible();

  const bsRow = page.locator("tr", { hasText: "Green Check B-Systems" });
  const bsToggle = bsRow.getByRole("button", { name: "Collected", exact: true });
  await bsToggle.click();
  await expect(bsRow.getByText("Collected", { exact: true })).toBeVisible();
  await expect(bsToggle).toHaveClass(SETTLED);
  const bsBg = await settledPaint(bsToggle);
  expect(bsBg).not.toBe(NO_PAINT);
  expect(bsBg).toBe(settledBg);
  await bsToggle.click();
  await expect(bsToggle).not.toHaveClass(SETTLED);
});

/* ADR-058 — the founder: "when I edit an expense of the type of payroll and it
   is being edited it doesn't automatically edit in the actual payroll roster
   because it can be because of a deduction or something". A deduction or a
   bonus could only ever arrive through an IMPORT of the old app's file — the
   expense form had no field for either, in this app OR the original. Booked in
   its own far-future month so no absolute total elsewhere moves. */
const ADJ = "2098-06";

test("a payroll expense carries a deduction and a bonus, and the row shows its maths", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const modal = page.locator(".modal");
  await page.goto(`/accounting/expenses?company=byteforce&month=${ADJ}`);

  /* the two fields belong to PAYROLL only — a rent row must never carry them */
  await page.getByRole("button", { name: "+ Add expense" }).click();
  await expect(modal.getByLabel("Deduction (EGP, optional)")).toHaveCount(0);
  await expect(modal.getByLabel("Bonus (EGP, optional)")).toHaveCount(0);

  await modal.getByLabel("Type").selectOption("payroll");
  await expect(modal.getByLabel("Deduction (EGP, optional)")).toBeVisible();
  await modal.getByLabel("Name / payee").fill("Adjusted Salary");
  await modal.getByLabel("Amount (EGP)").fill("5000");
  await modal.getByLabel("Deduction (EGP, optional)").fill("200");
  await modal.getByLabel("Bonus (EGP, optional)").fill("50");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();

  /* the NET is the headline number, and the row EXPLAINS it rather than
     silently showing a figure that disagrees with the salary */
  const row = page.locator("tr", { hasText: "Adjusted Salary" });
  await expect(row).toContainText("EGP 4,850"); // 5,000 − 200 + 50
  await expect(row).toContainText("Base EGP 5,000");
  await expect(row).toContainText("deduction EGP 200");
  await expect(row).toContainText("bonus EGP 50");
  /* and the section total is the NET, not the base */
  await expect(page.getByText("−EGP 4,850").first()).toBeVisible();

  /* REOPENING must PREFILL both — resolveExpenseData writes them on every
     PATCH now, so a modal that forgot to prefill would silently zero them */
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(modal.getByLabel("Deduction (EGP, optional)")).toHaveValue("200");
  await expect(modal.getByLabel("Bonus (EGP, optional)")).toHaveValue("50");

  /* a deduction bigger than salary + bonus is refused BY THE SERVER: a negative
     net would turn an expense into income */
  await modal.getByLabel("Deduction (EGP, optional)").fill("99999");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(
    modal.getByText("A deduction cannot be larger than the salary plus the bonus."),
  ).toBeVisible();
  await expect(modal).toBeVisible(); // nothing saved, the modal held the input

  /* CLEARING the field stores null, not 0 — the row drops the deduction line */
  await modal.getByLabel("Deduction (EGP, optional)").fill("");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  await expect(row).toContainText("EGP 5,050");
  await expect(row).toContainText("bonus EGP 50");
  await expect(row).not.toContainText("deduction");

  page.once("dialog", (d) => void d.accept());
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
});

/* ADR-058 + ADR-060 — THE TWO PAYROLL PATHS, from the founder's chair. A real
   salary change is made ONLY on the Payroll Roster page (from this month
   FORWARD) — the expense row no longer links there; "Adjust this month only"
   changes this month and nothing else. Its own far-future month + its own
   person, so no absolute figure asserted anywhere else can move. */
const ONE = "2097-05";
const NEXT_ONE = "2097-06";

test("a month-only payroll adjustment leaves the roster, and every other month, alone", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const modal = page.locator(".modal");

  /* a person on the roster at 5,000 EGP in Branding, from that month */
  await page.goto(`/accounting/roster?company=byteforce&month=${ONE}`);
  await page.getByRole("button", { name: "+ Add person" }).click();
  await modal.getByLabel("Name", { exact: true }).fill("One Month Only");
  await modal.getByLabel("Department").selectOption("branding");
  await modal.getByLabel("Monthly salary (EGP)").fill("5000");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();

  /* ---- ADR-060: the derived row offers ONLY the month-only path. The old
     "Edit in roster" shortcut is gone — a salary can never be edited from the
     expenses screen — and the badge's hint says where the salary lives. */
  await page.goto(`/accounting/expenses?company=byteforce&month=${ONE}`);
  const row = page.locator("tr", { hasText: "One Month Only" });
  const badge = row.getByText("from roster", { exact: true });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("title", /open Payroll Roster/);
  await expect(row.getByRole("link", { name: "Edit in roster" })).toHaveCount(0);
  const adjust = row.getByRole("button", { name: "Adjust this month only" });
  await expect(adjust).toBeVisible();
  /* the consequence is in the hint, not just the label */
  await expect(adjust).toHaveAttribute("title", /THIS MONTH ONLY/);
  /* a derived row is never stored, so it still offers no Edit and no Delete */
  await expect(row.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  /* the legitimate path is NOT lost: the module nav still reaches the roster */
  await expect(page.getByRole("link", { name: "Payroll Roster" })).toBeVisible();

  /* approve the derived salary FIRST: the paid state is the thing that must
     not flip silently when the row becomes an override */
  await row.getByRole("button", { name: "Paid", exact: true }).click();
  await expect(row.getByText("Paid", { exact: true })).toBeVisible();
  await expect(page.getByText("EGP 5,000").first()).toBeVisible(); // Paid this month

  /* ---- the prefilled modal */
  await adjust.click();
  await expect(modal.locator(".modal-title")).toHaveText("Adjust this month only");
  /* the modal SAYS which path you are in, and names the person and the month */
  const banner = modal.locator(".info-banner");
  await expect(banner).toContainText("This month only.");
  await expect(banner).toContainText("One Month Only");
  await expect(banner).toContainText("May 2097");
  await expect(banner).toContainText("roster itself does not change");
  /* the roster pointer is VISIBLE text in the banner — on the row it is only
     the badge's title tooltip, and a title never shows on touch (ADR-060) */
  await expect(banner).toContainText("To change the salary itself, open Payroll Roster.");

  await expect(modal.getByLabel("Amount (EGP)")).toHaveValue("5000");
  await expect(modal.getByLabel("Person (optional)")).toHaveValue(/.+/); // the person
  await expect(modal.getByLabel("Department (optional)")).toHaveValue("branding");
  await expect(modal.getByLabel("Belongs to month")).toHaveValue(ONE);
  /* the two facts the banner STATES are the two the form LOCKS, so the banner
     can never describe a save that lands on another month or another person
     (an approval carried across would ride into a month nobody approved) */
  await expect(modal.getByLabel("Belongs to month")).toBeDisabled();
  await expect(modal.getByLabel("Person (optional)")).toBeDisabled();
  await expect(modal.getByLabel("Deduction (EGP, optional)")).toHaveValue("");
  await expect(modal.getByLabel("Bonus (EGP, optional)")).toHaveValue("");
  /* THE PAID-STATE TRAP: an approved salary must not quietly become On hold */
  await expect(modal.getByLabel("Status")).toHaveValue("true");

  /* a deduction bigger than the salary is refused BY THE SERVER, and nothing
     is created — the derived row is still the only row */
  await modal.getByLabel("Deduction (EGP, optional)").fill("6000");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(
    modal.getByText("A deduction cannot be larger than the salary plus the bonus."),
  ).toBeVisible();

  await modal.getByLabel("Deduction (EGP, optional)").fill("200");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();

  /* ---- the row is now the override: net, shown with its working */
  await expect(row).toContainText("EGP 4,800");
  await expect(row).toContainText("Base EGP 5,000");
  await expect(row).toContainText("deduction EGP 200");
  await expect(row.getByText("from roster", { exact: true })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  /* still approved, and the tile moved by exactly the deduction — never by a
     whole salary, which is what a silently dropped approval would cost */
  await expect(row.getByText("Paid", { exact: true })).toBeVisible();
  await expect(page.getByText("EGP 4,800").first()).toBeVisible();

  /* ---- and a SECOND covering row for the same person-month is refused by the
     server: the derived row is only suppressed ONCE, so two stored rows would
     each count a full salary and pay him twice out of one month */
  await page.getByRole("button", { name: "+ Add expense" }).click();
  await modal.getByLabel("Type").selectOption("payroll");
  await modal.getByLabel("Person (optional)").selectOption({ label: "One Month Only" });
  await modal.getByLabel("Amount (EGP)").fill("5000");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal.getByText(/already has a payroll row/)).toBeVisible();
  await modal.locator("button.btn-ghost").click(); // the foot Cancel, not the ×
  await expect(modal).toBeHidden();
  await expect(page.locator("tr", { hasText: "One Month Only" })).toHaveCount(1);
  await expect(page.getByText("EGP 4,800").first()).toBeVisible(); // still one salary

  /* ---- the roster is untouched. The Roster page reads every person at TODAY
     (it answers "who is on the payroll now"), so this far-future person shows
     there as one row, still starting in its original month — no second
     effective-dated segment was written. The salary itself is proven where it
     is actually in force: the NEXT month below, and the row that comes back
     after the delete. A roster edit would have moved BOTH, because memberAt()
     applies a change from its month FORWARD — which is the whole reason this
     second path exists. */
  await page.goto(`/accounting/roster?company=byteforce&month=${ONE}`);
  const rosterRow = page.locator("tr", { hasText: "One Month Only" });
  await expect(rosterRow).toHaveCount(1);
  await expect(rosterRow).toContainText("May 2097");
  await page.goto(`/accounting/expenses?company=byteforce&month=${NEXT_ONE}`);
  const nextRow = page.locator("tr", { hasText: "One Month Only" });
  await expect(nextRow).toContainText("EGP 5,000");
  await expect(nextRow.getByText("from roster", { exact: true })).toBeVisible();
  await expect(nextRow).not.toContainText("deduction");

  /* ---- REVERTING: delete the override and the roster row comes back for that
     month, carrying its approval with it */
  await page.goto(`/accounting/expenses?company=byteforce&month=${ONE}`);
  page.once("dialog", (d) => void d.accept());
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row.getByText("from roster", { exact: true })).toBeVisible();
  await expect(row).toContainText("EGP 5,000");
  await expect(row).not.toContainText("deduction");
  await expect(row.getByText("Paid", { exact: true })).toBeVisible(); // approval carried
  await expect(page.getByText("EGP 5,000").first()).toBeVisible();

  /* ---- and the other direction: an ON HOLD salary overrides on hold, and
     comes back on hold */
  await row.getByRole("button", { name: "Paid", exact: true }).click();
  await expect(row.getByText("On hold", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Adjust this month only" }).click();
  await expect(modal.getByLabel("Status")).toHaveValue("false");
  await modal.getByLabel("Bonus (EGP, optional)").fill("300");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  await expect(row).toContainText("EGP 5,300");
  await expect(row).toContainText("bonus EGP 300");
  await expect(row.getByText("On hold", { exact: true })).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row.getByText("from roster", { exact: true })).toBeVisible();
  await expect(row.getByText("On hold", { exact: true })).toBeVisible();
  await expect(row).toContainText("EGP 5,000");
});

test("B-Systems company filter hides Media Buying entirely", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* under ByteForce the tab exists — and the module WEARS the ByteForce brand
     (directive D: the shell re-stamps [data-brand] with the company) */
  await page.goto("/accounting?company=byteforce");
  await expect(page.getByRole("link", { name: "Media Buying" })).toBeVisible();
  await expect(page.locator('div[data-brand="byteforce"]')).toBeVisible();
  await expect(page.locator('div[data-brand="bsystems"]')).toHaveCount(0);

  /* under B-Systems it is gone from the strip — and the brand swaps whole */
  await page.goto("/accounting?company=bsystems");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Media Buying" })).toHaveCount(0);
  await expect(page.locator('div[data-brand="bsystems"]')).toBeVisible();

  /* …and the URL itself bounces back to the dashboard */
  await page.goto("/accounting/media?company=bsystems");
  await page.waitForURL(/\/accounting\?company=bsystems/);
});

test("the import screen ingests the old app's export and reports the derived totals", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const M0 = cairoMonth();
  /* a minimal single-company export in the SPA's own shape (EGP integers) */
  const fixture = {
    openingBalance: 100,
    income: [
      {
        id: "a1",
        month: M0,
        type: "invoice",
        client: "Imported Co",
        serviceLine: "web",
        amount: 500,
        note: "",
        collected: true,
        collectedDate: `${M0}-05`,
        paidMonth: M0,
      },
    ],
    expenses: [],
    roster: [],
    treasury: [],
    loans: [],
    mediaLedger: [],
    targets: [],
    payrollPaid: {},
  };

  await page.goto("/accounting/import?company=bsystems");
  await page.locator('input[name="file"]').setInputFiles({
    name: "bsystems-accounting-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Import books" }).click();

  await expect(page.getByText("Imported. Reconcile these totals against the old app:")).toBeVisible();
  await expect(page.getByText("EGP 600").first()).toBeVisible(); // 100 opening + 500 collected

  /* the dashboard under the B-Systems filter shows the imported treasury */
  await page.goto("/accounting?company=bsystems");
  await expect(page.getByText("EGP 600").first()).toBeVisible();
  await expect(page.getByText("Imported Co")).toHaveCount(0); // client names live on their own tab

  /* ---- ADR-054 directive C: the EXPORT beside Import emits the ORIGINAL
     SPA's file — same shape, same money-in-EGP, the SPA's own filename */
  const exported = await page.request.get("/api/accounting/export?company=bsystems");
  expect(exported.ok()).toBeTruthy();
  expect(exported.headers()["content-disposition"]).toMatch(
    /bsystems-accounting-\d{4}-\d{2}-\d{2}\.json/,
  );
  const doc = (await exported.json()) as {
    openingBalance: number;
    income: Array<{ client: string; amount: number }>;
    payrollPaid: Record<string, string>;
  };
  expect(doc.openingBalance).toBe(100);
  expect(doc.income[0]!.client).toBe("Imported Co");
  expect(doc.income[0]!.amount).toBe(500);

  /* the "Export ALL companies" wrapper names both tenants like the SPA's */
  const all = await page.request.get("/api/accounting/export?all=1");
  expect(all.headers()["content-disposition"]).toMatch(/all-companies-\d{4}-\d{2}-\d{2}\.json/);
  const wrapper = (await all.json()) as Record<string, { openingBalance: number }>;
  expect(wrapper["bsystems"]!.openingBalance).toBe(100);
  expect(wrapper["byteforce"]).toBeDefined();

  /* and both Export controls sit beside Import on the screen itself */
  await page.goto("/accounting/import?company=bsystems");
  await expect(page.getByRole("link", { name: "Export ALL companies (JSON)" })).toBeVisible();
});

test("every accounting route refuses non-admin roles (server-side 403 matrix)", async ({
  browser,
}) => {
  const routes: Array<[string, string]> = [
    ["POST", "/api/accounting/income"],
    ["PATCH", "/api/accounting/income/x"],
    ["DELETE", "/api/accounting/income/x?company=byteforce"],
    ["POST", "/api/accounting/expenses"],
    ["PATCH", "/api/accounting/expenses/x"],
    ["DELETE", "/api/accounting/expenses/x?company=byteforce"],
    ["POST", "/api/accounting/payroll-paid"],
    ["POST", "/api/accounting/roster"],
    ["PATCH", "/api/accounting/roster/x"],
    ["DELETE", "/api/accounting/roster/x?company=byteforce"],
    ["POST", "/api/accounting/media"],
    ["POST", "/api/accounting/loans"],
    ["DELETE", "/api/accounting/loans/x?company=byteforce"],
    ["POST", "/api/accounting/loans/x/payments"],
    ["POST", "/api/accounting/treasury"],
    ["PATCH", "/api/accounting/treasury/x"],
    ["DELETE", "/api/accounting/treasury/x?company=byteforce"],
    ["PUT", "/api/accounting/settings"],
    ["POST", "/api/accounting/targets"],
    ["DELETE", "/api/accounting/targets/x?company=byteforce"],
    ["POST", "/api/accounting/import"],
    ["GET", "/api/accounting/export?company=byteforce"], // ADR-054
    ["GET", "/api/accounting/export?all=1"],
  ];

  const sessions: Array<[string, string, RegExp]> = [
    ["omar@b-systems.example", "bsystems123", /\/b-systems\/crm$/], // internal sales
    ["01001234567", "partner123", /\/b-systems\/crm$/], // agent
    ["entry@b-systems.example", "entry123", /\/b-systems\/entry$/], // data entry
  ];

  for (const [identifier, password, landing] of sessions) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, identifier, password, landing);

    for (const [method, url] of routes) {
      const res = await page.request.fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        data: method === "GET" ? undefined : "{}",
      });
      expect(res.status(), `${identifier} ${method} ${url}`).toBe(403);
    }

    /* the PAGES bounce a signed-in non-admin to their own landing, never 500 */
    await page.goto("/accounting");
    await expect(page).not.toHaveURL(/\/accounting/);

    await context.close();
  }
});
