import { expect, test, type Locator, type Page } from "@playwright/test";

/* ADR-059 — founder, section 1, and his answer to the scope question:
   "Same stages for both."

   ONE board, seven columns, both kinds of card:

     Lead | Contacted | Didn't Answer | Meeting Setting | Waiting | Qualified | Lost

   These tests cover what only the live page can prove — the single board and its
   column order, that Contacted and Waiting open no modal at all, that a Waiting
   card is fully editable and moves out in both directions, the Kind filter
   filtering CARDS rather than boards, the one toast slot, and the Arabic pass. */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

async function dragTo(page: Page, card: Locator, column: Locator) {
  /* seven columns are taller and wider than six: scroll BOTH ends into view
     before measuring, or page.mouse (viewport coordinates) grabs air.

     And aim so that the CARD lands centred on the target column, not the
     POINTER: dnd-kit scores the collision on the dragged card's rect, and the
     grip sits at the card's inline-start edge, so pointing at the column centre
     leaves the card straddling its neighbour — which is how a drop meant for
     Contacted landed in Lead. */
  await column.scrollIntoViewIfNeeded();
  await card.scrollIntoViewIfNeeded();
  const cardBox = (await card.boundingBox())!;
  const from = (await card.locator(".bcard-grip").boundingBox())!;
  const gripX = from.x + from.width / 2;
  const gripY = from.y + from.height / 2;
  const offsetX = gripX - (cardBox.x + cardBox.width / 2);
  const offsetY = gripY - (cardBox.y + cardBox.height / 2);
  const aim = async () => {
    const to = (await column.boundingBox())!;
    return { x: to.x + to.width / 2 + offsetX, y: to.y + 40 + cardBox.height / 2 + offsetY };
  };
  await page.mouse.move(gripX, gripY);
  await page.mouse.down();
  await page.mouse.move(gripX, gripY + 12, { steps: 4 });
  const first = await aim();
  await page.mouse.move(first.x, first.y, { steps: 14 });
  const settled = await aim();
  await page.mouse.move(settled.x, settled.y, { steps: 2 });
  await page.mouse.up();
}

const columnTitles = (page: Page) => page.locator(".board .col-title").allTextContents();

/** a To-Do row, scoped to the list — the Undo button also names the card. */
const todoRow = (page: Page, title: string) =>
  page.getByRole("listitem").filter({ hasText: title });

const EN_COLUMNS = [
  "Lead",
  "Contacted",
  "Didn't Answer",
  "Meeting Setting",
  "Waiting",
  "Qualified",
  "Lost",
];

/* seven 218px columns + gaps is ~1598px, wider than the default 1280 viewport,
   so the right-hand columns sit outside it and page.mouse — which works in
   VIEWPORT coordinates — could never reach them. Give the drag tests a board
   that fits. */
