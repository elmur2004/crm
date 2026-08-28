import { expect, test, type Locator, type Page } from "@playwright/test";

/* Founder (ADR-064): "the column of meeting setting should be in time order
   always in order of these meetings taking place and also add the today filter
   on top."

   Two properties, on all three boards:
     · the Meeting Setting column runs SOONEST-FIRST, always — ordered
       server-side where the card list is built — and a card with no meeting
       datetime sorts LAST instead of vanishing;
     · the ADR-061 Today chip rides that column head too, filtering to meetings
       on today's CAIRO calendar day, with a count that agrees with what shows.

   Robust against neighbours: other specs park their own cards in this column,
   so every order assertion is RELATIVE (the order of THIS test's cards among
   whatever else is there) and every count assertion compares the chip with what
   is actually rendered — never an absolute. */

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

/** A lead parked in Meeting Setting. `at` null ⇒ the meeting is recorded but
    NOT arranged and carries no datetime — the "not arranged yet" card. */
async function leadMeetingAt(
  page: Page,
  api: string,
  name: string,
  number: string,
  at: { date: string; time: string } | null,
) {
  const created = await page.request.post(`${api}/leads`, {
    data: { name, number, type: "cold_call", companyName: `${name} Co` },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`${api}/leads/${id}/event`, {
    data: {
      event: { type: "drag", to: "meeting_setting" },
      group: {
        group: "meeting",
        data: at
          ? { arranged: true, date: at.date, time: at.time, mode: "online" }
          : { arranged: false },
      },
    },
  });
  expect(moved.ok()).toBeTruthy();
  return id;
}

/** The order of `names` as they actually appear in the column, ignoring every
    other card in it (other specs park theirs here too). */
async function orderOf(col: Locator, names: string[]): Promise<string[]> {
  const rendered = await col.locator("[data-deal-card]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-deal-card") ?? ""),
  );
  return rendered.filter((n) => names.includes(n));
}

/** chip count === cards rendered in the column, and the pill agrees. */
async function expectCountsAgree(col: Locator, chip: Locator) {
  const count = Number((await chip.textContent())!.match(/\d+/)![0]);
  await expect(col.locator(".bcard")).toHaveCount(count);
  await expect(col.locator(".count-pill")).toHaveText(String(count));
}

