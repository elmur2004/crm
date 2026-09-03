import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { landingFor } from "@/lib/auth/landing";
import { MINDOO_NAV, mindooNav } from "./nav";
import { CRM_COMPANIES, MINDOO_ROLES, companiesFor } from "./company";
import { MINDOO_SURFACE } from "./surface";

/* ============================================================================
   ADR-074 — THE SEPARATION, AS A TEST.

   Founder, verbatim: "also remove the switcher from bsystems system seperate
   them entirly nothing inside bsystems goes to mindoo and vice versa."

   That sentence is a property of the SOURCE TREE, not of any one function, so
   this file reads the tree. It is the sibling of page-company-guards.test.ts —
   same idea, same reason: a page added tomorrow must not be able to become the
   hole, and the directory is the only assertion that survives a new file.

   Three separate things are checked, and they fail for three different reasons:

     1. every Mindoo page is behind Mindoo's own wall,
     2. nothing in Mindoo's tree links back into the merged shell,
     3. nothing in the merged shell's tree links into Mindoo.

   (3) is the one that is easy to lose. The type system covers a lot of it —
   `CrmCompany` no longer contains "mindoo", so a Mindoo branch in the shell's
   own functions does not compile — but a bare string in an href typechecks
   perfectly, and a bare string is exactly how ADR-073 wrote these links.
   ========================================================================== */

const ROOT = process.cwd();
const MINDOO_APP = path.join(ROOT, "src", "app", "(mindoo)");
const MERGED_APP = path.join(ROOT, "src", "app", "(bsystems)");

const SERVER_ENTRIES = ["page.tsx", "route.ts"];

function filesUnder(dir: string, match?: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, match));
    else if (!match || match(entry)) out.push(full);
  }
  return out;
}

/** Line endings normalised and comments stripped — the two ways this kind of
    sweep has lied before (ACCESS AUDIT, Run 081). A guard named in prose must
    not satisfy a check that it is CALLED, and a company named in a comment must
    not fail a check for a link. */
function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const rel = (file: string) => path.relative(ROOT, file).replace(/\\/g, "/");

/** The page file an app href resolves to, or null. */
function pageFileFor(href: string, group: string): string | null {
  const route = href.split("?")[0]!;
  const file = path.join(ROOT, "src", "app", group, route, "page.tsx");
  return existsSync(file) ? file : null;
}