test.describe("one board, whole board visible", () => {
  test.use({ viewport: { width: 1800, height: 1000 } });

  test("ONE board carries both kinds, in the founder's column order", async ({ page }) => {
    await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

    const agentRes = await page.request.post("/api/b-systems/partners-pipeline", {
      data: { kind: "agent", name: "Shared Board Agent", number: "01077700011" },
    });
    expect(agentRes.status()).toBe(201);
    const agentId = ((await agentRes.json()) as { id: string }).id;
    const partnerRes = await page.request.post("/api/b-systems/partners-pipeline", {
      data: {
        kind: "partner",
        name: "Shared Contact",
        companyName: "Shared Board Partners Co",
        number: "0105557711",
        businessActivity: "HR company",
      },
    });
    expect(partnerRes.status()).toBe(201);
    const partnerId = ((await partnerRes.json()) as { id: string }).id;

    await page.goto("/b-systems/partners-pipeline");

    /* ONE board — the stacked arrangement and its two headings are gone */
    await expect(page.locator(".board")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: "Partners", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Agents", exact: true })).toHaveCount(0);
    expect(await columnTitles(page)).toEqual(EN_COLUMNS);
    /* the retired vocabulary has no column anywhere on the page */
    await expect(page.locator('[data-stage="following_up"]')).toHaveCount(0);
    await expect(page.locator('[data-stage="won"]')).toHaveCount(0);

    /* both cards live on it, each still wearing its kind */
    const inColumn = (stage: string, title: string) =>
      page.locator(`[data-stage="${stage}"] [data-deal-card="${title}"]`);
    const agentCard = page.locator('[data-deal-card="Shared Board Agent"]');
    const partnerCard = page.locator('[data-deal-card="Shared Board Partners Co"]');
    await expect(agentCard).toHaveAttribute("data-kind", "agent");
    await expect(partnerCard).toHaveAttribute("data-kind", "partner");
    await expect(agentCard.locator(".bcard-tag")).toHaveText("Agent");
    await expect(partnerCard.locator(".bcard-tag")).toHaveText("Partner");

    /* Every drag below crosses SEVERAL columns on purpose. dnd-kit scores the
       collision on the dragged CARD's rect, not the pointer, so a drop one
       column over can still overlap the source more than the target and
       register as a no-op — the panel covers the adjacent moves instead. */

    /* founder 1.1 — a drag into Waiting asks NOTHING, for either kind */
    for (const [card, title] of [
      [agentCard, "Shared Board Agent"],
      [partnerCard, "Shared Board Partners Co"],
    ] as const) {
      await dragTo(page, card, page.locator('[data-stage="waiting"]'));
      await expect(page.locator(".modal")).toHaveCount(0);
      await expect(inColumn("waiting", title)).toBeVisible();
    }

    /* founder 1.2 — and neither does a drag into Contacted, for either kind.
       Waiting also proves it moves out again, backwards (founder 1.1). */
    for (const [card, title] of [
      [agentCard, "Shared Board Agent"],
      [partnerCard, "Shared Board Partners Co"],
    ] as const) {
      await dragTo(page, card, page.locator('[data-stage="contacted"]'));
      await expect(page.locator(".modal")).toHaveCount(0);
      await expect(inColumn("contacted", title)).toBeVisible();
    }

    /* a target that DOES own a group still opens its form */
    await dragTo(page, partnerCard, page.locator('[data-stage="didnt_answer"]'));
    await expect(page.getByText("Number dialed — which number(s) went unanswered?")).toBeVisible();
    await page.getByRole("button", { name: "Confirm move" }).click();
    await expect(inColumn("didnt_answer", "Shared Board Partners Co")).toBeVisible();

    expect((await page.request.delete(`/api/b-systems/partners-pipeline/${agentId}`)).ok()).toBe(true);
    expect((await page.request.delete(`/api/b-systems/partners-pipeline/${partnerId}`)).ok()).toBe(
      true,
    );
  });

  /* SPEC 10.2 PP-6 vs PP-4 - the ONE board judges each drop with the DRAGGED
     CARD's config, never with a hardcoded one. An agent's Qualified is "no field
     group, no credentials, no account: a pure stage move" (founder 1.3), so it
     must commit ON THE DROP; a partner's Qualified still opens the 7.2
     completeness gate. Asking the partner config on an agent's behalf produces
     a confirmation modal with NO fields in it - reviewer finding, Run 061. */
  test("PP-6: an agent drags into Qualified with no modal; PP-4 still gates the partner", async ({
    page,
  }) => {
    await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

    const agentRes = await page.request.post("/api/b-systems/partners-pipeline", {
      data: { kind: "agent", name: "Straight To Qualified", number: "01077700077" },
    });
    expect(agentRes.status()).toBe(201);
    const agentId = ((await agentRes.json()) as { id: string }).id;
    const partnerRes = await page.request.post("/api/b-systems/partners-pipeline", {
      data: {
        kind: "partner",
        name: "Gate Contact",
        companyName: "Gate Keeper Co",
        number: "0105557733",
        businessActivity: "HR company",
      },
    });
    expect(partnerRes.status()).toBe(201);
    const partnerId = ((await partnerRes.json()) as { id: string }).id;

    await page.goto("/b-systems/partners-pipeline");
    const qualified = page.locator('[data-stage="qualified"]');

    await dragTo(page, page.locator('[data-deal-card="Straight To Qualified"]'), qualified);
    await expect(page.locator(".modal")).toHaveCount(0);
    const landed = qualified.locator('[data-deal-card="Straight To Qualified"]');
    await expect(landed).toBeVisible();
    /* 7.2b - the card carries the STATE: qualified, and a login still owed */
    await expect(landed.getByText("No login yet")).toBeVisible();

    /* the same state on the PARTNER half: the seeded directory partner is
       converted at qualification but has no login until an admin mints one */
    await expect(
      qualified.locator('[data-deal-card="Alexandria Trading House"]').getByText("No login yet"),
    ).toBeVisible();

    /* and the partner's own Qualified still asks the completeness gate */
    await dragTo(page, page.locator('[data-deal-card="Gate Keeper Co"]'), qualified);
    const modal = page.locator(".modal");
    await expect(modal).toHaveCount(1);
    await expect(modal.getByLabel("Key person name")).toBeVisible();
    await expect(modal.getByLabel("Importance")).toBeVisible();
    /* never credentials (founder 1.3) */
    await expect(modal.getByLabel("Password")).toHaveCount(0);
    await modal.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator('[data-stage="lead"] [data-deal-card="Gate Keeper Co"]')).toBeVisible();

    expect((await page.request.delete(`/api/b-systems/partners-pipeline/${agentId}`)).ok()).toBe(
      true,
    );
    expect((await page.request.delete(`/api/b-systems/partners-pipeline/${partnerId}`)).ok()).toBe(
      true,
    );
  });

  test("ONE toast slot: both kinds share the same terminal sentence", async ({ page }) => {
    await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
    await page.goto("/b-systems/partners-pipeline");

    /* `.toast-wrap` is position:fixed at one coordinate. Both drags are rejected
       client-side — nothing is written, so this is safe on the shared serial
       database. A column well clear of Lost: dnd-kit scores collisions on the
       dragged CARD's rect, not the pointer. */
    const lostPartner = page.locator('[data-stage="lost"] [data-deal-card="Luxor Analytics"]');
    await expect(lostPartner).toBeVisible();
    await dragTo(page, lostPartner, page.locator('[data-stage="didnt_answer"]'));
    await expect(page.locator(".toast")).toHaveCount(1);
    await expect(page.locator(".toast")).toContainText(
      "Qualified and Lost cards can no longer be moved.",
    );

    const lostAgent = page.locator('[data-stage="lost"] [data-deal-card="Amr Shaker"]');
    await expect(lostAgent).toBeVisible();
    await dragTo(page, lostAgent, page.locator('[data-stage="didnt_answer"]'));
    await expect(page.locator(".toast")).toHaveCount(1);
    await expect(page.locator(".toast")).toContainText(
      "Qualified and Lost cards can no longer be moved.",
    );
    /* the old partner sentence names a column that no longer exists */
    await expect(page.locator(".toast")).not.toContainText("Won and Lost");

    /* neither card moved */
    await expect(lostPartner).toBeVisible();
    await expect(lostAgent).toBeVisible();
  });
});

