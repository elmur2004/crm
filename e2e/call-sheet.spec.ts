import { expect, test } from "@playwright/test";

/* Founder — the dial button and the call sheet: "a button to call the lead
   instantly so it dials the lead. And whenever you dial, it opens the page
   where all the information of the lead is displayed … so I can talk with him
   on the phone and see everything." The page is used one-handed, mid-call, so
   the overflow sweep runs at all five widths here too. */

const VIEWPORTS = [1440, 1024, 768, 560, 390];

test("dial from the board card opens the call sheet with a dialable tel: link", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Dial Smoke Lead",
      number: "+20 100 123-4567", // spaced + dashed on purpose
      type: "cold_call",
      companyName: "Dial Smoke Co",
      industry: "Logistics",
      position: "Operations Manager",
      requirements: "Fleet tracking for 40 trucks",
      email: "ops@dialsmoke.example",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  /* the card's Call chip must NOT drag the card nor open the lead detail.
     Founder: a WhatsApp chip sits BESIDE it — wa.me with the country code
     prefixed onto the number, opening in a new tab. */
  await page.goto("/b-systems/crm");
  const card = page.locator('[data-deal-card="Dial Smoke Lead"]');
  await expect(card).toBeVisible();
  const cardWa = card.getByRole("link", { name: "WhatsApp", exact: true });
  await expect(cardWa).toHaveAttribute("href", "https://wa.me/201001234567");
  await expect(cardWa).toHaveAttribute("target", "_blank");
  await card.getByRole("link", { name: "Call", exact: true }).click();
  /* ADR-073 — the call sheet is a SHARED address now (B-Systems and Mindoo),
     so its links carry `?company=`; without it the page would resolve the
     reader's default company and 404 the other one's lead. A PREDICATE rather
     than a regex: escaping `?` inside a template literal is a trap — `\?` there
     collapses to a bare `?`, which quietly makes the previous character
     optional instead of matching a query string. */
  await page.waitForURL(
    (u) => u.pathname === `/b-systems/crm/lead/${id}/call` && u.searchParams.get("company") === "bsystems",
  );

  /* the big dial button: labelled for screen readers, sanitised in the href */
  const dial = page.getByRole("link", { name: "Call now — +20 100 123-4567" });
  await expect(dial).toBeVisible();
  await expect(dial).toHaveAttribute("href", "tel:+201001234567");

  /* … and its WhatsApp sibling, normalised the wa.me way (+20 → 20) */
  const wa = page.getByRole("link", { name: "Message on WhatsApp — +20 100 123-4567" });
  await expect(wa).toBeVisible();
  await expect(wa).toHaveAttribute("href", "https://wa.me/201001234567");
  await expect(wa).toHaveAttribute("target", "_blank");

  /* his story, on one page */
  await expect(page.getByRole("heading", { level: 1, name: "Dial Smoke Lead" })).toBeVisible();
  await expect(page.getByText("Dial Smoke Co").first()).toBeVisible();
  await expect(page.getByText("Logistics")).toBeVisible();
  await expect(page.getByText("Operations Manager")).toBeVisible();
  await expect(page.getByText("Fleet tracking for 40 trucks")).toBeVisible();
  await expect(page.getByRole("link", { name: "ops@dialsmoke.example" })).toHaveAttribute(
    "href",
    "mailto:ops@dialsmoke.example",
  );
  for (const heading of ["Details", "Latest update", "Stage records", "History"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Back to the lead" })).toBeVisible();

  /* §15 sweep: no horizontal overflow at any of the five widths */
  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/b-systems/crm/lead/${id}/call`);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `call sheet overflows horizontally at ${width}px`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  /* the lead detail header carries the same entry point */
  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByRole("link", { name: "Call", exact: true }).click();
  /* ADR-073 — the call sheet is a SHARED address now (B-Systems and Mindoo),
     so its links carry `?company=`; without it the page would resolve the
     reader's default company and 404 the other one's lead. A PREDICATE rather
     than a regex: escaping `?` inside a template literal is a trap — `\?` there
     collapses to a bare `?`, which quietly makes the previous character
     optional instead of matching a query string. */
  await page.waitForURL(
    (u) => u.pathname === `/b-systems/crm/lead/${id}/call` && u.searchParams.get("company") === "bsystems",
  );

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

test("the call sheet honours the lead walls — an agent cannot open someone else's", async ({
  browser,
}) => {
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await adminPage.goto("/login");
  await adminPage.getByLabel("Email or phone").fill("admin@byteforce.com");
  await adminPage.getByLabel("Password").fill("password123");
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await adminPage.waitForURL(/\/b-systems$/);
  const created = await adminPage.request.post("/api/b-systems/leads", {
    data: {
      name: "Private Call Lead",
      number: "0105550001",
      type: "cold_call",
      companyName: "Private Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const agent = await browser.newContext();
  const agentPage = await agent.newPage();
  await agentPage.goto("/login");
  await agentPage.getByLabel("Email or phone").fill("01001234567");
  await agentPage.getByLabel("Password").fill("partner123");
  await agentPage.getByRole("button", { name: "Sign in" }).click();
  await agentPage.waitForURL(/\/b-systems\/crm$/);

  await agentPage.goto(`/b-systems/crm/lead/${id}/call`);
  await expect(agentPage.getByText(/could not be found|404/i).first()).toBeVisible();

  expect((await adminPage.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  await admin.close();
  await agent.close();
});
