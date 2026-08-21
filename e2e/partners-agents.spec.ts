import { expect, test } from "@playwright/test";

/* Founder: "I want the CRM of the partners to be the CRM of the partners and
   agents... I will create for them a user and a password."

   Journey 3 covers the PARTNER card. This is its sibling for the AGENT card on
   the same board: created with the public signup form's fields (CV included),
   run through the SHARED pipeline (ADR-059 — Lead / Contacted / Didn't Answer /
   Meeting Setting / Waiting / Qualified / Lost), qualified with no credentials
   asked for at all, and only THEN given a login — after which the agent signs in
   with the admin-set credentials and lands on their own CRM, never having
   touched Registrations. */

const PDF = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(4096, 7)]);

test("an agent card runs the shared pipeline, qualifies free, then gets a working login", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/b-systems$/);

  /* The one entry point asks WHICH kind first, then swaps the field set to the
     agent's — the same fields the applicant fills in on the public form. But
     only the NAME and the NUMBER are required here (founder: the admin is
     usually mid-phone-call), so this card is saved with nothing else but a CV. */
  await page.goto("/b-systems/partners-pipeline");
  await page.getByRole("button", { name: "Add partner or agent" }).click();
  await page.getByLabel("What are you adding?").selectOption("agent");
  await page.getByLabel("First name").fill("Mostafa");
  await page.getByLabel("Last name").fill("Kamel");
  await page.getByLabel("Phone number").fill("01044556677");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "mostafa-cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Save card" }).click();

  /* It is a card on the ONE board, told apart by its kind chip. */
  const card = page.locator('[data-deal-card="Mostafa Kamel"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-kind", "agent");
  await expect(card.getByText("Agent")).toBeVisible();

  /* founder 1.2 — Contacted commits immediately: no form, no follow-up. */
  await page.getByRole("link", { name: "Mostafa Kamel" }).click();
  await expect(page.getByText("mostafa-cv.pdf")).toBeVisible(); // the CV rode along
  /* the retired vocabulary is simply not offered any more */
  await expect(page.getByLabel("Next action").getByRole("option", { name: "Won" })).toHaveCount(0);
  await page.getByLabel("Next action").selectOption("contacted");
  await expect(page.getByLabel("Follow-up date")).toHaveCount(0);
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Contacted")).toBeVisible();

  /* founder 1.3 — Qualified asks for nothing: no email, no password, no form. */
  await page.getByLabel("Next action").selectOption("qualified");
  await expect(page.getByText("Qualified creates the agent's account")).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Qualified")).toBeVisible();
  /* terminal, and honest about what it is: qualified, no login yet */
  await expect(page.getByText("This card is Qualified — no further actions.")).toBeVisible();
  await expect(page.getByLabel("Next action")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 }).getByText("No login yet")).toBeVisible();

  /* §7.2b — the account is its own step. What the card has is prefilled, what
     it lacks must be typed, and the credentials are the ADMIN's to set. */
  await page.getByRole("button", { name: "Create the agent's account" }).click();
  const accountModal = page.locator(".modal");
  await expect(accountModal.getByLabel("First name")).toHaveValue("Mostafa");
  await expect(accountModal.getByLabel("Phone number")).toHaveValue("01044556677");
  await expect(accountModal.getByLabel("Speciality")).toHaveValue(""); // never asked on the card
  await accountModal.getByLabel("Address").fill("31 El Merghany, Heliopolis");
  await accountModal.getByLabel("Speciality").fill("Manufacturing ERP");
  await accountModal.getByLabel("Email").fill("mostafa.kamel@example.com");
  await accountModal.getByLabel("Password").fill("agentpass123");
  await accountModal.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Converted")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).getByText("No login yet")).toHaveCount(0);
  await expect(page.getByText(/Agent account created/)).toBeVisible();

  /* They are an AGENT: in the Agents section, never in the Partners directory. */
  await page.goto("/b-systems/agents");
  await expect(page.getByText("Mostafa Kamel")).toBeVisible();
  await page.goto("/b-systems/partners");
  await expect(page.getByText("Mostafa Kamel")).toHaveCount(0);

  /* And they never queued in Registrations — the admin created the account, so
     the approval section knows nothing about them (they are only in the full
     "Everyone on the system" list, like every admin-created account). */
  await page.goto("/b-systems/registrations");
  const awaiting = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Awaiting approval" }) });
  await expect(awaiting.getByText("Mostafa Kamel")).toHaveCount(0);

  /* The promise the founder made: they sign in with the credentials the admin
     set, straight away, and land on their own CRM. */
  const agentCtx = await browser.newContext();
  const agentPage = await agentCtx.newPage();
  await agentPage.goto("/login");
  await agentPage.getByLabel("Email or phone").fill("mostafa.kamel@example.com");
  await agentPage.getByLabel("Password").fill("agentpass123");
  await agentPage.getByRole("button", { name: "Sign in" }).click();
  await expect(agentPage).toHaveURL(/\/b-systems\/crm$/);
  await agentCtx.close();
});

