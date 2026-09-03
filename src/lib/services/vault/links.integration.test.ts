import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
   ADR-070 — the Data Vault's LINKS section, proved at the layer that decides.

   Founder: "a section for the important, repeated links we keep needing to find
   again — a portfolio, a content calendar, a video used over and over, a Drive
   folder or Sheet, a document, an image, a website, a reference… so the Vault
   is not only a place for Sheets, Forms and Archive, but also a central place
   to keep any important or repeated resources we use constantly, instead of
   hunting for them every time."

   What is proved here: the http/https-only URL rule (server-side, including a
   real javascript: payload), the closed Type list, the free-text Category and
   its near-duplicate folding, the duplicate-URL handshake, archive-not-delete,
   company scoping and the section's own filters — and the WALL: an admin
   blocked from the Data Vault (ADR-066) reaches none of the three new routes.

   The session is the only thing mocked; the routes, the guards, the service and
   Postgres are all real (the module-access.integration.test.ts pattern).
   ========================================================================== */

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ user?: { id: string } } | null>>(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import type { Actor } from "../activity";
import { pendingUndoFor, performUndo } from "../undo";
import {
  archiveVaultLink,
  createVaultLink,
  listVaultLinkCategories,
  listVaultLinks,
  restoreVaultLink,
  updateVaultLink,
  vaultLinkListParams,
  vaultLinkSchema,
} from "./links";
import { searchVault } from "./search";
import { vaultOverview } from "./overview";
import { POST as postLink } from "@/app/api/vault/links/route";
import { PATCH as patchLink } from "@/app/api/vault/links/[id]/route";
import { POST as archiveLink } from "@/app/api/vault/links/[id]/archive/route";
import { VAULT_COMPANIES } from "./constants";

/* ADR-074 — these tests exercise the SERVICES, not the tenancy wall: they
   pass the whole platform so every assertion here keeps meaning exactly what
   it meant before the wall existed. The wall itself is proved separately, in
   src/lib/module-companies.test.ts and vault-tenancy.integration.test.ts. */
const ALL_COMPANIES = VAULT_COMPANIES;

const actor: Actor = { id: "vault-admin", label: "Admin" };
const other: Actor = { id: "someone-else", label: "Else" };

/* the RAW shape a browser posts. Deliberately not the parsed output: parsing
   turns an absent `notes` into null, and re-posting null would 400 on the very
   `.optional()` that made it — a trap worth keeping visible. */
const raw = (over: Record<string, unknown> = {}) => ({
  company: "byteforce",
  name: "ByteForce Portfolio",
  url: "https://byteforce.example/portfolio",
  category: "Portfolio",
  type: "website",
  ...over,
});

const link = (over: Record<string, unknown> = {}) => vaultLinkSchema.parse(raw(over));

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
});

/* ---------------------------------------------------------------- the URL */

describe("the URL is untrusted input, and the server is the wall", () => {
  it("accepts http and https, and NOTHING else", () => {
    expect(link({ url: "http://drive.example/folder" }).url).toBe("http://drive.example/folder");
    expect(link({ url: "https://drive.example/folder" }).url).toBe("https://drive.example/folder");

    /* the one that matters: a javascript: URL rendered into an href is a
       cross-site-scripting payload with a click on it */
    expect(() => link({ url: "javascript:alert(document.cookie)" })).toThrow(/http/i);
    expect(() => link({ url: "JavaScript:alert(1)" })).toThrow(/http/i);
    expect(() => link({ url: "data:text/html,<script>alert(1)</script>" })).toThrow(/http/i);
    /* scheme-relative: `new URL()` alone cannot even parse it, so it is caught
       by the same rule and never becomes //evil.example in an href */
    expect(() => link({ url: "//evil.example/portfolio" })).toThrow();
    expect(() => link({ url: "ftp://files.example/x" })).toThrow(/http/i);
    expect(() => link({ url: "not a url at all" })).toThrow();
  });

  it("the REST ROUTE refuses it too — the browser is not the validator", async () => {
    const admin = await makeAdmin("Vault admin");
    authMock.mockResolvedValue({ user: { id: admin.id } });

    const res = await postLink(
      new Request("http://localhost/api/vault/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: "byteforce",
          name: "Sneaky",
          url: "javascript:alert(1)",
          category: "Other",
          type: "website",
        }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await db.vaultLink.count()).toBe(0);
  });
});

