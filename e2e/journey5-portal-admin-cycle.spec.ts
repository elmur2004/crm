import { expect, test, type Locator, type Page } from "@playwright/test";

/* V2 journey 5 — Admin win cycle on the unified pipeline:
   Home shows agent/partner counts → drag an agent's lead to Won opens the
   MILESTONE TAB (value, % commission, per-milestone name/value/commission) →
   Won Leads card + detail → checking Milestone 1 feeds Statements' "Waiting to
   be paid out" → Generate → Create (coded ST-####) → agent's Payments shows it
   pending → Mark paid with a proof image → agent sees Paid + proof + commission
   on their won lead. Two live sessions (admin + agent). */

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(512, 3),
]);

async function dragTo(page: Page, card: Locator, column: Locator) {
  /* the columns scroll INTERNALLY (.col-cards caps at 62vh), so a card far down
     a busy column is laid out below its own column's visible box. Bring it into
     view first — exactly what a person does before grabbing it — which scrolls
     the COLUMN, not the page, so the drop target below stays where it is. */
  /* ADR-072 — the board is EIGHT columns wide now, and that broke this drag in
     the two ways prospect-pipeline.spec already documented when ADR-059 widened
     ITS board:

     1. Scroll BOTH ends into view before measuring, or `page.mouse` — which
        speaks VIEWPORT coordinates — aims at a column past the fold, gets
        clamped at the edge, and drops on whatever sits there. Column first,
        then the card (whose own scroll moves the COLUMN's internal scroller,
        not the page, so it cannot undo the horizontal one).

     2. Re-aim at the column's LIVE box each time, because the travel itself
        auto-scrolls the board — measuring once at the start aims at where the
        column WAS.

     What this deliberately does NOT do is compensate for the grab offset the
     way prospect-pipeline.spec does. That spec's board scores collisions on the
     dragged card's rect; this one follows the POINTER, so shifting the aim by
     half a card width to match the middle-right grab overshoots by a whole
     column — tried, and it dropped a win into Lost. The pointer goes at the
     column's centre, exactly as it always did; only the scrolling was missing. */
  /* CENTRE the target, do not merely reveal it. `scrollIntoViewIfNeeded`
     scrolls the MINIMUM distance, which parks the column against the viewport
     edge — precisely where dnd-kit's auto-scroll keeps firing, so the board goes
     on moving between the last pointer move and the mouse-up and the card is
     released over the NEXT column. That is how a win landed in Lost. */
  await column.evaluate((el) => el.scrollIntoView({ inline: "center", block: "nearest" }));
  await card.scrollIntoViewIfNeeded();
  const cardBox = (await card.boundingBox())!;
  /* grab middle-right — clear of the link and the ready-to-close button */
  const gripX = cardBox.x + cardBox.width - 10;
  const gripY = cardBox.y + cardBox.height / 2;
  const aim = async () => {
    const to = (await column.boundingBox())!;
    return { x: to.x + to.width / 2, y: to.y + 60 };
  };
  await page.mouse.move(gripX, gripY);
  await page.mouse.down();
  await page.mouse.move(gripX, gripY + 12, { steps: 4 });
  const first = await aim();
  await page.mouse.move(first.x, first.y, { steps: 14 });
  /* CONVERGE. The travel itself auto-scrolls, so one re-measure is not enough:
     keep re-aiming at the column's LIVE box until it stops moving between two
     readings, and only then release. Bounded, so a genuinely stuck board fails
     as a timeout rather than looping. */
  let previousX = Number.NaN;
  for (let i = 0; i < 8; i++) {
    const box = (await column.boundingBox())!;
    if (Math.abs(box.x - previousX) < 1) break;
    previousX = box.x;
    await page.mouse.move(box.x + box.width / 2, box.y + 60, { steps: 2 });
  }
  await page.mouse.up();
}