describe("ADR-074 — Mindoo is its own app, behind its own wall", () => {
  const pages = filesUnder(MINDOO_APP, (n) => SERVER_ENTRIES.includes(n));

  it("finds the whole route directory (a silent zero would prove nothing)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(9);
  });

  it.each(pages.map((p) => [rel(p), p] as const))("%s awaits requireMindooPage", (_r, file) => {
    expect(
      /await\s+requireMindooPage\s*\(/.test(codeOf(file)),
      `${rel(file)} must AWAIT requireMindooPage — without it the page renders ` +
        "Mindoo's data to whoever the proxy let through (ADR-074)",
    ).toBe(true);
  });

  it("no Mindoo page reaches for the merged shell's company guards", () => {
    /* `requireCompanyPage` and friends resolve a company of the MERGED shell,
       which by construction is never Mindoo. A Mindoo page that called one
       would redirect its own staff away from the app they just signed into. */
    const offenders = pages.filter((f) =>
      /\brequire(CompanyPage|CompanySection|BsAdminCompanyPage)\b/.test(codeOf(f)),
    );
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe("ADR-074 — nothing inside Mindoo goes to B-Systems", () => {
  const files = filesUnder(MINDOO_APP, (n) => /\.(ts|tsx)$/.test(n));

  it.each(files.map((p) => [rel(p), p] as const))("%s names no B-Systems address", (_r, file) => {
    const src = codeOf(file);
    expect(
      src.includes("/b-systems"),
      `${rel(file)} contains a "/b-systems" address. Mindoo's screens must ` +
        "link and post to Mindoo's own (MINDOO_SURFACE) — the founder's " +
        '"nothing inside bsystems goes to mindoo and vice versa" (ADR-074)',
    ).toBe(false);
  });

  it("the surface it does use points at Mindoo, and carries no company", () => {
    expect(MINDOO_SURFACE.basePath).toBe("/mindoo");
    expect(MINDOO_SURFACE.apiBase).toBe("/api/mindoo");
    /* the empty query is the whole reason this app cannot leak a company: there
       is no `?company=` to drop, to mistype, or to point at somebody else */
    expect(MINDOO_SURFACE.query).toBe("");
    expect(MINDOO_SURFACE.companyParam).toBeNull();
  });
});

describe("ADR-074/075 — and nothing inside B-Systems goes to Mindoo", () => {
  const files = filesUnder(MERGED_APP, (n) => /\.(ts|tsx)$/.test(n));

  /* ADR-075 — THE ONE WINDOW, and it is named.

     Founder: "mindoo leads should appear in bsystems crm with a label called
     mindoo and the card being a light purple color for the whole card to
     identify it… clickable, opens the lead read-only."

     So the wall is no longer "the merged shell never says Mindoo" — it is the
     stricter and more useful pair of claims below. The ADDRESS wall is
     unchanged and absolute: nothing here links into /mindoo or posts to
     /api/mindoo, because those are refused for a B-Systems account and a link
     that logs you out is the bug this file was written for. What ADR-075 allows
     is READING Mindoo's rows under a B-Systems address, in the two files that
     do it, listed here so a third cannot join them quietly. */
  const READS_MINDOO: Array<{ file: string; why: string }> = [
    {
      file: "src/app/(bsystems)/b-systems/(app)/crm/company-lead/[leadId]/page.tsx",
      why: "ADR-075 — the read-only window on a Mindoo lead: admin only, brand pinned in code, no control that writes",
    },
  ];

  it.each(files.map((p) => [rel(p), p] as const))(
    "%s links to no Mindoo ADDRESS",
    (_r, file) => {
      const src = codeOf(file);
      expect(
        /["'`]\/mindoo|\/api\/mindoo|company=mindoo/.test(src),
        `${rel(file)} names a Mindoo ADDRESS. A B-Systems account cannot open ` +
          "/mindoo — the proxy refuses it — so a link there logs the reader out, " +
          "and /api/mindoo refuses its writes (ADR-074).",
      ).toBe(false);
    },
  );

  it("only the listed files read Mindoo's rows at all", () => {
    const allowed = new Set(READS_MINDOO.map((a) => a.file));
    const offenders = files
      .filter((f) => /"mindoo"|'mindoo'/.test(codeOf(f)))
      .map(rel)
      .filter((f) => !allowed.has(f));
    expect(
      offenders,
      "these files name the Mindoo BRAND. Reading another company's rows from " +
        "the merged shell is allowed only where ADR-075 says so — add the file " +
        "to READS_MINDOO with a reason, or take the reference out.",
    ).toEqual([]);
  });

  it("every listed file still exists (a stale allowlist is a lie)", () => {
    for (const a of READS_MINDOO) {
      expect(files.map(rel), `${a.file} is allow-listed but not in the tree`).toContain(a.file);
    }
  });

  it("the shell's own company list does not contain it", () => {
    expect([...CRM_COMPANIES]).toEqual(["bsystems", "byteforce"]);
    /* and holding Mindoo's role grants nothing here — the narrowing law */
    expect(companiesFor([...MINDOO_ROLES])).toEqual([]);
  });
});

describe("ADR-074 — Mindoo's nav is a set of doors that open", () => {
  it("every nav href is a page that exists, under Mindoo's own group", () => {
    for (const item of mindooNav()) {
      expect(
        pageFileFor(item.href, "(mindoo)"),
        `${item.href} is offered in Mindoo's nav but has no page.tsx`,
      ).not.toBeNull();
    }
  });

  it("every nav href is a MINDOO address", () => {
    for (const item of MINDOO_NAV) expect(item.href.startsWith("/mindoo")).toBe(true);
  });

  it("carries the lead sections and NOT the partner/agent subsystem", () => {
    /* founder: "no partners or regestrations or agents or their crm at all" —
       and ADR-075 added Users, because he then asked for Mindoo's people to be
       administered inside Mindoo rather than from B-Systems. */
    const hrefs = MINDOO_NAV.map((i) => i.href);
    expect(hrefs).toEqual([
      "/mindoo",
      "/mindoo/todo",
      "/mindoo/calendar",
      "/mindoo/leads",
      "/mindoo/crm",
      "/mindoo/won-leads",
      "/mindoo/users",
    ]);
    /* the partner/agent subsystem stays out, whatever else is added */
    for (const absent of ["partners", "agents", "registrations", "statements", "payments"]) {
      expect(hrefs.some((h) => h.includes(absent))).toBe(false);
    }
  });

  it("sign-in lands a Mindoo account in Mindoo, on a page that exists", () => {
    const target = landingFor([...MINDOO_ROLES]);
    expect(target).toBe("/mindoo");
    expect(pageFileFor(target, "(mindoo)")).not.toBeNull();
  });
});

describe("ADR-074 — the edge gate matches the page walls", () => {
  const proxy = codeOf(path.join(ROOT, "src", "proxy.ts"));

  it("/mindoo is in the matcher, or the wall never runs", () => {
    expect(proxy).toMatch(/"\/mindoo\/:path\*"/);
  });

  it("/mindoo admits mindoo_staff and nothing else", () => {
    const branch = proxy.slice(proxy.indexOf('pathname.startsWith("/mindoo")'));
    const body = branch.slice(0, branch.indexOf("}"));
    expect(body).toContain('roles.includes("mindoo_staff")');
    for (const role of ["bsystems_admin", "bsystems_sales", "byteforce_staff"]) {
      expect(body).not.toContain(role);
    }
  });

  it("/b-systems no longer admits mindoo_staff", () => {
    const branch = proxy.slice(proxy.indexOf('pathname.startsWith("/b-systems")'));
    const body = branch.slice(0, branch.indexOf("return true;"));
    expect(body).not.toContain('roles.includes("mindoo_staff")');
  });
});