/* --------------------------------------------------------------- the type */

describe("Type is a CLOSED list of the founder's eight", () => {
  it("takes each of the eight and refuses anything else", () => {
    for (const type of [
      "video",
      "image",
      "document",
      "sheet",
      "form",
      "folder",
      "website",
      "other",
    ]) {
      expect(link({ type }).type).toBe(type);
    }
    expect(() => link({ type: "podcast" })).toThrow();
    expect(() => link({ type: "" })).toThrow();
  });
});

/* ----------------------------------------------------------- the category */

describe("Category is FREE TEXT with suggestions, not a closed list", () => {
  it("stores a category that is not one of the eight, exactly as typed", async () => {
    const row = await createVaultLink(link({ category: "Investor Deck Q4" }), ALL_COMPANIES, actor);
    expect(row.category).toBe("Investor Deck Q4");
  });

  it("folds case and stray whitespace onto the spelling already on file", async () => {
    await createVaultLink(link({ category: "Content Calendar" }), ALL_COMPANIES, actor);
    const second = await createVaultLink(
      link({ url: "https://x.example/2", category: "  content   calendar " }),
      ALL_COMPANIES,
      actor,
    );
    /* his second typing is the SAME category to a human — the list must not
       grow a near-duplicate for a shift key */
    expect(second.category).toBe("Content Calendar");
    expect(await listVaultLinkCategories(ALL_COMPANIES)).toEqual(["Content Calendar"]);
  });

  it("a category that only matches one of OUR suggestions takes the suggestion's spelling", async () => {
    const row = await createVaultLink(link({ category: "pORTFOLIO" }), ALL_COMPANIES, actor);
    expect(row.category).toBe("Portfolio");
  });

  it("an ARCHIVED link still owns its spelling, but leaves the offered list", async () => {
    const first = await createVaultLink(link({ category: "Brand Kit" }), ALL_COMPANIES, actor);
    await archiveVaultLink(first.id, actor);
    expect(await listVaultLinkCategories(ALL_COMPANIES)).toEqual([]); // nothing live carries it

    const second = await createVaultLink(
      link({ url: "https://x.example/3", category: "brand kit" }),
      ALL_COMPANIES,
      actor,
    );
    expect(second.category).toBe("Brand Kit"); // restoring the first cannot split the word
  });

  it("a category typed in Arabic is stored verbatim — his words are never translated", async () => {
    /* deliberately NOT one of our eight: his own Arabic words, which we could
       not translate even if we wanted to (ADR-070 §4) */
    const row = await createVaultLink(link({ category: "عرض المستثمرين" }), ALL_COMPANIES, actor);
    expect(row.category).toBe("عرض المستثمرين");
    expect(await listVaultLinkCategories(ALL_COMPANIES)).toEqual(["عرض المستثمرين"]);
  });

  it("OUR OWN eight are ONE category in two languages, not two categories", async () => {
    /* the language toggle sits on this very page. Picking the Arabic half of a
       suggestion whose English half is already on file must not open a second,
       disjoint category holding half his links — that is our vocabulary
       producing the exact near-duplicate the fold exists to end. */
    await createVaultLink(link({ category: "Portfolio" }), ALL_COMPANIES, actor);
    const arabic = await createVaultLink(
      link({ url: "https://x.example/ar", category: "بورتفوليو" }),
      ALL_COMPANIES,
      actor,
    );
    expect(arabic.category).toBe("Portfolio");
    expect(await listVaultLinkCategories(ALL_COMPANIES)).toEqual(["Portfolio"]);

    /* and the other way round: with nothing on file the half he picked is what
       is stored, so an Arabic-first vault is Arabic */
    await resetDb();
    const first = await createVaultLink(link({ category: "بورتفوليو" }), ALL_COMPANIES, actor);
    expect(first.category).toBe("بورتفوليو");
    const english = await createVaultLink(
      link({ url: "https://x.example/en", category: "Portfolio" }),
      ALL_COMPANIES,
      actor,
    );
    expect(english.category).toBe("بورتفوليو");
    expect(await listVaultLinkCategories(ALL_COMPANIES)).toEqual(["بورتفوليو"]);
  });

  it("he can RE-SPELL his own category by editing it — the first spelling is not a life sentence", async () => {
    const row = await createVaultLink(link({ category: "investor deck q4" }), ALL_COMPANIES, actor);
    /* without excluding the row itself from the scan, its own old spelling is
       "already on file" and the correction is silently discarded */
    const fixed = await updateVaultLink(row.id, link({ category: "Investor Deck Q4" }), ALL_COMPANIES, actor);
    expect(fixed.category).toBe("Investor Deck Q4");
    expect(await listVaultLinkCategories(ALL_COMPANIES)).toEqual(["Investor Deck Q4"]);
  });

  it("a re-spelling renames the WHOLE category, archived rows included — one word, one spelling", async () => {
    const a = await createVaultLink(link({ category: "investor deck q4" }), ALL_COMPANIES, actor);
    const b = await createVaultLink(
      link({ url: "https://x.example/b", category: "INVESTOR DECK Q4" }),
      ALL_COMPANIES,
      actor,
    );
    const c = await createVaultLink(
      link({ url: "https://x.example/c", category: "investor deck q4" }),
      ALL_COMPANIES,
      actor,
    );
    expect(b.category).toBe("investor deck q4"); // folded on the way in
    await archiveVaultLink(c.id, actor);

    await updateVaultLink(a.id, link({ category: "Investor Deck Q4" }), ALL_COMPANIES, actor);

    /* every live row wears his correction… */
    const live = await listVaultLinks(vaultLinkListParams.parse({}), ALL_COMPANIES);
    expect(live.map((r) => r.category)).toEqual(["Investor Deck Q4", "Investor Deck Q4"]);
    expect(await listVaultLinkCategories(ALL_COMPANIES)).toEqual(["Investor Deck Q4"]);
    /* …and so does the ARCHIVED one, or restoring it later would split the
       category back into two spellings */
    expect((await db.vaultLink.findUnique({ where: { id: c.id } }))!.category).toBe(
      "Investor Deck Q4",
    );
  });

  it("re-typing one of OUR eight is still normalised to ours, not treated as a re-spelling", async () => {
    const row = await createVaultLink(link({ category: "Portfolio" }), ALL_COMPANIES, actor);
    const edited = await updateVaultLink(row.id, link({ category: "portfolio" }), ALL_COMPANIES, actor);
    expect(edited.category).toBe("Portfolio"); // the system's vocabulary, spelled ours
  });

  it("an empty or whitespace-only category is refused", () => {
    expect(() => link({ category: "   " })).toThrow();
    expect(() => link({ category: "" })).toThrow();
  });
});

