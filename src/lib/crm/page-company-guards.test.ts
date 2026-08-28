import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================================
   ADR-067 — THE ANTI-HOLE SWEEP.

   The company rides the URL as `?company=`, and a Next server LAYOUT can read
   neither searchParams nor the pathname. So the layout can only enforce "this
   account holds SOME company"; the per-company refusal has to live in every
   page's own guard. That is the structural weakness of the query-parameter
   choice, and it has exactly one honest mitigation: make the DIRECTORY the
   assertion, so a page added tomorrow cannot quietly become the hole.

   This is the shape ADR-066 already established for the two module namespaces
   (module-access.integration.test.ts reads both API directories and fails if a
   route reaches for the wrong guard). Same idea, cheaper — no database needed,
   because the question is purely "does this file call a company-aware guard".

   It matters more here than it did there: /b-systems now admits
   `byteforce_staff` at the edge, so every B-Systems-only page is reachable by a
   ByteForce-only account and is held shut by its own guard alone.
   ========================================================================== */

const APP = path.join(process.cwd(), "src", "app", "(bsystems)", "b-systems", "(app)");

const COMPANY_GUARDS = [
  "requireCompanyPage",
  "requireCompanySection",
  "requireBsAdminCompanyPage",
];

function pagesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pagesUnder(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

describe("every merged CRM page states which company it is for", () => {
  const pages = pagesUnder(APP);

  it("finds the whole route directory (a silent zero would prove nothing)", () => {
    /* the sweep is worthless if the glob breaks and quietly matches nothing */
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it.each(pagesUnder(APP).map((p) => [path.relative(APP, p), p] as const))(
    "%s calls a company-aware guard",
    (_rel, file) => {
      const src = readFileSync(file, "utf8");
      const called = COMPANY_GUARDS.filter((g) => src.includes(g));
      expect(
        called,
        `${path.relative(process.cwd(), file)} must call one of ${COMPANY_GUARDS.join(" / ")} — ` +
          "without it the page renders whichever company the URL asks for, and a " +
          "ByteForce-only account can reach a B-Systems screen (ADR-067)",
      ).not.toHaveLength(0);
    },
  );

  it.each(pagesUnder(APP).map((p) => [path.relative(APP, p), p] as const))(
    "%s does not reach for a guard that cannot see the company",
    (_rel, file) => {
      const src = readFileSync(file, "utf8");
      /* `requirePageRole` and `requireBsAdminPage` know nothing about the
         company; a merged page that used one would be open to both. The
         company-aware guards call them internally — that is the only place
         they belong now. */
      expect(src).not.toMatch(/\brequireBsAdminPage\b/);
      expect(src).not.toMatch(/\brequirePageRole\b/);
    },
  );

  it("a page that only resolves the company still narrows its ROLES", () => {
    /* `requireCompanyPage` answers "which company" and deliberately nothing
       else. The four addresses both companies share therefore have to narrow
       roles themselves — and the merged shell now lets every CRM role through
       the door, including the add-only data-entry account that ADR-051 carved
       out of every pipeline screen. A shared page that skipped `narrowRoles`
       would silently re-grant it, which is exactly the regression the
       data-entry e2e caught on the first draft of these guards. */
    for (const file of pagesUnder(APP)) {
      const src = readFileSync(file, "utf8");
      if (!/\brequireCompanyPage\b/.test(src)) continue;
      expect(
        src,
        `${path.relative(process.cwd(), file)} resolves the company but never narrows the ` +
          "roles — add narrowRoles(...) for the B-Systems branch (ADR-067)",
      ).toMatch(/\bnarrowRoles\b/);
    }
  });

  it("no merged page calls the THROWING bsRoleOf before its company is settled", () => {
    /* bsRoleOf throws for an account with no B-Systems role — a 500 where a
       redirect belongs. It is total (and therefore fine) only AFTER
       requireCompanySection("bsystems") has run, because holding "bsystems" is
       exactly holding one of the five B-Systems roles. Anywhere else, the
       total bsRoleOrNull is the one to use. */
    for (const file of pagesUnder(APP)) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("bsRoleOf")) continue;
      expect(
        src.includes('requireCompanySection(\n    "bsystems"') ||
          src.includes('requireCompanySection("bsystems"'),
        `${path.relative(process.cwd(), file)} calls bsRoleOf without first pinning the ` +
          "company to bsystems — use bsRoleOrNull, or narrow the company first (ADR-067)",
      ).toBe(true);
    }
  });
});