/* Founder: "make sure that the agents as cards are separated from their
   partners — first of all add a filter for agents and partners. Also add call
   and whatsapp in agents and partners." */
test("the Kind filter separates the two kinds, and cards expose Call + WhatsApp", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/b-systems$/);

  const partnerRes = await page.request.post("/api/b-systems/partners-pipeline", {
    data: {
      kind: "partner",
      name: "Kindfilter Contact",
      companyName: "Kindfilter Partners Co",
      number: "0105551111",
      businessActivity: "HR company",
    },
  });
  expect(partnerRes.status()).toBe(201);
  const partnerId = ((await partnerRes.json()) as { id: string }).id;
  const agentRes = await page.request.post("/api/b-systems/partners-pipeline", {
    data: { kind: "agent", name: "Kindfilter Agent", number: "01055522233" },
  });
  expect(agentRes.status()).toBe(201);
  const agentId = ((await agentRes.json()) as { id: string }).id;

  /* unfiltered: ONE board carrying both kinds (ADR-059) */
  await page.goto("/b-systems/partners-pipeline");
  await expect(page.locator(".board")).toHaveCount(1);
  await expect(page.locator('[data-deal-card="Kindfilter Partners Co"]')).toBeVisible();
  const agentCard = page.locator('[data-deal-card="Kindfilter Agent"]');
  await expect(agentCard).toBeVisible();

  /* the card's chip pair: tel: dials the number as typed; wa.me gets Egypt's
     country code prefixed onto the locally-typed mobile, in a new tab */
  await expect(agentCard.getByRole("link", { name: "Call", exact: true })).toHaveAttribute(
    "href",
    "tel:01055522233",
  );
  const wa = agentCard.getByRole("link", { name: "WhatsApp", exact: true });
  await expect(wa).toHaveAttribute("href", "https://wa.me/201055522233");
  await expect(wa).toHaveAttribute("target", "_blank");

  /* Agents only — driven through the filter UI, landing on ?kind=agent;
     narrowing is server-side, so NO partner card renders at all */
  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByLabel("Kind").selectOption("agent");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForURL(/kind=agent/);
  await expect(page.locator('[data-deal-card="Kindfilter Agent"]')).toBeVisible();
  await expect(page.locator('[data-deal-card][data-kind="partner"]')).toHaveCount(0);
  /* still ONE board — the filter narrows the CARDS, never the columns */
  await expect(page.locator(".board")).toHaveCount(1);
  await expect(page.locator('[data-stage="waiting"]')).toHaveCount(1);

  /* and the prospect detail header carries the same pair (scoped to the
     header actions — the number cells repeat the chips inline) */
  await page.locator('[data-deal-card="Kindfilter Agent"]').locator(".bcard-rep").click();
  await page.waitForURL(new RegExp(`/b-systems/partners-pipeline/${agentId}$`));
  const headActions = page.locator(".page-actions");
  await expect(headActions.getByRole("link", { name: "Call", exact: true })).toHaveAttribute(
    "href",
    "tel:01055522233",
  );
  await expect(headActions.getByRole("link", { name: "WhatsApp", exact: true })).toHaveAttribute(
    "href",
    "https://wa.me/201055522233",
  );

  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${partnerId}`)).ok()).toBe(
    true,
  );
  expect((await page.request.delete(`/api/b-systems/partners-pipeline/${agentId}`)).ok()).toBe(
    true,
  );
});