test("the Kind filter filters CARDS, not boards", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  for (const kind of ["agent", "partner"] as const) {
    await page.goto(`/b-systems/partners-pipeline?kind=${kind}`);
    /* still ONE board, still the same seven columns — only the cards narrow */
    await expect(page.locator(".board")).toHaveCount(1);
    expect(await columnTitles(page)).toEqual(EN_COLUMNS);
    await expect(page.locator(`[data-deal-card][data-kind="${kind}"]`).first()).toBeVisible();
    const other = kind === "agent" ? "partner" : "agent";
    await expect(page.locator(`[data-deal-card][data-kind="${other}"]`)).toHaveCount(0);
  }
});

test("a filtered-empty board says why, and never claims a kind has no cards", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/partners-pipeline?q=nothing-matches-this-string");
  await expect(page.getByText("No cards match these filters.")).toBeVisible();
  await expect(page.locator(".board")).toHaveCount(0);
  /* the retired per-section empty states must never render again */
  await expect(page.getByText("No partner cards yet.")).toHaveCount(0);
  await expect(page.getByText("No agent cards yet.")).toHaveCount(0);

  /* a search only an AGENT matches still renders the one board, intact */
  await page.goto("/b-systems/partners-pipeline?q=Amr+Shaker");
  await expect(page.locator(".board")).toHaveCount(1);
  expect(await columnTitles(page)).toEqual(EN_COLUMNS);
  await expect(page.locator('[data-deal-card="Amr Shaker"]')).toBeVisible();
});

