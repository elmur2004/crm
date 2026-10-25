import { expect, test, type Page } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { afterSignIn } from "./helpers/after-sign-in";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — in a browser, through the real UI.

   Founder, verbatim: "add import lead button when I click on it it gives me the
   option to download the import template or import the leads actually".

   The journey: download the template from the real menu, FILL THE DOWNLOADED
   FILE programmatically (its own sheet XML, its own Text-formatted cells),
   upload it through the real menu and file chooser, read the result screen's
   counts and every skipped row's reason, and find the new leads on the Leads
   page — unassigned. Plus the wall, the keyboard, a phone, and Arabic.
   ========================================================================== */

const BS = "?company=bsystems";
const BF = "?company=byteforce";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function login(page: Page, id: string, landing: RegExp, password = "password123") {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(id);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

const importButton = (page: Page, company: "B-Systems" | "ByteForce") =>
  page.getByRole("button", { name: `Import leads — ${company}` });

/** A filled-in template row: a string is typed into the template's Text cell;
    a NUMBER is what Excel stores when a phone is typed into a General cell. */
type Typed = string | number | null;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Fill THE DOWNLOADED TEMPLATE from row 3 down, in its own sheet XML, keeping
    each cell's own style (the template's "@" Text format). Row 2 — the example
    — is left exactly as downloaded. */
function fillTemplate(bytes: Buffer, rows: Typed[][]): Buffer {
  const zip = unzipSync(new Uint8Array(bytes));
  let sheet = strFromU8(zip["xl/worksheets/sheet1.xml"]!);
  rows.forEach((cells, i) => {
    const r = 3 + i;
    const rowRe = new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?</row>`);
    const original = rowRe.exec(sheet)?.[0];
    expect(original, `template row ${r}`).toBeTruthy();
    const xml = cells
      .map((v, c) => {
        const ref = `${String.fromCharCode(65 + c)}${r}`;
        const style = new RegExp(`<c r="${ref}" s="(\\d+)"`).exec(original!)?.[1];
        const s = style ? ` s="${style}"` : "";
        if (v === null || v === "") return `<c r="${ref}"${s}/>`;
        if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
        return `<c r="${ref}"${s} t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
      })
      .join("");
    sheet = sheet.replace(rowRe, `<row r="${r}">${xml}</row>`);
  });
  zip["xl/worksheets/sheet1.xml"] = strToU8(sheet);
  return Buffer.from(zipSync(zip));
}

async function downloadTemplate(page: Page, company: "B-Systems" | "ByteForce") {
  await importButton(page, company).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Download template" }).click(),
  ]);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  return { name: download.suggestedFilename(), bytes: readFileSync(path!) };
}

async function uploadThroughMenu(page: Page, company: "B-Systems" | "ByteForce", buffer: Buffer, name = "filled.xlsx") {
  await importButton(page, company).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem", { name: "Import leads" }).click(),
  ]);
  await chooser.setFiles({ name, mimeType: XLSX, buffer });
}

/* The leads this file imports are named "E2E …". The suite shares one seeded
   database and later specs count what is in it, so they are deleted again at
   the end through the admin's real DELETE endpoint (best effort — a cleanup
   that fails must not hide a real result). ByteForce has no delete endpoint;
   its one imported lead stays, like every other spec's additions. */
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await login(page, "admin@byteforce.com", /\/b-systems$/);
    await page.goto(`/b-systems/leads${BS}&q=E2E`);
    const hrefs = await page
      .locator('a[href*="/b-systems/crm/lead/"]')
      .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
    for (const href of hrefs) {
      const id = /\/crm\/lead\/([^?/]+)/.exec(href)?.[1];
      if (id) await page.request.delete(`/api/b-systems/leads/${id}`);
    }
  } catch {
    /* best effort */
  } finally {
    await page.close();
  }
});

/* -------------------------------------------------------------------------- */

