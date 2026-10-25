import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   THE GLASS SIGN-IN (src/components/login/, src/themes/login.css).

   Founder: "upgrade the log in page to something like this … after you
   finish everything do a complete round of testing to make sure everything
   works perfectly for a phone interface and a tablet interface also".

   What this file proves, on the built app:
   · BEHAVIOUR IS UNCHANGED — the seeded accounts sign in (by email and by
     phone) through the same action; every ?error= banner is the same
     sentence in a role="alert";
     the e2e suite's accessible names still resolve to exactly one element.
   · the password eye toggles (type, pressed state, value kept) and is a real
     keyboard stop: language/theme → identifier → password → eye → Sign in →
     the portal link, each with a visible focus ring.
   · PHONE AND TABLET — 320, 375, 768 and 1024 in English and Arabic: no
     horizontal scroll; at 375×812 and 768×1024 the whole form is on screen
     without scrolling; every touch target is at least 44px.
   · RTL mirrors (field icons, the eye, the arrow badge and its arrow).
   · reduced motion renders everything at its final state with no animation
     at all; full motion settles, so nothing clickable is left moving.
   · dark theme paints smoked glass on a deep indigo ground.
   · no other sign-in method, no "remember me", no "forgot password".
   ========================================================================== */

const ERRORS: Record<string, string> = {
  pending: "Your registration is awaiting approval — the admin reviews new sign-ups.",
  rejected: "Your registration was declined. Contact B-Systems if you think this is a mistake.",
  health: "The system database is not ready — open /api/health for the exact fix.",
  "1": "Wrong email/phone or password. Try again.",
};

/** The theme and the language are cookies (src/lib/theme, src/lib/i18n). */
async function prefer(page: Page, prefs: { theme?: "light" | "dark"; locale?: "en" | "ar" }) {
  const base = test.info().project.use.baseURL!;
  const cookies = [];
  if (prefs.theme) cookies.push({ name: "theme", value: prefs.theme, url: base });
  if (prefs.locale) cookies.push({ name: "locale", value: prefs.locale, url: base });
  await page.context().addCookies(cookies);
}

/** The page's own alert. Next renders a route announcer that is ALSO
    role="alert" (outside <main>), so a bare getByRole("alert") is ambiguous
    on every page of the app — scope to the page. */
const pageAlert = (page: Page) => page.getByRole("main").getByRole("alert");

/* Where a sign-in LANDS is the action's business, not this page's: ADR-028
   sent each account to its role's home, and ADR-090 (in flight beside this
   change) sends every account to the app launcher, /apps. The page's job is
   to hand the same two fields to the same action — so the sign-in checks
   accept either landing, and then prove the session is real (the app does
   not bounce it back to /login). */
const LAUNCHER = /\/apps(\?|$)/;
async function expectSignedIn(page: Page, roleLanding: RegExp) {
  await page.waitForURL((url) => LAUNCHER.test(url.pathname + url.search) || roleLanding.test(url.href));
  expect(page.url()).not.toMatch(/\/login/);
}

async function signIn(page: Page, identifier: string, password: string) {
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** "rgb(…)", "rgba(…)" or "color(srgb …)" → 0–255 channels + alpha. */
function parseColor(css: string): { r: number; g: number; b: number; a: number } {
  const n = (css.match(/-?[\d.]+/g) ?? []).map(Number);
  if (css.startsWith("color(srgb")) return { r: n[0]! * 255, g: n[1]! * 255, b: n[2]! * 255, a: n[3] ?? 1 };
  return { r: n[0]!, g: n[1]!, b: n[2]!, a: n[3] ?? 1 };
}
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const l = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
}

/* ------------------------------------------------------------ behaviour */