test("journey 5: admin confirms a win with milestones; statement reaches the agent's payments", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const agentContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const agent = await agentContext.newPage();

  /* Admin home (V2 §2.1): agent/partner counts + the external pipeline chart. */
  await admin.goto("/login");
  await admin.getByLabel("Email or phone").fill("admin@byteforce.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin).toHaveURL(/\/b-systems$/);
  await expect(admin.getByRole("main").getByText("Agents", { exact: true })).toBeVisible();
  await expect(admin.getByText("Agent & partner pipeline")).toBeVisible();

  /* The seeded agent lead "Fresh Deal" sits in New — drag it to Won. */
  await admin.goto("/b-systems/crm");
  await dragTo(
    admin,
    admin.locator('[data-deal-card="Fresh Deal"]'),
    admin.locator('[data-stage="won"]'),
  );

  /* V2 §4 — the confirm-win milestone tab: value, % commission, milestones. */
  await expect(admin.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await admin.getByLabel("Estimated value (EGP)").fill("10000");
  await admin.getByLabel("Total commission (%)").fill("10");
  await admin.getByPlaceholder("Milestone 1").fill("Alpha");
  await admin.getByPlaceholder("Milestone 2").fill("Beta");
  await admin.getByPlaceholder("Milestone 3").fill("Gamma");
  const values = admin.getByLabel("Value (EGP)", { exact: true });
  await values.nth(0).fill("4000");
  await values.nth(1).fill("3500");
  await values.nth(2).fill("2500");
  const commissions = admin.getByLabel("Closer's commission (EGP)");
  await commissions.nth(0).fill("400");
  await commissions.nth(1).fill("350");
  await commissions.nth(2).fill("250");
  await admin.getByRole("button", { name: "Confirm move" }).click();
  await expect(admin.locator('[data-stage="won"]').getByText("Fresh Deal")).toBeVisible();

  /* Won Leads: the card shows name, value, closer, milestone checks (V2 §2.4). */
  await admin.goto("/b-systems/won-leads");
  const wonCard = admin.getByRole("link", { name: /Fresh Deal/ });
  await expect(wonCard).toBeVisible();
  await expect(wonCard.getByText("EGP 10,000")).toBeVisible();
  await expect(wonCard.getByText("Karim Adel")).toBeVisible();
  await wonCard.click();

  /* Detail: milestones + sequential checking — M1 first. */
  await expect(admin.getByText("Alpha")).toBeVisible();
  /* controlled input: click, then await the round-tripped state */
  await admin.getByLabel("Milestone completed: Alpha").click();
  await expect(admin.getByLabel("Milestone completed: Alpha")).toBeChecked({ timeout: 10_000 });

  /* Statements (V2 §7): the checked milestone waits; Generate → Create. */
  await admin.goto("/b-systems/statements");
  const waitingRow = admin.getByRole("row", { name: /Alpha/ });
  await expect(waitingRow.getByText("Karim Adel")).toBeVisible();
  await expect(waitingRow.getByText("EGP 400")).toBeVisible();
  await waitingRow.getByRole("button", { name: "Generate" }).click();
  await expect(admin.getByText("New statement — Alpha")).toBeVisible();
  await expect(admin.getByLabel("Amount (EGP)")).toHaveValue("400");
  await admin.getByLabel("Expected payment date").fill("2026-10-15");
  await admin.getByRole("button", { name: "Create statement" }).click();
  await expect(admin.getByText("ST-0001")).toBeVisible();

  /* Agent session: the statement arrives in Payments as PENDING (V2 §7). */
  await agent.goto("/login");
  await agent.getByLabel("Email or phone").fill("01001234567");
  await agent.getByLabel("Password").fill("partner123");
  await agent.getByRole("button", { name: "Sign in" }).click();
  /* `waitForURL`, not a 5s `toHaveURL`: this is a NAVIGATION after a server
     round trip, and every other sign-in in the suite waits for it that way. The
     assertion is identical — the landing must be the agent's board — but the
     expect timeout was never the right clock for it, and it started tipping as
     the suite grew. */
  await agent.waitForURL(/\/b-systems\/crm$/);
  await agent.goto("/b-systems/payments");
  const paymentRow = agent.getByRole("row", { name: /ST-0001/ });
  await expect(paymentRow.getByText("Pending")).toBeVisible();
  await expect(paymentRow.getByText("EGP 400")).toBeVisible();

  /* Admin marks it paid with the proof IMAGE (replaces a payment reference). */
  const statementRow = admin.getByRole("row", { name: /ST-0001/ });
  await statementRow
    .locator('input[type="file"]')
    .setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: PNG });
  await statementRow.getByRole("button", { name: "Mark paid" }).click();
  await expect(statementRow.getByText("Paid")).toBeVisible();
  await expect(statementRow.getByRole("link", { name: "proof" })).toBeVisible();

  /* Agent: Paid + proof link; the won lead card shows the commission (V2 §4). */
  await agent.reload();
  await expect(agent.getByRole("row", { name: /ST-0001/ }).getByText(/Paid/)).toBeVisible();
  await expect(
    agent.getByRole("row", { name: /ST-0001/ }).getByRole("link", { name: "proof" }),
  ).toBeVisible();
  await agent.goto("/b-systems/won-leads");
  await expect(agent.getByText("Fresh Deal")).toBeVisible();
  /* money tile: label and value are separate elements (design §2.16) */
  await expect(agent.getByText("Total commission:").first()).toBeVisible();
  await expect(agent.getByText("10%", { exact: true }).first()).toBeVisible();
  await expect(agent.getByText("✓ Alpha")).toBeVisible();

  await adminContext.close();
  await agentContext.close();
});