test("download the template, fill it, import it through the menu — the result screen and the Leads page", async ({
  page,
}) => {
  /* admin@byteforce.com holds bsystems_admin AND byteforce_staff */
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  await page.goto(`/b-systems/leads${BS}`);

  /* ONE import button on this page — this page's company only */
  await expect(importButton(page, "B-Systems")).toBeVisible();
  await expect(importButton(page, "ByteForce")).toHaveCount(0);

  /* the menu has exactly the two actions */
  await importButton(page, "B-Systems").click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await expect(page.getByRole("menuitem", { name: "Download template" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Import leads" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  const template = await downloadTemplate(page, "B-Systems");
  expect(template.name).toBe("b-systems-leads-import-template.xlsx");
  expect(template.bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  /* the downloaded file's Number column is TEXT */
  const sheet = strFromU8(unzipSync(new Uint8Array(template.bytes))["xl/worksheets/sheet1.xml"]!);
  expect(sheet).toMatch(/<c r="B3" s="\d+"\/>/);

  /* Name, Number, Type, Email, Company, Position, Industry, Requirements, Description, Created date */
  const filled = fillTemplate(template.bytes, [
    ["E2E Import Mona", "01019990001", "Event data", "mona@e2e.test", "E2E Co", "CEO", "Retail", "A website", "From the e2e", null], // 3 ✓
    ["E2E Seeded Twin", "0221000001", "Cold call", null, "E2E Co", null, null, null, null, null], // 4 already in the system (seed)
    ["E2E Import Repeat", "010 1999 0001", "Cold call", null, "E2E Co", null, null, null, null, null], // 5 repeat of row 3
    [null, "01019990002", "Cold call", null, "E2E Co", null, null, null, null, null], // 6 no name
    ["E2E Bad Type", "01019990003", "Walk in", null, "E2E Co", null, null, null, null, null], // 7 unknown type
    ["E2E Zero Lost", 1019990004, "Campaign lead", null, "E2E Co", null, null, null, null, null], // 8 ✓ numeric cell
    ["E2E Old Lead", "01019990005", "Cold call", null, "E2E Co", null, null, null, null, "15/03/2024"], // 9 ✓ backdated
  ]);

  await uploadThroughMenu(page, "B-Systems", filled);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Import finished")).toBeVisible({ timeout: 30_000 });

  /* the counts */
  await expect(dialog.locator('[data-import-count="imported"] .tile-value')).toHaveText("3");
  await expect(dialog.locator('[data-import-count="skipped"] .tile-value')).toHaveText("5");

  /* EVERY skipped row, with its row number and its reason */
  const skipped = dialog.locator("table[data-import-skipped] tbody tr");
  await expect(skipped).toHaveCount(5);
  const reasonOf = (r: number) => dialog.locator(`tr[data-row="${r}"] td`).nth(3);
  await expect(reasonOf(2)).toHaveText("The template's example row — not imported");
  await expect(reasonOf(4)).toHaveText("Already in B-Systems — this number belongs to “Delta Fresh Foods”");
  await expect(reasonOf(5)).toHaveText("The same number is already on row 3 of this file");
  await expect(reasonOf(6)).toHaveText("Name is missing");
  await expect(reasonOf(7)).toContainText("“Walk in” is not a lead type — use one of: Cold call, Event data");
  await expect(dialog.locator('tr[data-row="4"] td').nth(2)).toHaveText("0221000001");

  /* the zero Excel dropped is put back, and SAID */
  await expect(dialog.getByText("Leading 0 put back")).toBeVisible();
  await expect(dialog.getByText(/Row 8: .*1019990004.* became .*01019990004/)).toBeVisible();

  /* where the new leads are */
  await expect(dialog.getByText("Owner: Unassigned")).toBeVisible();

  /* the skipped rows download as a re-importable .xlsx */
  const [skippedFile] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("link", { name: "Download the skipped rows (.xlsx)" }).click(),
  ]);
  expect(skippedFile.suggestedFilename()).toMatch(/^b-systems-leads-skipped-\d{4}-\d{2}-\d{2}\.xlsx$/);

  /* close — the page has refreshed beneath the dialog and shows the new leads */
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(importButton(page, "B-Systems")).toBeFocused();
  await expect(page.getByRole("link", { name: "E2E Import Mona" })).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E Zero Lost" })).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E Old Lead" })).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E Bad Type" })).toHaveCount(0);

  /* and they are UNASSIGNED: the Owner → Unassigned queue lists all three */
  await page.goto(`/b-systems/leads${BS}&owner=unassigned`);
  for (const name of ["E2E Import Mona", "E2E Zero Lost", "E2E Old Lead"]) {
    await expect(page.getByRole("link", { name })).toBeVisible();
  }

  /* the number Excel had turned into 1019990004 is stored with its zero */
  await page.getByRole("link", { name: "E2E Zero Lost" }).click();
  await expect(page.getByText("01019990004").first()).toBeVisible();
});