/* ------------------------------------------------------- the URL handshake */

describe("the duplicate-URL handshake — the Forms rule, verbatim", () => {
  it("warns (409) naming the clash, and files it when acknowledged", async () => {
    await createVaultLink(link({ name: "ByteForce Portfolio" }), ALL_COMPANIES, actor);

    await expect(
      createVaultLink(link({ name: "Same page, other name" }), ALL_COMPANIES, actor),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("ByteForce Portfolio"),
    });

    const second = await createVaultLink(
      link({ name: "Same page, other name", acknowledgeDuplicate: true }),
      ALL_COMPANIES,
      actor,
    );
    expect(second.id).toBeTruthy();
    expect(await listVaultLinks(vaultLinkListParams.parse({}), ALL_COMPANIES)).toHaveLength(2);
  });

  it("an ARCHIVED link does not block re-filing its URL, and editing ignores self", async () => {
    const first = await createVaultLink(link(), ALL_COMPANIES, actor);
    await archiveVaultLink(first.id, actor);
    const again = await createVaultLink(link({ name: "Filed again" }), ALL_COMPANIES, actor);
    expect(again.id).toBeTruthy();

    /* saving a link without changing its URL must not clash with itself */
    const saved = await updateVaultLink(again.id, link({ name: "Renamed" }), ALL_COMPANIES, actor);
    expect(saved.name).toBe("Renamed");
  });
});

