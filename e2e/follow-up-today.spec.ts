import { expect, test, type Locator, type Page } from "@playwright/test";

/* Founder (ADR-061): "make a little filter in top of the follow up column
   called today when you can just see today's follow ups."

   The chip sits in the Following Up column head of BOTH lead boards (ADR-042
   parity), counts the cards whose latest follow-up is due on today's CAIRO
   day, defaults OFF, and filters client-side. Robust against neighbours: other
   specs may park their own leads in this column, so every count assertion is
   RELATIVE (chip count === cards shown while pressed), never an absolute. */

const cairoDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

/** A lead parked in Following Up with its follow-up due on `date` (date-only —
    the server stamps the 09:00 Cairo slot, ADR-061). */
async function leadDueOn(page: Page, api: string, name: string, number: string, date: string) {
  const created = await page.request.post(`${api}/leads`, {
    data: { name, number, type: "cold_call", companyName: `${name} Co` },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`${api}/leads/${id}/event`, {
    data: {
      event: { type: "drag", to: "following_up" },
      group: { group: "follow_up", data: { date, method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

/** chip count === cards rendered in the column, and the pill agrees. */
async function expectCountsAgree(col: Locator, chip: Locator) {
  const text = (await chip.textContent())!;
  const count = Number(text.match(/\d+/)![0]);
  await expect(col.locator(".bcard")).toHaveCount(count);
  await expect(col.locator(".count-pill")).toHaveText(String(count));
}

test("B-Systems board: the Today chip shows only today's follow-ups; off restores; counts agree", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const todayId = await leadDueOn(page, "/api/b-systems", "Today Chip Lead", "0107770001", cairoDate());
  const overdueId = await leadDueOn(
    page,
    "/api/b-systems",
    "Overdue Chip Lead",
    "0107770002",
    cairoDate(-1),
  );

  await page.goto("/b-systems/crm");
  const col = page.locator('[data-stage="following_up"]');
  const chip = col.getByRole("button", { name: /^Today · \d+$/ });
  await expect(chip).toBeVisible();
  /* default OFF — everything shows, the overdue card included */
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(col.locator('[data-deal-card="Today Chip Lead"]')).toBeVisible();
  await expect(col.locator('[data-deal-card="Overdue Chip Lead"]')).toBeVisible();

  /* ON: only today's cards — the overdue one disappears, the counts agree */
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(col.locator('[data-deal-card="Today Chip Lead"]')).toBeVisible();
  await expect(col.locator('[data-deal-card="Overdue Chip Lead"]')).toHaveCount(0);
  await expectCountsAgree(col, chip);

  /* OFF again: the overdue card comes back */
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(col.locator('[data-deal-card="Overdue Chip Lead"]')).toBeVisible();

  for (const id of [todayId, overdueId]) {
    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  }
});

test("ByteForce board: full parity — the chip filters and restores there too (ADR-042)", async ({
  page,
}) => {
  await login(page, "sara@byteforce.example", "byteforce123", /\/byteforce$/);
  const ids = [
    await leadDueOn(page, "/api/byteforce", "BF Today Chip", "0107770003", cairoDate()),
    await leadDueOn(page, "/api/byteforce", "BF Overdue Chip", "0107770004", cairoDate(-1)),
  ];

  await page.goto("/byteforce/crm");
  const col = page.locator('[data-stage="following_up"]');
  const chip = col.getByRole("button", { name: /^Today · \d+$/ });
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(col.locator('[data-deal-card="BF Overdue Chip"]')).toBeVisible();

  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(col.locator('[data-deal-card="BF Today Chip"]')).toBeVisible();
  await expect(col.locator('[data-deal-card="BF Overdue Chip"]')).toHaveCount(0);
  await expectCountsAgree(col, chip);

  await chip.click();
  await expect(col.locator('[data-deal-card="BF Overdue Chip"]')).toBeVisible();

  /* clean up by ARCHIVING (ADR-043) — the ByteForce API has no lead delete */
  for (const id of ids) {
    const res = await page.request.post(`/api/byteforce/leads/${id}/archive`, {
      data: { value: true },
    });
    expect(res.ok()).toBe(true);
  }
});

test("Arabic: the chip reads اليوم, and still toggles right-to-left", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const id = await leadDueOn(page, "/api/b-systems", "Arabic Chip Lead", "0107770005", cairoDate());

  await page.goto("/b-systems/crm");
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const col = page.locator('[data-stage="following_up"]');
  const chip = col.getByRole("button", { name: /اليوم · \d+/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(col.locator('[data-deal-card="Arabic Chip Lead"]')).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});