test.describe("behaviour is unchanged", () => {
  test("the admin signs in with the same labels and lands where sign-in lands", async ({ page }) => {
    await page.goto("/login");
    /* the suite's three locators resolve to exactly one element each */
    await expect(page.getByLabel("Email or phone")).toHaveCount(1);
    await expect(page.getByLabel("Password")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "One door, every account." })).toBeVisible();
    await signIn(page, "admin@byteforce.com", "password123");
    await expectSignedIn(page, /\/b-systems$/);
  });

  test("a ByteForce account still signs in", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, "sara@byteforce.example", "byteforce123");
    await expectSignedIn(page, /\/b-systems\?company=byteforce$/);
  });

  test("a phone number still signs in (the identifier is email OR phone)", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, "01001234567", "partner123");
    await expectSignedIn(page, /\/b-systems\//);
  });

  test("a wrong password shows the default error in a role=alert, and the form is still there", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, "admin@byteforce.com", "not-the-password");
    await page.waitForURL(/\/login\?error=1$/);
    await expect(pageAlert(page)).toContainText(ERRORS["1"]!);
    await expect(page.getByLabel("Email or phone")).toBeEditable();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  for (const [code, text] of Object.entries(ERRORS)) {
    test(`?error=${code} renders its sentence in a role=alert`, async ({ page }) => {
      await page.goto(`/login?error=${code}`);
      const alert = pageAlert(page);
      await expect(alert).toHaveCount(1);
      /* the sentence, after the aria-hidden "!" badge — as before */
      await expect(alert).toContainText(text);
      expect((await alert.innerText()).replace(/^!\s*/, "").trim()).toBe(text);
    });
  }

  test("an unknown ?error= value falls back to the default sentence (as before)", async ({ page }) => {
    await page.goto("/login?error=whatever");
    await expect(pageAlert(page)).toContainText(ERRORS["1"]!);
  });

  test("no error, no alert", async ({ page }) => {
    await page.goto("/login");
    await expect(pageAlert(page)).toHaveCount(0);
  });

  test("the form posts identifier + password and nothing else visible", async ({ page }) => {
    await page.goto("/login");
    const names = await page.locator("form input:not([type=hidden])").evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).name),
    );
    expect(names).toEqual(["identifier", "password"]);
    await expect(page.getByLabel("Email or phone")).toHaveAttribute("autocomplete", "username");
    await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  });

  test("the new-partner link still goes to /portal", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Apply to the partnership programme" })).toHaveAttribute(
      "href",
      "/portal",
    );
  });

  test("no other sign-in method, no 'remember me', no 'forgot password'", async ({ page }) => {
    await page.goto("/login");
    const body = page.locator("body");
    await expect(body).not.toContainText(/google|facebook|discord|apple|remember me|forgot/i);
    /* exactly the form's own controls + the two toggles + the eye + the link */
    await expect(page.getByRole("button")).toHaveCount(2 + 3 + 1 + 1);
  });

  test("while signing in the button says the same thing, is busy, and cannot be pressed twice", async ({ page }) => {
    await page.goto("/login");
    await page.route("**/login*", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.getByLabel("Email or phone").fill("admin@byteforce.com");
    await page.getByLabel("Password").fill("password123");
    const button = page.getByRole("button", { name: "Sign in" });
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveAttribute("data-pending", "");
    await expectSignedIn(page, /\/b-systems$/);
  });
});

/* ------------------------------------------------------------ the eye */

test.describe("the password eye", () => {
  test("toggles the field between hidden and shown, keeps the value, and says so", async ({ page }) => {
    await page.goto("/login");
    const pw = page.getByLabel("Password");
    const eye = page.getByRole("button", { name: "Show", exact: true });
    await pw.fill("secret-123");
    await expect(pw).toHaveAttribute("type", "password");
    await expect(eye).toHaveAttribute("aria-pressed", "false");
    await eye.click();
    await expect(pw).toHaveAttribute("type", "text");
    await expect(eye).toHaveAttribute("aria-pressed", "true");
    await expect(pw).toHaveValue("secret-123");
    await expect(eye).toHaveAttribute("title", "Hide password");
    await eye.click();
    await expect(pw).toHaveAttribute("type", "password");
    await expect(eye).toHaveAttribute("aria-pressed", "false");
    /* a click on the eye never steals focus from the field */
    await pw.focus();
    await eye.click();
    await expect(pw).toBeFocused();
  });

  test("works from the keyboard (Space on the focused eye)", async ({ page }) => {
    await page.goto("/login");
    const pw = page.getByLabel("Password");
    await pw.fill("abc");
    await pw.press("Tab");
    const eye = page.getByRole("button", { name: "Show", exact: true });
    await expect(eye).toBeFocused();
    await page.keyboard.press("Space");
    await expect(pw).toHaveAttribute("type", "text");
  });

  test("Arabic keeps Arabic labels, and the suite's Arabic locators still resolve once", async ({ page }) => {
    await prefer(page, { locale: "ar" });
    await page.goto("/login");
    await expect(page.getByLabel("البريد الإلكتروني أو الهاتف")).toHaveCount(1);
    await expect(page.getByLabel("كلمة المرور")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /تسجيل الدخول/ })).toHaveCount(1);
    await expect(page.getByPlaceholder(/you@company\.com|01012345678|البريد/)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "إظهار", exact: true })).toHaveAttribute("aria-pressed", "false");
  });
});

/* ------------------------------------------------------------ keyboard */