/* ------------------------------------------------------------ the removal */

describe("removal is the vault's ARCHIVE, never a delete", () => {
  it("archiving leaves the list and the row survives, restorable and intact", async () => {
    const row = await createVaultLink(link({ notes: "the one we send clients" }), ALL_COMPANIES, actor);
    await archiveVaultLink(row.id, actor);

    expect(await listVaultLinks(vaultLinkListParams.parse({}), ALL_COMPANIES)).toHaveLength(0);
    const archived = await listVaultLinks(vaultLinkListParams.parse({ archived: "true" }), ALL_COMPANIES);
    expect(archived).toHaveLength(1);
    expect(archived[0]!.archivedAt).not.toBeNull();
    expect(await db.vaultLink.count()).toBe(1); // nothing was destroyed

    /* an archived record is read-only except restore (the ADR-043 hardening) */
    await expect(updateVaultLink(row.id, link({ name: "Renamed" }), ALL_COMPANIES, actor)).rejects.toMatchObject({
      status: 400,
    });

    await restoreVaultLink(row.id, actor);
    expect(await db.vaultLink.findUnique({ where: { id: row.id } })).toMatchObject({
      archived: false,
      archivedAt: null,
      name: "ByteForce Portfolio",
      notes: "the one we send clients",
    });
  });

  it("archiving a link is UNDOABLE, like every other vault archive", async () => {
    const row = await createVaultLink(link({ name: "Undo me" }), ALL_COMPANIES, actor);
    await archiveVaultLink(row.id, actor);

    expect((await pendingUndoFor(actor.id!))?.label).toContain("Undo me");
    await performUndo(actor);
    expect(await db.vaultLink.findUnique({ where: { id: row.id } })).toMatchObject({
      archived: false,
      archivedAt: null,
    });
    /* and it stays personal — someone else's button offers nothing */
    expect(await pendingUndoFor(other.id!)).toBeNull();
  });

  it("the archive round trip goes through the ROUTE as well", async () => {
    const admin = await makeAdmin("Route admin");
    authMock.mockResolvedValue({ user: { id: admin.id } });
    const row = await createVaultLink(link(), ALL_COMPANIES, actor);

    const archived = await archiveLink(jsonReq({ value: true }), { params: idOf(row.id) });
    expect(archived.status).toBe(200);
    expect((await db.vaultLink.findUniqueOrThrow({ where: { id: row.id } })).archived).toBe(true);

    const restored = await archiveLink(jsonReq({ value: false }), { params: idOf(row.id) });
    expect(restored.status).toBe(200);
    expect((await db.vaultLink.findUniqueOrThrow({ where: { id: row.id } })).archived).toBe(false);
  });
});

/* ------------------------------------------------- scoping, filters, lists */

