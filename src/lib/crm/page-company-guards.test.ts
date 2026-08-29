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

   ---- ACCESS AUDIT, Run 081 ------------------------------------------------

   BUG-015 was one guard test in this file that could not FAIL. The audit found
   two more ways the same file could lie about the walls it checks, and both are
   closed below:

   · it read the source BYTE FOR BYTE, and its last needle contained a literal
     newline. On a Windows checkout (`core.autocrlf=true`, and this project has
     no .gitattributes) every merged page is CRLF on disk, so that assertion was
     RED for all ten pages that reach it — failing identically whether the code
     was right or wrong, which is no signal at all, and a suite that is always
     red is a suite people stop reading. Every read now goes through `codeOf`,
     which normalises the line endings first.

   · it asked whether a guard's NAME appears anywhere in the file, with a plain
     substring test. A page that merely mentioned `requireCompanySection` in a
     comment — and called nothing — passed every assertion. `codeOf` strips the
     comments, and the check now matches the CALL (`await requireCompanySection(`),
     so only a page that actually runs a guard can satisfy it.

   And the loops COLLECT every offending file before failing rather than
   throwing on the first, so one bad page cannot hide the ones behind it.
   ========================================================================== */

const APP = path.join(process.cwd(), "src", "app", "(bsystems)", "b-systems", "(app)");

const COMPANY_GUARDS = [
  "requireCompanyPage",
  "requireCompanySection",
  "requireBsAdminCompanyPage",
];

/** The guard CALL, never merely its name — see the audit note above. */
const GUARD_CALL = new RegExp(String.raw`await\s+(?:${COMPANY_GUARDS.join("|")})\s*\(`);

/* page.tsx AND route.ts. A route handler dropped into this route group would be
   a live endpoint underneath the merged shell that the old sweep could not see;
   there are none today, and this is what keeps that true. */
const SERVER_ENTRIES = ["page.tsx", "route.ts"];

function pagesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pagesUnder(full));
    else if (SERVER_ENTRIES.includes(entry)) out.push(full);
  }
  return out;
}

/** One file's CODE: line endings normalised, so a checkout's CRLF cannot change
    what this file asserts; comments stripped, so naming a guard in prose cannot
    satisfy a check that the guard is CALLED. (`//` is only treated as a comment
    when it is not preceded by a colon, so a `https://` in a link survives.) */
function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const rel = (file: string) => path.relative(process.cwd(), file);

describe("every merged CRM page states which company it is for", () => {
  const pages = pagesUnder(APP);

  it("finds the whole route directory (a silent zero would prove nothing)", () => {
    /* the sweep is worthless if the glob breaks and quietly matches nothing */
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it.each(pagesUnder(APP).map((p) => [path.relative(APP, p), p] as const))(
    "%s calls a company-aware guard",
    (_rel, file) => {
      expect(
        GUARD_CALL.test(codeOf(file)),
        `${rel(file)} must AWAIT one of ${COMPANY_GUARDS.join(" / ")} — ` +
          "without it the page renders whichever company the URL asks for, and a " +
          "ByteForce-only account can reach a B-Systems screen (ADR-067)",
      ).toBe(true);
    },
  );

  it.each(pagesUnder(APP).map((p) => [path.relative(APP, p), p] as const))(
    "%s does not reach for a guard that cannot see the company",
    (_rel, file) => {
      const src = codeOf(file);
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
    const offenders: string[] = [];
    for (const file of pagesUnder(APP)) {
      const src = codeOf(file);
      if (!/\brequireCompanyPage\b/.test(src)) continue;
      if (!/\bnarrowRoles\s*\(/.test(src)) offenders.push(rel(file));
    }
    expect(
      offenders,
      "these pages resolve the company but never narrow the roles — add " +
        "narrowRoles(...) for the B-Systems branch (ADR-067)",
    ).toEqual([]);
  });

  it("no merged page calls the THROWING bsRoleOf before its company is settled", () => {
    /* bsRoleOf throws for an account with no B-Systems role — a 500 where a
       redirect belongs. It is total (and therefore fine) only AFTER
       requireCompanySection("bsystems") has run, because holding "bsystems" is
       exactly holding one of the five B-Systems roles. Anywhere else, the
       total bsRoleOrNull is the one to use. */
    const offenders: string[] = [];
    for (const file of pagesUnder(APP)) {
      const src = codeOf(file);
      if (!/\bbsRoleOf\s*\(/.test(src)) continue;
      if (!/requireCompanySection\(\s*"bsystems"/.test(src)) offenders.push(rel(file));
    }
    expect(
      offenders,
      "these pages call bsRoleOf without first pinning the company to bsystems — " +
        "use bsRoleOrNull, or narrow the company first (ADR-067)",
    ).toEqual([]);
  });
});
