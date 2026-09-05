import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-074 — MINDOO IS ITS OWN SYSTEM, end to end.

   Founder, verbatim: "I need to have the system for mindoo completly identical
   to byteforce but with no partners or regestrations or agents or their crm at
   all / I enter the creditials : admin@mindoo.com and password123 / the system
   opens with [the] mindoo branding / having vault and accounting and the crm
   and to do and calender all the other things / the system log in page should
   stay exactly the same don't mention mindoo their / also remove the switcher
   from bsystems system seperate them entirly nothing inside bsystems goes to
   mindoo and vice versa."

   Every sentence of that is a test below, in his order. Two of them are the
   ones that would otherwise ship broken:

   · THE WALL RUNS BOTH WAYS. It is easy to check that Mindoo cannot reach
     B-Systems and forget the other direction, which is half of what he asked
     for. Both are here.

   · MINDOO CAN WRITE. ADR-073 gave Mindoo the B-Systems board and lead detail
     and left every fetch in them pointing at `/api/b-systems`, so a Mindoo card
     rendered perfectly and every action on it was refused by the brand wall.
     The board LOOKED complete and could not be used. "Mark ready to close" is
     the cheapest proof that the writes now land.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

/** The founder's Mindoo credentials, exactly as he gave them. */
const loginAsMindoo = (page: Page) => login(page, "admin@mindoo.com", "password123", /\/mindoo$/);

const loginAsFounder = (page: Page) =>
  login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

