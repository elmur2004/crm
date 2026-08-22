import { expect, test } from "@playwright/test";

/* ============================================================================
   ADR-060 (founder 4.2) — the saved app's identity is the OFFICIAL B-Systems
   mark. The phone resolves the login screen and Add-to-Home-Screen against
   the (home) route group, whose icon used to be a generic gradient
   placeholder; it now embeds the real mark, an apple-touch icon covers iOS
   saves, and a manifest names the install and hands Android its icons. The
   root metadata files must inject WITHOUT a root layout (ADR-007 keeps
   <html> per group) — this spec is that proof, on the built app.
   ========================================================================== */

test("login screen and shells carry the real B-Systems install identity", async ({
  page,
  request,
}) => {
  await page.goto("/login");

  /* the (home) favicon is the official mark, not the gradient placeholder */
  const iconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(iconHref).toBeTruthy();
  const iconRes = await request.get(iconHref!);
  expect(iconRes.status()).toBe(200);
  const svg = await iconRes.text();
  expect(svg).toContain("<image"); // the embedded PNG mark
  expect(svg).not.toContain('fill="url(#g)"'); // the old gradient triangle is gone

  /* the apple-touch icon is linked and served */
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
  expect(appleHref).toBeTruthy();
  expect((await request.get(appleHref!)).status()).toBe(200);

  /* the manifest is linked, served, named, and every icon it lists resolves */
  const manifestHref = await page.locator('link[rel="manifest"]').first().getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const man = await request.get(manifestHref!);
  expect(man.status()).toBe(200);
  const doc = (await man.json()) as {
    name: string;
    icons: Array<{ src: string; purpose?: string }>;
  };
  expect(doc.name).toBe("B-Systems");
  expect(doc.icons).toHaveLength(3);
  expect(doc.icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const i of doc.icons) expect((await request.get(i.src)).status()).toBe(200);

  /* an authed shell carries the install links too — and KEEPS its own group
     favicon (only the neutral entry's placeholder was replaced) */
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const bsIconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(bsIconHref).toBeTruthy();
  expect(bsIconHref).not.toBe(iconHref);

  await page.goto("/byteforce");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  const bfIconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(bfIconHref).not.toBe(iconHref); // ByteForce keeps its orange tile
});