/* founder 1.1 — "Leads in Waiting must remain fully editable at any time." */
test("a card in Waiting is fully editable and can leave in both directions", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const created = await page.request.post("/api/b-systems/partners-pipeline", {
    data: {
      kind: "partner",
      name: "Waiting Contact",
      companyName: "Waiting Room Co",
      number: "0105550909",
      businessActivity: "HR company",
    },
  });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;

  await page.goto(`/b-systems/partners-pipeline/${id}`);
  /* into Waiting from the panel: no fields at all, straight to Save & move */
  await page.getByLabel("Next action").selectOption("waiting");
  await expect(page.getByLabel("Follow-up date")).toHaveCount(0);
  await expect(page.getByLabel("Reason (required)")).toHaveCount(0);
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Waiting")).toBeVisible();

  /* FULLY EDITABLE: the panel still works, Edit still opens, the value sticks */
  await expect(page.getByText(/no further actions/)).toHaveCount(0);
  await expect(page.getByLabel("Next action")).toBeEnabled();
  await page.getByRole("button", { name: "Edit" }).click();
  const editModal = page.locator(".modal");
  await editModal.getByLabel("Company name").fill("Waiting Room Intl");
  await editModal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1 }).getByText("Waiting Room Intl"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Waiting")).toBeVisible();
  /* the alternative-number form is live here too — nothing is locked */
  await expect(page.getByLabel("New number 1")).toBeEnabled();

  /* out again, BACKWARDS, with no form */
  await page.getByLabel("Next action").selectOption("contacted");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Contacted")).toBeVisible();

  /* and the column is painted, not transparent — the Waiting token resolved */
  await page.goto("/b-systems/partners-pipeline");
  await expect(page.locator('[data-stage-key="waiting"]').first()).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );

  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${id}`)).ok()).toBe(true);
});

/* founder 2.1 — "Contacted should only indicate that contact has been made
   unless an actual Follow Up task is required." */
test("Contacted is not a Follow Up task until someone records one", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const created = await page.request.post("/api/b-systems/partners-pipeline", {
    data: { kind: "agent", name: "Quiet Contact", number: "01066600099" },
  });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;

  await page.goto(`/b-systems/partners-pipeline/${id}`);
  /* the move asks for nothing — no follow-up date, no method */
  await page.getByLabel("Next action").selectOption("contacted");
  await expect(page.getByLabel("Follow-up date")).toHaveCount(0);
  await expect(page.getByLabel("Method")).toHaveCount(0);
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Contacted")).toBeVisible();

  await page.goto("/b-systems/todo");
  /* scoped to the LIST: the Undo button in the corner also names the card */
  await expect(todoRow(page, "Quiet Contact")).toHaveCount(0);

  /* now record an ACTUAL follow-up, due today in Cairo */
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  await page.goto(`/b-systems/partners-pipeline/${id}`);
  await page.getByRole("button", { name: "Record a follow-up" }).click();
  await page.getByLabel("Follow-up date").fill(today);
  await page.getByLabel("Follow-up time").fill("10:00");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Save record" }).click();
  /* the card never moved */
  await expect(page.getByRole("heading", { level: 1 }).getByText("Contacted")).toBeVisible();

  await page.goto("/b-systems/todo");
  const row = todoRow(page, "Quiet Contact");
  await expect(row).toHaveCount(1);
  await expect(row.getByText("Partner or agent follow-up")).toBeVisible();

  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${id}`)).ok()).toBe(true);
});

test("Arabic: one board, seven columns, right to left", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/partners-pipeline");
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await expect(page.locator(".board")).toHaveCount(1);
  expect(await columnTitles(page)).toEqual([
    "عميل محتمل",
    "تم التواصل",
    "لم يرد",
    "تحديد اجتماع",
    "قيد الانتظار",
    "مؤهَّل",
    "خسارة",
  ]);

  /* the founder's order is the READING order in both languages: in RTL the
     first column sits to the RIGHT of the last */
  const cols = page.locator(".board .col");
  const first = (await cols.first().boundingBox())!;
  const last = (await cols.last().boundingBox())!;
  expect(first.x).toBeGreaterThan(last.x);

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(await columnTitles(page)).toEqual(EN_COLUMNS);
});