test.describe("ADR-074 — Mindoo", () => {
  test("the sign-in page is unchanged and never mentions Mindoo", async ({ page }) => {
    /* founder: "the system log in page should stay exactly the same don't
       mention mindoo their". One consolidated door (ADR-028); which company you
       land in is decided by your roles on the other side of it. */
    await page.goto("/login");
    await expect(page.locator("body")).not.toContainText(/mindoo/i);
    await expect(page.locator("html")).not.toHaveAttribute("data-brand", "mindoo");
  });

  test("admin@mindoo.com opens Mindoo, wearing Mindoo's brand", async ({ page }) => {
    await loginAsMindoo(page);
    await expect(page).toHaveURL(/\/mindoo$/);
    /* the branding instruction, in one attribute: data-brand activates
       branding/mindoo/tokens.css for the whole document */
    await expect(page.locator("html")).toHaveAttribute("data-brand", "mindoo");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("its nav is the lead sections only — no partners, agents or registrations", async ({
    page,
  }) => {
    await loginAsMindoo(page);
    const nav = page.locator(".app-nav");
    for (const label of ["Home", "To-Do", "Calendar", "Leads", "CRM", "Won Leads"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    /* founder: "no partners or regestrations or agents or their crm at all" —
       Users is NOT among them any more: ADR-075 gave Mindoo its own, because he
       then asked for "mindoo user should appear in mindoo system". */
    await expect(nav.getByRole("link", { name: "Users", exact: true })).toBeVisible();
    for (const absent of ["Partners", "Agents", "Registrations", "Statements"]) {
      await expect(nav.getByRole("link", { name: absent, exact: true })).toHaveCount(0);
    }

    /* every link is a real Mindoo screen, at a Mindoo address, with no company
       on it — /mindoo answers that question by being /mindoo */
    const hrefs = await nav
      .getByRole("link")
      .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).getAttribute("href")!));
    for (const href of hrefs) {
      expect(href, "every nav href is a Mindoo address").toMatch(/^\/mindoo/);
      expect(href, "and carries no company parameter").not.toContain("company=");
      const res = await page.goto(href);
      expect(res?.status(), `${href} must be a real screen`).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("there is NO company switch anywhere in the Mindoo app", async ({ page }) => {
    /* founder: "remove the switcher from bsystems system seperate them entirly" */
    await loginAsMindoo(page);
    for (const path of ["/mindoo", "/mindoo/crm", "/mindoo/leads", "/mindoo/won-leads"]) {
      await page.goto(path);
      await expect(page.locator(".company-switch")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("B-Systems");
    }
  });

  test("it runs the B-Systems pipeline — eight columns, Negotiation among them", async ({
    page,
  }) => {
    await loginAsMindoo(page);
    await page.goto("/mindoo/crm");
    await expect(page.locator(".board [data-stage]")).toHaveCount(8);
    await expect(page.locator('[data-stage="negotiation"]')).toHaveCount(1);
    await expect(page.locator('[data-stage="postponed"]')).toHaveCount(1);
    await expect(
      page.locator('[data-stage="negotiation"] [data-deal-card="Red Sea Resorts"]'),
    ).toBeVisible();
    /* its OWN leads and nobody else's */
    await expect(page.locator('[data-deal-card="Nile Freight"]')).toBeVisible();
  });

  test("Mindoo's staff CAN win a Mindoo deal", async ({ page }) => {
    await loginAsMindoo(page);
    await page.goto("/mindoo/crm");
    await page.locator('[data-deal-card="Horizon Clinics"]').click();
    await page.waitForURL(/\/mindoo\/crm\/lead\//);

    /* the B-Systems config gates Won on two named B-Systems roles; a Mindoo
       config that copied it verbatim would leave this option absent and the
       board would look complete with no way to close anything (ADR-073) */
    const next = page.getByLabel(/Next action|Choose a next action/i);
    await expect(next.locator('option[value="won"]')).toHaveCount(1);
    await expect(next.locator('option[value="negotiation"]')).toHaveCount(1);
  });

  test("and its WRITES land — the action posts to Mindoo's own namespace", async ({ page }) => {
    /* ADR-074's own bug fix. Every write on these screens used to go to
       /api/b-systems, where the brand wall refused it. */
    await loginAsMindoo(page);
    await page.goto("/mindoo/crm");
    const card = page.locator('[data-deal-card="Delta Foods"]');
    const request = page.waitForRequest(
      (r) => r.url().includes("/api/mindoo/leads/") && r.method() === "POST",
    );
    await card.getByRole("button", { name: /Mark ready to close/i }).click();
    const posted = await request;
    expect(posted.url(), "the write goes to Mindoo's namespace").toContain("/api/mindoo/");
    const response = await posted.response();
    expect(response?.status(), "and is accepted, not refused by the brand wall").toBeLessThan(400);
    await expect(card.getByText(/Ready to close/i)).toBeVisible();
  });

  test("nothing inside B-Systems goes to Mindoo: the switch is back to two", async ({ page }) => {
    await loginAsFounder(page);
    const switcher = page.locator(".company-switch");
    await expect(switcher.getByRole("link")).toHaveCount(2);
    for (const name of ["B-Systems", "ByteForce"]) {
      await expect(switcher.getByRole("link", { name })).toBeVisible();
    }
    await expect(switcher.getByRole("link", { name: "Mindoo" })).toHaveCount(0);

    /* and the old address does not SWITCH you to Mindoo any more — a junk
       company falls back to the reader's own company, never obeyed. The board
       that renders is B-Systems', which is why its own cards are here… */
    await page.goto("/b-systems/crm?company=mindoo");
    await expect(page.locator(".company-switch-current")).toHaveText("B-Systems");
    /* …and any Mindoo lead on it is a FOREIGN card (ADR-075), never a native
       one you could drag or edit. Seeing it is the founder's own instruction;
       being switched into Mindoo is what stays impossible. */
    const foreign = page.locator('[data-deal-card="Nile Freight"]');
    if ((await foreign.count()) > 0) {
      await expect(foreign).toHaveAttribute("data-foreign-company", "Mindoo");
    }
  });

  test("...and nothing inside Mindoo goes to B-Systems", async ({ page }) => {
    await loginAsMindoo(page);
    /* the edge refuses the whole prefix; the page guard would refuse it again */
    for (const path of ["/b-systems", "/b-systems/crm", "/b-systems/users"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("a B-Systems account cannot open Mindoo either — the wall runs both ways", async ({
    page,
  }) => {
    await loginAsFounder(page);
    for (const path of ["/mindoo", "/mindoo/crm", "/mindoo/won-leads"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("Accounting opens for Mindoo, scoped to Mindoo alone", async ({ page }) => {
    /* founder: "having vault and accounting and the crm and to do and calender" */
    await loginAsMindoo(page);
    await page.goto("/accounting");
    await expect(page).toHaveURL(/\/accounting/);
    /* ONE company tab, and it is Mindoo — the module wears its brand */
    const companies = page.locator('[aria-label="Company"] .switcher-seg');
    await expect(companies).toHaveCount(1);
    await expect(companies.first()).toHaveText("Mindoo");
    await expect(page.locator('[data-brand="mindoo"]').first()).toBeVisible();
  });

  test("the Data Vault opens for Mindoo, and offers only Mindoo", async ({ page }) => {
    await loginAsMindoo(page);
    await page.goto("/vault/documents");
    await expect(page).toHaveURL(/\/vault\/documents/);
    const options = page.locator('select[name="company"] option');
    const values = await options.evaluateAll((els) =>
      els.map((el) => (el as HTMLOptionElement).value).filter(Boolean),
    );
    expect(values).toEqual(["mindoo"]);
  });

  test("and the B-Systems admin's own modules are untouched by all of it", async ({ page }) => {
    /* the regression that would be easiest to ship: adding a company must not
       add a tab to the books somebody has been reading for months */
    await loginAsFounder(page);
    await page.goto("/accounting");
    const companies = page.locator('[aria-label="Company"] .switcher-seg');
    await expect(companies).toHaveCount(2);
    await expect(companies.nth(0)).toHaveText("ByteForce");
    await expect(companies.nth(1)).toHaveText("B-Systems");

    await page.goto("/vault/documents");
    const values = await page
      .locator('select[name="company"] option')
      .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value).filter(Boolean));
    expect(values).toEqual(["byteforce", "bsystems"]);
  });


  test("its To-Do and Calendar link INTO Mindoo, never into B-Systems", async ({ page }) => {
    /* the sharpest bug an adversarial review found in this change: the To-Do
       and calendar projections built lead links with a two-value ternary, so
       every MINDOO row pointed at /b-systems — an address the proxy refuses for
       this account. Clicking your own To-Do logged you out. */
    await loginAsMindoo(page);
    for (const path of ["/mindoo/todo", "/mindoo/calendar"]) {
      await page.goto(path);
      const hrefs = await page
        .locator("main a[href]")
        .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).getAttribute("href")!));
      for (const href of hrefs) {
        expect(href, `${path} must not link into B-Systems`).not.toContain("/b-systems");
      }
    }
  });

  test("a Mindoo lead can be DELETED — the button has an endpoint behind it", async ({ page }) => {
    /* ADR-073 rendered Delete on two Mindoo screens and never added the route:
       the button confirmed and then answered 405. */
    await loginAsMindoo(page);
    const created = await page.request.post("/api/mindoo/leads", {
      data: { name: "Doomed Mindoo Lead", number: "0107779001", type: "cold_call" },
    });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const deleted = await page.request.delete(`/api/mindoo/leads/${id}`);
    expect(deleted.status(), "DELETE must exist in Mindoo's namespace").toBe(200);
  });

  test("a Mindoo won-deal document can be read back by the account that uploaded it", async ({
    page,
  }) => {
    /* the file route sorted attachments by the bsystems_admin role, so Mindoo
       uploaded a contract and then 403'd on the link beside it. */
    await loginAsMindoo(page);
    await page.goto("/mindoo/won-leads");
    /* the seed gives Mindoo one won deal with a milestone tab — Won Leads is a
       real screen for it, so an empty one would prove nothing */
    await expect(page.getByText("Alexandria Marine")).toBeVisible();
    await page.getByText("Alexandria Marine").first().click();
    await page.waitForURL(/\/mindoo\/won-leads\//);

    /* upload a contract, then read the bytes back through /api/files. Before
       ADR-074 the second half 403'd: the file route sorted attachments by the
       bsystems_admin role, so Mindoo could write a document and not read it. */
    const kind = page.getByLabel(/Document/i);
    await kind.selectOption("contract");
    await page.locator('input[type="file"]').setInputFiles({
      name: "mindoo-contract.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(512, 7)]),
    });
    await page.getByRole("button", { name: /Upload/i }).click();

    const link = page.locator('a[href^="/api/files/"]').first();
    await expect(link).toBeVisible();
    const href = (await link.getAttribute("href"))!;
    const res = await page.request.get(href);
    expect(res.status(), `${href} must be readable by its own company`).toBe(200);

    /* and the other company cannot read the same bytes by id */
    await loginAsFounder(page);
    const refused = await page.request.get(href);
    expect(refused.status(), "another company's id is not a key").toBe(404);
  });


  test("ADR-075 — Mindoo administers its OWN people, and B-Systems no longer sees them", async ({
    page,
  }) => {
    /* founder: "mindoo user should appear in mindoo system not in bsystems
       systems separate their users" */
    await loginAsMindoo(page);
    await page.goto("/mindoo/users");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    /* its own account is here… */
    await expect(page.getByText("admin@mindoo.com")).toBeVisible();
    /* …and nobody else's */
    await expect(page.getByText("admin@byteforce.com")).toHaveCount(0);
    /* the role boxes offer Mindoo's role and no B-Systems one */
    await page.getByRole("button", { name: /Add user/i }).click();
    await expect(page.getByText("Mindoo staff")).toBeVisible();
    for (const absent of ["B-Systems admin", "ByteForce staff", "B-Systems agent"]) {
      await expect(page.getByText(absent, { exact: true })).toHaveCount(0);
    }
  });

  test("ADR-075 — and B-Systems' Users list holds none of Mindoo's", async ({ page }) => {
    await loginAsFounder(page);
    await page.goto("/b-systems/users?company=bsystems");
    await expect(page.getByText("admin@byteforce.com")).toBeVisible();
    await expect(page.getByText("admin@mindoo.com")).toHaveCount(0);
    await expect(page.getByText("mona@mindoo.example")).toHaveCount(0);
  });

  test("ADR-076 — Mindoo's leads show on the BYTEFORCE board, labelled and inert", async ({
    page,
  }) => {
    /* founder: "the crm of mindoo should appear in byteforce crm as purple
       cards and not in bsystems crm" */
    await loginAsFounder(page);
    await page.goto("/b-systems/crm?company=byteforce");
    const card = page.locator('[data-deal-card="Nile Freight"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-foreign-company", "Mindoo");
    await expect(card.getByText("Mindoo", { exact: true })).toBeVisible();

    /* the whole card is purple, not a corner badge */
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, "the card ground carries the foreign-company tint").not.toBe("rgb(255, 255, 255)");

    /* INERT: no grip to drag by, and none of the actions that would post to
       ByteForce's namespace and be refused there */
    await expect(card.locator(".card-grip")).toHaveCount(0);
    await expect(card.getByRole("link", { name: /Call/i })).toHaveCount(0);

    /* clicking opens the READ-ONLY view */
    await card.click();
    await page.waitForURL(/\/b-systems\/crm\/company-lead\//);
    await expect(page.getByRole("heading", { name: "Nile Freight" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Edit|Archive|Delete|Assign/i })).toHaveCount(0);
  });

  test("ADR-076 — and NOT on the B-Systems board", async ({ page }) => {
    /* the second half of the same instruction, and the half that would rot
       quietly: moving a feature is only done when the old place is empty */
    await loginAsFounder(page);
    await page.goto("/b-systems/crm?company=bsystems");
    await expect(page.locator("[data-foreign-company]")).toHaveCount(0);
    await expect(page.locator('[data-deal-card="Nile Freight"]')).toHaveCount(0);
  });

  test("ADR-076 — a Negotiation lead sits in Sending Proposals and SAYS so", async ({ page }) => {
    /* Mindoo has a Negotiation stage; the ByteForce board has no such column.
       The founder chose to show those cards in Sending Proposals — so the card
       has to carry its real stage, or the column would be relabelling a deal. */
    await loginAsFounder(page);
    await page.goto("/b-systems/crm?company=byteforce");
    const card = page.locator('[data-deal-card="Red Sea Resorts"]');
    await expect(card).toBeVisible();
    await expect(
      page.locator('[data-stage="sending_proposal"] [data-deal-card="Red Sea Resorts"]'),
    ).toBeVisible();
    await expect(card.getByText("Negotiation")).toBeVisible();
  });

  test("ADR-075 — a non-admin never sees another company's leads", async ({ page }) => {
    /* the narrowing that keeps the window from becoming a leak: internal sales,
       agents and partners see their own pipeline and nobody else's */
    await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems/);
    await page.goto("/b-systems/crm?company=byteforce");
    await expect(page.locator("[data-foreign-company]")).toHaveCount(0);
    await expect(page.locator('[data-deal-card="Nile Freight"]')).toHaveCount(0);
    /* and the read-only route refuses him outright */
    const res = await page.goto("/b-systems/crm/company-lead/anything");
    expect(res?.status()).toBe(404);
  });


  test("ADR-076 — Mindoo's Accounting has only the sections he named", async ({ page }) => {
    /* founder: "for mindoo and only mindoo — accounting should only be :
       dashborad income expenses clients loans tresury and import export" */
    await loginAsMindoo(page);
    await page.goto("/accounting");
    const nav = page.locator(".app-nav");
    for (const kept of ["Income", "Expenses", "Clients", "Loans", "Treasury", "Import / Export"]) {
      await expect(nav.getByRole("link", { name: kept, exact: true })).toBeVisible();
    }
    for (const gone of ["Payroll Roster", "Media Buying", "Monthly P&L", "Departments", "Targets"]) {
      await expect(nav.getByRole("link", { name: gone, exact: true })).toHaveCount(0);
    }
    /* and a removed section is REFUSED, not merely hidden — a typed URL lands
       back on the dashboard rather than opening a page he does not have */
    for (const gone of ["roster", "report", "departments", "targets", "media"]) {
      await page.goto(`/accounting/${gone}`);
      await expect(page).toHaveURL(/\/accounting(\?|$)/);
    }
  });

  test("ADR-076 — Mindoo's Vault has only links, sheets and documents", async ({ page }) => {
    /* founder: "vault should only be : links and sheets and documents" */
    await loginAsMindoo(page);
    await page.goto("/vault");
    const nav = page.locator(".app-nav");
    for (const kept of ["Links", "Sheets", "Documents"]) {
      await expect(nav.getByRole("link", { name: kept, exact: true })).toBeVisible();
    }
    for (const gone of ["Forms", "Tasks", "Employees"]) {
      await expect(nav.getByRole("link", { name: gone, exact: true })).toHaveCount(0);
    }
    for (const gone of ["forms", "tasks", "employees"]) {
      await page.goto(`/vault/${gone}`);
      await expect(page).toHaveURL(/\/vault(\?|$)/);
    }
  });

  test("ADR-076 — and B-Systems' own modules keep every section", async ({ page }) => {
    /* the trim is "for mindoo and only mindoo"; the founder's own books and
       vault must be exactly what they were */
    await loginAsFounder(page);
    await page.goto("/accounting?company=bsystems");
    for (const kept of ["Payroll Roster", "Monthly P&L", "Departments", "Targets"]) {
      await expect(page.locator(".app-nav").getByRole("link", { name: kept, exact: true })).toBeVisible();
    }
    await page.goto("/vault");
    for (const kept of ["Forms", "Tasks", "Employees"]) {
      await expect(page.locator(".app-nav").getByRole("link", { name: kept, exact: true })).toBeVisible();
    }
  });

  test("Arabic: Mindoo keeps its name and the shell mirrors", async ({ page }) => {
    await loginAsMindoo(page);
    await page.goto("/mindoo/crm");
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    /* the brand scope survives the locale switch */
    await expect(page.locator("html")).toHaveAttribute("data-brand", "mindoo");
  });
});