test.describe("keyboard", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`tab order and a visible focus ring at every stop (${theme})`, async ({ page }) => {
      await prefer(page, { theme });
      await page.goto("/login");
      await page.waitForTimeout(1500); // the entrance has settled
      const stops: string[] = [];
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const cs = getComputedStyle(el);
          return {
            id:
              el.getAttribute("aria-label") ??
              (el as HTMLInputElement).name ??
              "",
            text: (el.textContent ?? "").trim(),
            tag: el.tagName,
            outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
          };
        });
        stops.push(info.tag === "INPUT" ? `input:${info.id}` : info.tag === "A" ? `link:${info.text}` : `button:${info.id || info.text}`);
        expect(info.outline, `focus ring on ${stops[stops.length - 1]}`).toMatch(/^solid ([2-9]|\d{2,})(\.\d+)?px$/);
      }
      expect(stops).toEqual([
        "button:EN",
        "button:عربي",
        "button:System",
        "button:Light",
        "button:Dark",
        "input:identifier",
        "input:password",
        "button:Show",
        "button:Sign in",
      ]);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Apply to the partnership programme" })).toBeFocused();
    });
  }
});

/* ------------------------------------------------------------ phone & tablet */

const VIEWPORTS = [
  { name: "small phone", width: 320, height: 640 },
  { name: "phone", width: 375, height: 812 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
];

for (const vp of VIEWPORTS) {
  for (const locale of ["en", "ar"] as const) {
    test.describe(`${vp.name} ${vp.width}×${vp.height} · ${locale}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1100 });

      test("no horizontal scroll", async ({ page }) => {
        await prefer(page, { locale });
        await page.goto("/login");
        await page.waitForTimeout(1300);
        const { scroll, inner, body } = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
          body: document.body.scrollWidth,
        }));
        expect(scroll).toBeLessThanOrEqual(inner);
        expect(body).toBeLessThanOrEqual(inner);
      });

      test("every touch target is at least 44×44", async ({ page }) => {
        await prefer(page, { locale });
        await page.goto("/login");
        await page.waitForTimeout(1300);
        const targets = [
          ...(await page.locator(".lg-top button").all()),
          page.locator("#lg-identifier"),
          page.locator("#lg-password"),
          page.locator(".lg-eye"),
          page.locator(".lg-submit"),
          page.locator(".lg-foot a"),
        ];
        expect(targets.length).toBe(10);
        for (const t of targets) {
          const box = await t.boundingBox();
          expect(box, await t.evaluate((e) => e.outerHTML.slice(0, 80))).not.toBeNull();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
        }
      });

      if ((vp.width === 375 && vp.height === 812) || (vp.width === 768 && vp.height === 1024)) {
        test("the whole form is on screen without scrolling", async ({ page }) => {
          await prefer(page, { locale });
          await page.goto("/login");
          await page.waitForTimeout(1300);
          for (const loc of [
            page.locator("#lg-identifier"),
            page.locator("#lg-password"),
            page.locator(".lg-submit"),
            page.locator(".lg-foot a"),
          ]) {
            const box = (await loc.boundingBox())!;
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
          }
          expect(await page.evaluate(() => window.scrollY)).toBe(0);
        });

        test("it also fits with an error banner showing", async ({ page }) => {
          await prefer(page, { locale });
          await page.goto("/login?error=pending");
          await page.waitForTimeout(1600);
          const box = (await page.locator(".lg-submit").boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
        });
      }

      test("signs in by touch", async ({ page }) => {
        test.skip(locale === "ar" || vp.width !== 375, "one touch sign-in is enough per run");
        await page.goto("/login");
        await page.getByLabel("Email or phone").tap();
        await page.getByLabel("Email or phone").fill("admin@byteforce.com");
        await page.getByLabel("Password").tap();
        await page.getByLabel("Password").fill("password123");
        await page.getByRole("button", { name: "Sign in" }).tap();
        await expectSignedIn(page, /\/b-systems$/);
      });
    });
  }
}

/* ------------------------------------------------------------ RTL */

test.describe("Arabic mirrors", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("icons, eye, badge and arrow sit on the mirrored side", async ({ page }) => {
    await prefer(page, { locale: "ar" });
    await page.goto("/login");
    await page.waitForTimeout(1500);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const geo = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const field = r("#lg-password");
      const mid = field.left + field.width / 2;
      const button = r(".lg-submit");
      const arrow = getComputedStyle(document.querySelector(".lg-arrow")!).transform;
      return {
        leadRight: r(".lg-field--secret .lg-lead").left > mid,
        labelRight: r('label[for="lg-password"]').left > mid,
        eyeLeft: r(".lg-eye").right < mid,
        badgeLeft: r(".lg-badge").right < button.left + button.width / 2,
        arrow,
      };
    });
    expect(geo.leadRight).toBe(true);
    expect(geo.labelRight).toBe(true);
    expect(geo.eyeLeft).toBe(true);
    expect(geo.badgeLeft).toBe(true);
    /* scaleX(-1): the arrow points to the inline end, which is LEFT in Arabic */
    expect(geo.arrow).toMatch(/^matrix\(-1, 0, 0, 1, /);
  });

  test("and English is the other way round", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(1500);
    const geo = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const field = r("#lg-password");
      const mid = field.left + field.width / 2;
      return {
        leadLeft: r(".lg-field--secret .lg-lead").right < mid,
        eyeRight: r(".lg-eye").left > mid,
        arrow: getComputedStyle(document.querySelector(".lg-arrow")!).transform,
      };
    });
    expect(geo.leadLeft).toBe(true);
    expect(geo.eyeRight).toBe(true);
    expect(geo.arrow).toMatch(/^(none|matrix\(1, 0, 0, 1, )/);
  });
});

/* ------------------------------------------------------------ motion */

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("renders everything at its final state, with no animation at all", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login?error=1");
    const state = await page.evaluate(() => {
      const els = [
        ".lg-top", ".lg-tile--byteforce", ".lg-tile--bsystems", ".lg-x", ".lg-title", ".lg-kicker",
        ".lg-sub", ".lg-alert", ".lg-field--id", ".lg-field--secret", ".lg-cta", ".lg-badge", ".lg-foot",
        ".lg-tagline",
      ].map((s) => {
        const cs = getComputedStyle(document.querySelector(s)!);
        return { s, opacity: cs.opacity, transform: cs.transform, filter: cs.filter };
      });
      return { els, animations: document.getAnimations().length };
    });
    expect(state.animations).toBe(0);
    for (const e of state.els) {
      expect(e.opacity, e.s).toBe("1");
      expect(e.transform, e.s).toBe("none");
      expect(e.filter, e.s).toBe("none");
    }
    await expect(pageAlert(page)).toBeVisible();
  });
});

test.describe("full motion", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("plays an entrance, then nothing clickable is left moving", async ({ page }) => {
    await page.goto("/login");
    const early = await page.evaluate(() => document.getAnimations().length);
    expect(early).toBeGreaterThan(10);
    await page.waitForTimeout(1800);
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .map((a) => (a.effect as KeyframeEffect | null)?.target as Element | null)
        .filter((t): t is Element => !!t && !!t.closest(".lg-form, .lg-top, .lg-foot"))
        .map((t) => t.className),
    );
    expect(moving).toEqual([]);
  });

  test("no layout shift on load", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(2000);
    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let sum = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
              if (!e.hadRecentInput) sum += e.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
          setTimeout(() => resolve(sum), 300);
        }),
    );
    test.info().annotations.push({ type: "CLS", description: cls.toFixed(4) });
    expect(cls).toBeLessThan(0.01);
  });
});

/* ------------------------------------------------------------ dark */

test.describe("dark theme", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("smoked glass on a deep indigo ground", async ({ page }) => {
    await prefer(page, { theme: "dark" });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.waitForTimeout(1300);
    const look = await page.evaluate(() => {
      const cs = (s: string) => getComputedStyle(document.querySelector(s)!);
      return {
        card: cs(".lg-card").backgroundColor,
        cardBlur: cs(".lg-card").backdropFilter,
        field: cs("#lg-identifier").backgroundColor,
        ground: cs(".lg-aurora").backgroundImage,
        sub: cs(".lg-sub").color,
      };
    });
    const card = parseColor(look.card);
    const field = parseColor(look.field);
    expect(card.a).toBeLessThan(1); // glass: translucent…
    expect(luminance(card)).toBeLessThan(0.03); // …and smoked, not white
    expect(look.cardBlur).toContain("blur(");
    expect(field.a).toBeLessThan(1);
    expect(luminance(field)).toBeLessThan(0.03);
    expect(look.ground).toMatch(/rgb\(11, 15, 61\)|color\(srgb 0\.043/); // Indigo Deep #0B0F3D
    expect(luminance(parseColor(look.sub))).toBeGreaterThan(0.5); // light words
  });

  test("and light is clear glass on a pale ground", async ({ page }) => {
    await prefer(page, { theme: "light" });
    await page.goto("/login");
    await page.waitForTimeout(1300);
    const field = parseColor(await page.locator("#lg-identifier").evaluate((e) => getComputedStyle(e).backgroundColor));
    expect(field.a).toBeLessThan(1);
    expect(luminance(field)).toBeGreaterThan(0.8);
  });
});