test("a file that is not the template is refused WHOLE, saying why — e.g. the export file", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  await page.goto(`/b-systems/leads${BS}`);
  const before = await page.request.get("/api/b-systems/leads/export");
  const rows = before.headers()["x-lead-rows"];

  const exported = Buffer.from(await before.body());
  await uploadThroughMenu(page, "B-Systems", exported, "b-systems-leads.xlsx");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Nothing was imported")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("alert")).toContainText("This file is not the import template");
  await expect(dialog.getByRole("alert")).toContainText("Columns the template does not have: Stage, Status");

  /* nothing was written */
  const after = await page.request.get("/api/b-systems/leads/export");
  expect(after.headers()["x-lead-rows"]).toBe(rows);

  /* the ByteForce template on the B-Systems page is refused by name */
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.goto(`/b-systems/leads${BF}`);
  const bfTemplate = await downloadTemplate(page, "ByteForce");
  expect(bfTemplate.name).toBe("byteforce-leads-import-template.xlsx");
  await page.goto(`/b-systems/leads${BS}`);
  await uploadThroughMenu(
    page,
    "B-Systems",
    fillTemplate(bfTemplate.bytes, [["Wrong Place", "01019990099", "Cold call", null, null, null, null, null, null, null]]),
  );
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "This is the ByteForce template, and you are importing into B-Systems. Download the B-Systems template, or switch to ByteForce first.",
    { timeout: 30_000 },
  );
});

test("the menu is keyboard-operable with real names", async ({ page }) => {
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  await page.goto(`/b-systems/leads${BS}`);
  const button = importButton(page, "B-Systems");
  await expect(button).toHaveAttribute("aria-haspopup", "menu");
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const download = page.getByRole("menuitem", { name: "Download template" });
  const doImport = page.getByRole("menuitem", { name: "Import leads" });
  await expect(download).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(doImport).toBeFocused();
  await page.keyboard.press("ArrowDown"); // wraps
  await expect(download).toBeFocused();
  await page.keyboard.press("End");
  await expect(doImport).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(button).toBeFocused();

  /* Arrow Down on the button opens it too */
  await page.keyboard.press("ArrowDown");
  await expect(download).toBeFocused();
  await expect(page.getByRole("menu")).toHaveAttribute("aria-labelledby", (await button.getAttribute("id"))!);
});

test("on a phone: 44px targets, and the menu stays on screen — in English and in Arabic", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  await page.goto(`/b-systems/leads${BS}`);

  for (const lang of ["en", "ar"] as const) {
    if (lang === "ar") {
      /* at phone width the language toggle lives in the burger sheet; the
         cookie it writes is the same one, set directly */
      await page.context().addCookies([{ name: "locale", value: "ar", url: page.url() }]);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }
    const name = lang === "en" ? "Import leads — B-Systems" : "استيراد العملاء المحتملين — B-Systems";
    const button = page.getByRole("button", { name });
    await button.scrollIntoViewIfNeeded();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await button.click();
    const items = page.getByRole("menuitem");
    await expect(items).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const box = (await items.nth(i).boundingBox())!;
      expect(box.height, `${lang} item ${i}`).toBeGreaterThanOrEqual(44);
      expect(box.x, `${lang} item ${i} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${lang} item ${i} right edge`).toBeLessThanOrEqual(390);
    }
    if (lang === "ar") {
      await expect(page.getByRole("menuitem", { name: "تنزيل النموذج" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "استيراد العملاء المحتملين" })).toBeVisible();
    }
    await page.keyboard.press("Escape");
  }
});

test("Arabic: the result screen speaks Arabic", async ({ page }) => {
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  await page.goto(`/b-systems/leads${BS}`);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const res = await page.request.get("/api/b-systems/leads/import/template");
  expect(res.status()).toBe(200);
  const filled = fillTemplate(Buffer.from(await res.body()), [
    [null, "01019990101", "اتصال مباشر", null, "شركة", null, null, null, null, null],
    ["E2E عميل عربي", "٠١٠١٩٩٩٠١٠٢", "اتصال مباشر", null, "شركة", null, null, null, null, null],
  ]);
  await page.getByRole("button", { name: "استيراد العملاء المحتملين — B-Systems" }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem", { name: "استيراد العملاء المحتملين" }).click(),
  ]);
  await chooser.setFiles({ name: "arabic.xlsx", mimeType: XLSX, buffer: filled });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("اكتمل الاستيراد")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.locator('[data-import-count="imported"] .tile-value')).toHaveText("1");
  await expect(dialog.locator('tr[data-row="3"] td').nth(3)).toHaveText("الاسم غير موجود");
  await expect(dialog.locator('tr[data-row="2"] td').nth(3)).toHaveText("صف المثال في النموذج — لا يُستورد");
  await dialog.getByRole("button", { name: "إغلاق" }).click();
  /* the Arabic-Indic digits were read as the number they are */
  await page.goto(`/b-systems/leads${BS}&owner=unassigned`);
  await expect(page.getByRole("link", { name: "E2E عميل عربي" })).toBeVisible();
});