test("B-Systems board: Meeting Setting runs soonest-first, and the undated card sits last", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  /* created in an order that is NOT the meeting order, so passing can only mean
     the column really sorted (the board's default is `updatedAt desc`, which
     would put the LAST-created card first) */
  const ids = [
    await leadMeetingAt(page, "/api/b-systems", "Order Mid Meeting", "0107780002", {
      date: cairoDate(),
      time: "20:00",
    }),
    await leadMeetingAt(page, "/api/b-systems", "Order Late Meeting", "0107780003", {
      date: cairoDate(1),
      time: "18:00",
    }),
    await leadMeetingAt(page, "/api/b-systems", "Order No Meeting", "0107780004", null),
    await leadMeetingAt(page, "/api/b-systems", "Order Soon Meeting", "0107780001", {
      date: cairoDate(),
      time: "09:30",
    }),
  ];
  const mine = ["Order Soon Meeting", "Order Mid Meeting", "Order Late Meeting", "Order No Meeting"];

  await page.goto("/b-systems/crm");
  const col = page.locator('[data-stage="meeting_setting"]');
  await expect(col.locator('[data-deal-card="Order No Meeting"]')).toBeVisible();
  /* soonest first — and the card with no datetime is still HERE, at the back */
  expect(await orderOf(col, mine)).toEqual(mine);
  /* the undated card says so rather than showing a time */
  await expect(col.locator('[data-deal-card="Order No Meeting"]')).toContainText(
    "Meeting not arranged",
  );

  /* THE CHIP: today's two meetings only, and the counts agree */
  const chip = col.getByRole("button", { name: /^Today · \d+$/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  expect(await orderOf(col, mine)).toEqual(["Order Soon Meeting", "Order Mid Meeting"]);
  await expect(col.locator('[data-deal-card="Order Late Meeting"]')).toHaveCount(0);
  await expect(col.locator('[data-deal-card="Order No Meeting"]')).toHaveCount(0);
  await expectCountsAgree(col, chip);

  /* OFF again: tomorrow's meeting and the undated card come back, in order */
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  expect(await orderOf(col, mine)).toEqual(mine);

  for (const id of ids) {
    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  }
});

test("B-Systems board: a pressed chip with nothing today says so instead of 'empty'", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const id = await leadMeetingAt(page, "/api/b-systems", "Lonely Tomorrow Meeting", "0107780005", {
    date: cairoDate(1),
    time: "12:00",
  });

  /* the server-side search narrows the whole board to this ONE card, so the
     column's states are deterministic whatever else the suite parked here */
  await page.goto("/b-systems/crm?q=Lonely+Tomorrow+Meeting");
  const col = page.locator('[data-stage="meeting_setting"]');
  await expect(col.locator(".bcard")).toHaveCount(1);
  const chip = col.getByRole("button", { name: /^Today · \d+$/ });
  await expect(chip).toHaveText("Today · 0");

  await chip.click();
  await expect(col.locator(".bcard")).toHaveCount(0);
  /* the card is HIDDEN, not absent — saying "Nothing here yet" would lie */
  await expect(col.locator(".col-empty")).toHaveText("No meetings today");
  await expect(col.locator(".count-pill")).toHaveText("0");

  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

test("ByteForce board: full parity — same order, same chip (ADR-042)", async ({ page }) => {
  await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);
  const ids = [
    await leadMeetingAt(page, "/api/byteforce", "BF Late Meeting", "0107780012", {
      date: cairoDate(1),
      time: "15:00",
    }),
    await leadMeetingAt(page, "/api/byteforce", "BF No Meeting", "0107780013", null),
    await leadMeetingAt(page, "/api/byteforce", "BF Soon Meeting", "0107780011", {
      date: cairoDate(),
      time: "08:15",
    }),
  ];
  const mine = ["BF Soon Meeting", "BF Late Meeting", "BF No Meeting"];

  await page.goto("/b-systems/crm?company=byteforce");
  const col = page.locator('[data-stage="meeting_setting"]');
  await expect(col.locator('[data-deal-card="BF No Meeting"]')).toBeVisible();
  expect(await orderOf(col, mine)).toEqual(mine);

  const chip = col.getByRole("button", { name: /^Today · \d+$/ });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  expect(await orderOf(col, mine)).toEqual(["BF Soon Meeting"]);
  await expectCountsAgree(col, chip);
  await chip.click();
  await expect(col.locator('[data-deal-card="BF No Meeting"]')).toBeVisible();

  /* clean up by ARCHIVING (ADR-043) — the ByteForce API has no lead delete */
  for (const id of ids) {
    const res = await page.request.post(`/api/byteforce/leads/${id}/archive`, {
      data: { value: true },
    });
    expect(res.ok()).toBe(true);
  }
});

test("Partners & Agents board: the same order and the same chip (ADR-059 gave it a meeting column)", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const prospect = async (name: string, number: string, at: { date: string; time: string } | null) => {
    const created = await page.request.post("/api/b-systems/partners-pipeline", {
      data: { kind: "agent", name, number },
    });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const moved = await page.request.post(`/api/b-systems/partners-pipeline/${id}/event`, {
      data: {
        event: { type: "drag", to: "meeting_setting" },
        group: {
          group: "meeting",
          data: at
            ? { arranged: true, date: at.date, time: at.time, mode: "online" }
            : { arranged: false },
        },
      },
    });
    expect(moved.ok()).toBeTruthy();
    return id;
  };
  const ids = [
    await prospect("PP Late Meeting", "01055512002", { date: cairoDate(1), time: "13:00" }),
    await prospect("PP No Meeting", "01055512003", null),
    await prospect("PP Soon Meeting", "01055512001", { date: cairoDate(), time: "07:45" }),
  ];
  const mine = ["PP Soon Meeting", "PP Late Meeting", "PP No Meeting"];

  await page.goto("/b-systems/partners-pipeline");
  const col = page.locator('[data-stage="meeting_setting"]');
  await expect(col.locator('[data-deal-card="PP No Meeting"]')).toBeVisible();
  expect(await orderOf(col, mine)).toEqual(mine);

  const chip = col.getByRole("button", { name: /^Today · \d+$/ });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  expect(await orderOf(col, mine)).toEqual(["PP Soon Meeting"]);
  await expectCountsAgree(col, chip);
  await chip.click();
  await expect(col.locator('[data-deal-card="PP No Meeting"]')).toBeVisible();

  for (const id of ids) {
    expect((await page.request.delete(`/api/b-systems/partners-pipeline/${id}`)).ok()).toBe(true);
  }
});

test("Arabic: the chip reads اليوم on Meeting Setting, and the order survives RTL", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const ids = [
    await leadMeetingAt(page, "/api/b-systems", "Arabic Late Meeting", "0107780022", {
      date: cairoDate(1),
      time: "16:00",
    }),
    await leadMeetingAt(page, "/api/b-systems", "Arabic Soon Meeting", "0107780021", {
      date: cairoDate(),
      time: "10:15",
    }),
  ];
  const mine = ["Arabic Soon Meeting", "Arabic Late Meeting"];

  await page.goto("/b-systems/crm");
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const col = page.locator('[data-stage="meeting_setting"]');
  /* RTL mirrors the ROW of columns, never the stack inside one: soonest is
     still the top card */
  expect(await orderOf(col, mine)).toEqual(mine);

  const chip = col.getByRole("button", { name: /اليوم · \d+/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  expect(await orderOf(col, mine)).toEqual(["Arabic Soon Meeting"]);
  await expectCountsAgree(col, chip);
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  expect(await orderOf(col, mine)).toEqual(mine);

  for (const id of ids) {
    expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  }
});
