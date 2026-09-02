import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crmHomeFor, crmNavFor } from "./nav";
import {
  BS_CRM_ROLES,
  BS_PIPELINE_ROLES,
  CRM_COMPANIES,
  CRM_ROLES,
  MINDOO_ROLES,
  crmRolesFor,
  type CrmCompany,
} from "./company";
import { ROLES, type Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-067 — THE NAV TABLE, CHECKED AGAINST THE GUARDS THEMSELVES.

   nav.ts says of itself that it "is unit tested against the guards' own
   section map". Until Run 080 that sentence was false: the property was
   covered only by e2e/company-switch.spec.ts, which walks the RENDERED hrefs
   in a browser. That is a fine end-to-end check and a poor contract — it needs
   a database, a server and a login to say anything, so a maintainer editing
   BYTEFORCE_NAV or BSYSTEMS_NAV got no fast answer, and the comment promised
   one that did not exist (review, Run 080).

   This is that answer. It does not re-describe the nav — a test that restated
   the table would only assert the table equals itself. It reads each nav
   href's PAGE FILE and extracts, from the guard the page actually calls, the
   companies and roles that page admits. Then the property is a containment:

       every item crmNavFor(company, role) offers
         → is a page that EXISTS,
         → whose guard admits `company`,
         → whose guard admits `role`.

   i.e. THE NAV NEVER OFFERS A DOOR THE SERVER WOULD SHUT. The converse is
   deliberately NOT asserted: a guard wider than the nav is normal (Users
   admits the four pipeline roles and then bounces non-admins itself), and a
   section reachable by URL but absent from a nav is a product choice, not a
   defect.

   Reading the guard out of the source rather than duplicating a list is the
   same method as page-company-guards.test.ts, and for the same reason: the
   file on disk is the thing that runs.
   ========================================================================== */

const APP = path.join(process.cwd(), "src", "app", "(bsystems)", "b-systems", "(app)");

/** `/b-systems/todo` → the page file behind it; `/b-systems` → the root page. */
function pageFileFor(href: string): string {
  const rest = href.replace(/^\/b-systems\/?/, "");
  return path.join(APP, ...(rest ? rest.split("/") : []), "page.tsx");
}

/** The text of the first `fn(...)` call's arguments, paren-balanced. */
function callArgs(src: string, fn: string): string | null {
  const at = src.indexOf(`${fn}(`);
  if (at < 0) return null;
  const open = at + fn.length;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

const isRole = (s: string): s is Role => (ROLES as readonly string[]).includes(s);

/** The role set an argument list names — shared constants and/or literals.

    ADR-073 — it ACCUMULATES now instead of returning on the first constant it
    recognises. A guard can name more than one: Won Leads is
    `[...BS_PIPELINE_ROLES, ...MINDOO_ROLES]`, and a first-match reading of that
    reported only Mindoo's role and declared the page shut to every B-Systems
    role that has always had it. The union is what the spread actually means. */
function rolesFrom(args: string): Role[] {
  const found: Role[] = [];
  if (/\bBS_PIPELINE_ROLES\b/.test(args)) found.push(...BS_PIPELINE_ROLES);
  if (/\bBS_CRM_ROLES\b/.test(args)) found.push(...BS_CRM_ROLES);
  if (/\bCRM_ROLES\b/.test(args)) found.push(...CRM_ROLES);
  if (/\bMINDOO_ROLES\b/.test(args)) found.push(...MINDOO_ROLES);
  /* the company argument of requireCompanySection is a string literal too —
     it is filtered out here because "bsystems" is not a Role, "bsystems_admin" is */
  found.push(...[...args.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!).filter(isRole));
  return [...new Set(found)];
}

/** Which companies this page's guard admits. */
function companiesAdmitted(src: string): CrmCompany[] {
  if (/\brequireBsAdminCompanyPage\b/.test(src)) return ["bsystems"];
  const args = callArgs(src, "requireCompanySection");
  /* ADR-073 — a section can be pinned to SEVERAL companies now (Won Leads is
     B-Systems AND Mindoo), so collect every company literal in the argument
     list rather than only the first. */
  const pinned = [...(args ?? "").matchAll(/"(bsystems|byteforce|mindoo)"/g)].map(
    (m) => m[1] as CrmCompany,
  );
  if (pinned.length > 0) return [...new Set(pinned)];
  /* requireCompanyPage — a SHARED address, every company */
  return [...CRM_COMPANIES];
}

/** Which roles this page's guard admits WHEN rendering `company`. */
function rolesAdmitted(src: string, company: CrmCompany): Role[] {
  if (/\brequireBsAdminCompanyPage\b/.test(src)) return ["bsystems_admin"];
  const section = callArgs(src, "requireCompanySection");
  if (section) return rolesFrom(section);
  const narrow = callArgs(src, "narrowRoles");
  /* ADR-073 — the shared pages narrow through `crmRolesFor(company)`. Rather
     than parse a branch out of the source, ASK THE FUNCTION the page calls: it
     is the same object under test, so the two cannot drift. Strictly stronger
     than what stood here, which hand-special-cased ByteForce and assumed
     exactly one narrowRoles call per file — an assumption a third company with
     its own branch immediately broke. */
  if (narrow && /crmRolesFor/.test(narrow)) return [...crmRolesFor(company)];
  /* a shared page that still narrows by hand: under a single-staff-role company
     the company itself proves the role (companiesFor only ever reports a
     company a role already carries) */
  if (company === "byteforce") return ["byteforce_staff"];
  if (company === "mindoo") return [...MINDOO_ROLES];
  return narrow ? rolesFrom(narrow) : [...CRM_ROLES];
}

/* (company, role) pairs exactly as the shell computes them: ByteForce has one
   staff role and therefore one nav (bsRole is null there — see crmNavFor). */
const CASES: Array<{ company: CrmCompany; role: Role | null; as: Role }> = [
  { company: "byteforce", role: null, as: "byteforce_staff" },
  ...BS_CRM_ROLES.map((role) => ({ company: "bsystems" as const, role, as: role })),
  /* ADR-073 — Mindoo, like ByteForce, has one staff role and therefore one nav;
     `bsRole` is null there, exactly as crmNavFor expects. */
  { company: "mindoo", role: null, as: "mindoo_staff" },
];

describe("ADR-067 — the nav table never offers a door the guards would shut", () => {
  it("the sweep has real cases (a silent zero would prove nothing)", () => {
    expect(CASES.length).toBe(7); // ADR-073 added Mindoo
    expect(CASES.every((c) => crmNavFor(c.company, c.role).length > 0)).toBe(true);
  });

  it.each(CASES.map((c) => [`${c.company} / ${c.as}`, c] as const))(
    "%s — every nav href is a page that exists",
    (_label, c) => {
      for (const item of crmNavFor(c.company, c.role)) {
        const file = pageFileFor(item.href);
        expect(
          existsSync(file),
          `${item.href} is in the ${c.company} nav for ${c.as} but ${path.relative(
            process.cwd(),
            file,
          )} does not exist — the nav would render a 404 (ADR-067)`,
        ).toBe(true);
      }
    },
  );

  it.each(CASES.map((c) => [`${c.company} / ${c.as}`, c] as const))(
    "%s — every nav href's guard admits that COMPANY",
    (_label, c) => {
      for (const item of crmNavFor(c.company, c.role)) {
        const src = readFileSync(pageFileFor(item.href), "utf8");
        expect(
          companiesAdmitted(src),
          `${item.href} is in the ${c.company} nav, but its guard pins it to ` +
            `${companiesAdmitted(src).join("/")} — switched to ${c.company} that link ` +
            "bounces to the other company's home (ADR-067 decision 6)",
        ).toContain(c.company);
      }
    },
  );

  it.each(CASES.map((c) => [`${c.company} / ${c.as}`, c] as const))(
    "%s — every nav href's guard admits that ROLE",
    (_label, c) => {
      for (const item of crmNavFor(c.company, c.role)) {
        const src = readFileSync(pageFileFor(item.href), "utf8");
        expect(
          rolesAdmitted(src, c.company),
          `${item.href} is offered to ${c.as} under ${c.company}, but its guard admits ` +
            `only ${rolesAdmitted(src, c.company).join(", ")} — the nav would render a ` +
            "link that redirects the person who can see it (ADR-067)",
        ).toContain(c.as);
      }
    },
  );

  /* The ByteForce nav reuses the four SHARED addresses. A shared page is only
     safe there if it actually branches on the company — without that branch it
     would fall through to the B-Systems role narrowing, which does not include
     byteforce_staff, and every ByteForce teammate would be redirected off the
     nav item he was just handed. */
  it("every SHARED page in the ByteForce nav really has a ByteForce branch", () => {
    for (const item of crmNavFor("byteforce", null)) {
      const src = readFileSync(pageFileFor(item.href), "utf8");
      if (callArgs(src, "requireCompanySection")) continue; // company-pinned, not shared
      expect(
        /company === "byteforce"/.test(src),
        `${item.href} is in the ByteForce nav and resolves the company itself, but never ` +
          'branches on company === "byteforce" — it would fall through to the B-Systems ' +
          "role narrowing and bounce every ByteForce teammate (ADR-067)",
      ).toBe(true);
    }
  });

  /* crmHomeFor is where the header mark and every role bounce land, so it has
     to be a real destination for the SAME company and role — the property the
     redirects in page.tsx / leads/page.tsx explicitly lean on ("the role's own
     first destination, which by construction accepts this company and role"). */
  it.each(CASES.map((c) => [`${c.company} / ${c.as}`, c] as const))(
    "%s — crmHomeFor lands on a page this account can actually open",
    (_label, c) => {
      const home = crmHomeFor(c.company, c.role);
      const file = pageFileFor(home);
      expect(existsSync(file), `${home} does not exist`).toBe(true);
      const src = readFileSync(file, "utf8");
      expect(companiesAdmitted(src)).toContain(c.company);
      expect(rolesAdmitted(src, c.company)).toContain(c.as);
    },
  );

  /* An account with no role for a company gets NO items — never a borrowed set.
     This is the one place the table itself is the subject, because "returns
     nothing" cannot be read off a page file. */
  it("a company the account has no role for yields an EMPTY nav, not a borrowed one", () => {
    expect(crmNavFor("bsystems", null)).toEqual([]);
    expect(crmNavFor("bsystems", "byteforce_staff")).toEqual([]);
    expect(crmHomeFor("bsystems", null)).toBe("/b-systems");
  });
});