/* -------------------------------------------------------------------------- */

test("the wall: sales and data entry get no button and the server refuses them; ByteForce staff import ByteForce only", async ({
  page,
}) => {
  const someFile = async () => {
    const res = await page.request.get("/api/byteforce/leads/import/template");
    return res;
  };

  /* internal sales cannot open the B-Systems Leads page, so no button — and no import by URL */
  await login(page, "omar@b-systems.example", /\/b-systems\/crm/, "bsystems123");
  await page.goto(`/b-systems/leads${BS}`);
  await expect(page).not.toHaveURL(/\/b-systems\/leads/);
  await expect(importButton(page, "B-Systems")).toHaveCount(0);
  const salesPost = await page.request.post("/api/b-systems/leads/import", {
    multipart: { file: { name: "x.xlsx", mimeType: XLSX, buffer: Buffer.from("PK") } },
  });
  expect(salesPost.status()).toBe(403);
  expect((await page.request.get("/api/b-systems/leads/import/template")).status()).toBe(403);
  expect((await someFile()).status()).toBe(403);

  /* a ByteForce-only teammate: one button, ByteForce's, and it works */
  await page.context().clearCookies();
  await login(page, "sara@byteforce.example", /\/b-systems\?company=byteforce$/, "byteforce123");
  await page.goto(`/b-systems/leads${BF}`);
  await expect(importButton(page, "ByteForce")).toBeVisible();
  await expect(importButton(page, "B-Systems")).toHaveCount(0);
  const template = await page.request.get("/api/byteforce/leads/import/template");
  expect(template.status()).toBe(200);
  const filled = fillTemplate(Buffer.from(await template.body()), [
    ["E2E ByteForce Walk In", "01019990201", "Organic", null, null, null, null, null, null, null],
  ]);
  const ok = await page.request.post("/api/byteforce/leads/import", {
    multipart: { file: { name: "bf.xlsx", mimeType: XLSX, buffer: filled } },
  });
  expect(ok.status()).toBe(200);
  expect(((await ok.json()) as { imported: number }).imported).toBe(1);
  /* …into the Unassigned card */
  await page.reload();
  await page.getByRole("link", { name: /Unassigned/ }).click();
  await expect(page.getByRole("link", { name: "E2E ByteForce Walk In" })).toBeVisible();

  /* and the B-Systems import, typed by hand, refuses him */
  const theirs = await page.request.post("/api/b-systems/leads/import", {
    multipart: { file: { name: "bf.xlsx", mimeType: XLSX, buffer: filled } },
  });
  expect(theirs.status()).toBe(403);
});

test("the CRM board carries the same button beside Add lead — and only for whom the server would accept", async ({
  page,
}) => {
  /* founder: "push the import leads button I don't see it" — he works from the board */
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  await page.goto(`/b-systems/crm${BS}`);
  await expect(importButton(page, "B-Systems")).toBeVisible();
  await expect(importButton(page, "ByteForce")).toHaveCount(0);
  await page.goto(`/b-systems/crm${BF}`);
  await expect(importButton(page, "ByteForce")).toBeVisible();
  await expect(importButton(page, "B-Systems")).toHaveCount(0);
  /* the menu opens from the board exactly as from the Leads page */
  await importButton(page, "ByteForce").click();
  await expect(page.getByRole("menuitem", { name: /template/i })).toBeVisible();
  await page.keyboard.press("Escape");

  /* internal sales works the B-Systems board but may not import: no button */
  await page.context().clearCookies();
  await login(page, "omar@b-systems.example", /\/b-systems\/crm/, "bsystems123");
  await page.goto(`/b-systems/crm${BS}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(importButton(page, "B-Systems")).toHaveCount(0);
});

test("a signed-out request is refused at all four addresses", async ({ page }) => {
  for (const url of ["/api/b-systems/leads/import/template", "/api/byteforce/leads/import/template"]) {
    expect((await page.request.get(url)).status()).toBe(401);
  }
  for (const url of ["/api/b-systems/leads/import", "/api/byteforce/leads/import"]) {
    const res = await page.request.post(url, {
      multipart: { file: { name: "x.xlsx", mimeType: XLSX, buffer: Buffer.from("PK") } },
    });
    expect(res.status()).toBe(401);
  }
});