describe("company scoping and the filters that keep fifty links usable", () => {
  const seed = async () => {
    await createVaultLink(
      link({ name: "BF portfolio", company: "byteforce", category: "Portfolio", type: "website" }),
      ALL_COMPANIES,
      actor,
    );
    await createVaultLink(
      link({
        name: "BS content calendar",
        url: "https://sheets.example/cal",
        company: "bsystems",
        category: "Content Calendar",
        type: "sheet",
      }),
      ALL_COMPANIES,
      actor,
    );
    await createVaultLink(
      link({
        name: "BS showreel",
        url: "https://video.example/reel",
        company: "bsystems",
        category: "Marketing",
        type: "video",
      }),
      ALL_COMPANIES,
      actor,
    );
  };

  it("filters by company exactly the way a Form or a Sheet does", async () => {
    await seed();
    const bf = await listVaultLinks(vaultLinkListParams.parse({ company: "byteforce" }), ALL_COMPANIES);
    expect(bf.map((r) => r.name)).toEqual(["BF portfolio"]);
    const bs = await listVaultLinks(vaultLinkListParams.parse({ company: "bsystems" }), ALL_COMPANIES);
    expect(bs.map((r) => r.name).sort()).toEqual(["BS content calendar", "BS showreel"]);
    /* no filter = every company, the module's convention */
    expect(await listVaultLinks(vaultLinkListParams.parse({}), ALL_COMPANIES)).toHaveLength(3);
  });

  it("filters by category and by type, and searches name, category, notes and URL", async () => {
    await seed();
    expect(
      (await listVaultLinks(vaultLinkListParams.parse({ category: "Marketing" }), ALL_COMPANIES)).map(
        (r) => r.name,
      ),
    ).toEqual(["BS showreel"]);
    expect(
      (await listVaultLinks(vaultLinkListParams.parse({ type: "sheet" }), ALL_COMPANIES)).map((r) => r.name),
    ).toEqual(["BS content calendar"]);
    /* two filters compose */
    expect(
      await listVaultLinks(vaultLinkListParams.parse({ company: "byteforce", type: "sheet" }), ALL_COMPANIES),
    ).toHaveLength(0);
    /* the category he typed is a search term, because it is his word for it */
    expect(
      (await listVaultLinks(vaultLinkListParams.parse({ q: "calendar" }), ALL_COMPANIES)).map((r) => r.name),
    ).toEqual(["BS content calendar"]);
    expect(
      (await listVaultLinks(vaultLinkListParams.parse({ q: "video.example" }), ALL_COMPANIES)).map((r) => r.name),
    ).toEqual(["BS showreel"]);
  });

  it("the category filter matches EXACTLY — a % or _ in his own words is not a wildcard", async () => {
    /* Prisma compiles `equals` + `mode: "insensitive"` to `ILIKE $1` on
       Postgres (verified against a real cluster), and ILIKE reads % and _ in
       the value as wildcards. Unescaped, `?category=%` would return the whole
       vault while the filter box claimed to hold one category. */
    await createVaultLink(link({ category: "Q4_2026" }), ALL_COMPANIES, actor);
    await createVaultLink(link({ url: "https://x.example/2", category: "Q4x2026" }), ALL_COMPANIES, actor);
    await createVaultLink(link({ url: "https://x.example/3", category: "100% Organic" }), ALL_COMPANIES, actor);

    expect(
      (await listVaultLinks(vaultLinkListParams.parse({ category: "Q4_2026" }), ALL_COMPANIES)).map(
        (r) => r.category,
      ),
    ).toEqual(["Q4_2026"]);
    expect(
      (await listVaultLinks(vaultLinkListParams.parse({ category: "100% Organic" }), ALL_COMPANIES)).map(
        (r) => r.category,
      ),
    ).toEqual(["100% Organic"]);
    /* the one that used to return everything */
    expect(await listVaultLinks(vaultLinkListParams.parse({ category: "%" }), ALL_COMPANIES)).toHaveLength(0);
    /* case-insensitivity, the point of the mode, still works */
    expect(
      await listVaultLinks(vaultLinkListParams.parse({ category: "q4_2026" }), ALL_COMPANIES),
    ).toHaveLength(1);
  });

  it("a nonsense filter falls back instead of 400ing the whole page", () => {
    const params = vaultLinkListParams.parse({ company: "acme", type: "podcast", archived: "no" });
    expect(params.company).toBeUndefined();
    expect(params.type).toBeUndefined();
  });

  it("newest first, the Forms ordering", async () => {
    await createVaultLink(link({ name: "First" }), ALL_COMPANIES, actor);
    await createVaultLink(link({ name: "Second", url: "https://x.example/2" }), ALL_COMPANIES, actor);
    expect((await listVaultLinks(vaultLinkListParams.parse({}), ALL_COMPANIES)).map((r) => r.name)).toEqual([
      "Second",
      "First",
    ]);
  });

  it("links join the vault-wide search and the overview counts", async () => {
    const row = await createVaultLink(link({ category: "Portfolio" }), ALL_COMPANIES, actor);
    const hits = await searchVault("portfolio", ALL_COMPANIES);
    expect(hits.groups.links.map((h) => h.title)).toEqual(["ByteForce Portfolio"]);
    expect(hits.groups.links[0]!.subtitle).toBe("Portfolio");
    expect(hits.total).toBeGreaterThan(0);

    expect((await vaultOverview(ALL_COMPANIES)).links).toBe(1);
    await archiveVaultLink(row.id, actor);
    const after = await vaultOverview(ALL_COMPANIES);
    expect(after.links).toBe(0);
    expect(after.archived).toBe(1); // it moved, it did not vanish
    /* an archived record never surfaces in search (the module's rule) */
    expect((await searchVault("portfolio", ALL_COMPANIES)).groups.links).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------- the wall */

describe("the wall is the VAULT's wall — ADR-066 included", () => {
  it("an admin BLOCKED from the Data Vault reaches none of the three routes", async () => {
    const blocked = await makeAdmin("Blocked admin", { canAccessVault: false });
    const row = await createVaultLink(link(), ALL_COMPANIES, actor);
    authMock.mockResolvedValue({ user: { id: blocked.id } });

    const calls: Array<[string, Promise<Response>]> = [
      ["POST /api/vault/links", postLink(jsonReq(raw()))],
      ["PATCH /api/vault/links/[id]", patchLink(jsonReq(raw()), { params: idOf(row.id) })],
      [
        "POST /api/vault/links/[id]/archive",
        archiveLink(jsonReq({ value: true }), { params: idOf(row.id) }),
      ],
    ];
    for (const [label, call] of calls) {
      const res = await call;
      expect(res.status, label).toBe(403);
      /* the refusal NAMES what was refused, like every other module 403 */
      expect(JSON.stringify(await res.json())).toContain("Data Vault");
    }
    /* and nothing was written by any of them */
    expect(await db.vaultLink.count()).toBe(1);
    expect((await db.vaultLink.findUniqueOrThrow({ where: { id: row.id } })).archived).toBe(false);
  });

  it("an allowed admin passes the same three routes — the flag is the whole difference", async () => {
    const allowed = await makeAdmin("Allowed admin");
    authMock.mockResolvedValue({ user: { id: allowed.id } });

    const created = await postLink(jsonReq(raw()));
    expect(created.status).toBe(201);
    const row = (await created.json()) as { id: string; category: string };
    expect(row.category).toBe("Portfolio");

    const edited = await patchLink(jsonReq(raw({ name: "Renamed by the route" })), {
      params: idOf(row.id),
    });
    expect(edited.status).toBe(200);
    expect((await db.vaultLink.findUniqueOrThrow({ where: { id: row.id } })).name).toBe(
      "Renamed by the route",
    );
  });

  it("a non-admin and an anonymous caller never get as far as the flag", async () => {
    const sales = await makeUser("Omar Sales", "bsystems_sales");
    authMock.mockResolvedValue({ user: { id: sales.id } });
    expect((await postLink(jsonReq(raw()))).status).toBe(403);

    authMock.mockResolvedValue(null);
    expect((await postLink(jsonReq(raw()))).status).toBe(401);
    expect(await db.vaultLink.count()).toBe(0);
  });
});

/* ------------------------------------------------------------------ setup */

let seq = 0;

async function makeUser(name: string, role: string, flags: Record<string, boolean> = {}) {
  return db.user.create({
    data: {
      name,
      phone: `+2010777000${seq++}`,
      passwordHash: "x",
      ...flags,
      roles: { create: [{ role }] },
    },
  });
}

const makeAdmin = (name: string, flags: Record<string, boolean> = {}) =>
  makeUser(name, "bsystems_admin", flags);

const jsonReq = (body: unknown) =>
  new Request("http://localhost/api/vault/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const idOf = (id: string) => Promise.resolve({ id });
