import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "@/lib/pipeline-engine/constants";
import type { CurrentUser } from "@/lib/auth/guards";
import { crmEngineRole } from "@/lib/api/bsystems";
import { CRM_COMPANIES, CRM_ROLES, companiesFor, crmRolesFor, resolveCompany } from "./company";
import {
  LEADS_EXPORT_ROLES,
  canExportLeads,
  leadExportStatus,
  leadsExportCompanies,
  leadsExportFilename,
  leadsExportHref,
} from "./leads-export";

/* ============================================================================
   ADR-083 — THE EXPORT WALL.

   This endpoint hands over the entire customer list of a company in one file,
   so the question "who may press the button" is the whole risk of the feature.
   The lead engineer's instruction was to make the export's wall IDENTICAL to
   the Leads page's own — not looser — so the test is written as an EQUIVALENCE
   rather than as a second copy of the table it is supposed to be checking:
   `pageReaches` below is assembled out of the very functions the real page
   calls, in the real order, and the sweep asserts that an account can export a
   company exactly when it can open that company's Leads page.

   A table-versus-table test would pass happily the day somebody widens one of
   them. This one cannot: change `LEADS_EXPORT_ROLES`, or change the page's own
   guards, and the 64-subset sweep goes red naming the role.
   ========================================================================== */

function asUser(roles: Role[]): CurrentUser {
  return {
    id: "u1",
    name: "Test",
    roles,
    portalRepId: null,
    impersonatorId: null,
    canAccessAccounting: true,
    canAccessVault: true,
  };
}

/** Can these roles OPEN the Leads page for this company?

    Transcribed from src/app/(bsystems)/b-systems/(app)/leads/page.tsx, step for
    step, using the same imports it uses:

      1. `requireCompanyPage` → `requirePageRole("/login", ...CRM_ROLES)`
      2. `requireCompanyPage` → `resolveCompany(roles, requested)`; a company
         the account does not hold is REFUSED and redirected away
      3. ByteForce branch → renders `LeadsBody` immediately (reaching it is
         itself proof of `byteforce_staff`, because `companiesFor` narrows)
      4. B-Systems branch → `narrowRoles(..., crmRolesFor("bsystems"))`, then
         `crmEngineRole(...) !== "bsystems_admin"` redirects to the board */
function pageReaches(roles: Role[], company: (typeof CRM_COMPANIES)[number]): boolean {
  if (!roles.some((r) => CRM_ROLES.includes(r))) return false; // 1
  const resolved = resolveCompany(roles, company); // 2
  if (resolved.kind !== "ok" || resolved.company !== company) return false;
  if (company === "byteforce") return true; // 3
  if (!crmRolesFor("bsystems").some((r) => roles.includes(r))) return false; // 4
  return crmEngineRole("bsystems", asUser(roles)) === "bsystems_admin";
}

/** Every subset of the six roles — 64 of them. The same sweep shape
    company.test.ts uses for `resolveCompany`, for the same reason: a
    permission claim about "every role" has to be checked against every role,
    including the combinations nobody would think to seed. */
function allRoleSubsets(): Role[][] {
  const out: Role[][] = [];
  for (let mask = 0; mask < 1 << ROLES.length; mask++) {
    out.push(ROLES.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

describe("the export wall IS the Leads page's wall", () => {
  it("matches it for every role subset and both companies — 64 × 2", () => {
    const subsets = allRoleSubsets();
    expect(subsets).toHaveLength(64);
    for (const roles of subsets) {
      for (const company of CRM_COMPANIES) {
        expect(
          canExportLeads(roles, company),
          `[${roles.join(",") || "no roles"}] → ${company}`,
        ).toBe(pageReaches(roles, company));
      }
    }
  });

  it("names the four B-Systems roles that must NEVER pull a company-wide list", () => {
    /* spelled out as well as swept, because this is the refusal the feature
       exists to get right and a reader should not have to run a bitmask to
       find it. An agent or a partner sees only its own leads everywhere else
       in this product (requireLeadAccess) — one file would undo that. */
    for (const role of [
      "bsystems_sales",
      "bsystems_agent",
      "bsystems_partner",
      "bsystems_data_entry",
    ] as Role[]) {
      expect(canExportLeads([role], "bsystems"), role).toBe(false);
      expect(canExportLeads([role], "byteforce"), role).toBe(false);
      expect(leadsExportCompanies([role])).toEqual([]);
    }
  });

  it("the admin exports B-Systems; ByteForce staff exports ByteForce; neither gets the other", () => {
    expect(canExportLeads(["bsystems_admin"], "bsystems")).toBe(true);
    expect(canExportLeads(["bsystems_admin"], "byteforce")).toBe(false);
    expect(canExportLeads(["byteforce_staff"], "byteforce")).toBe(true);
    expect(canExportLeads(["byteforce_staff"], "bsystems")).toBe(false);
  });

  it("an account holding BOTH exports both", () => {
    const both: Role[] = ["bsystems_admin", "byteforce_staff"];
    expect(canExportLeads(both, "bsystems")).toBe(true);
    expect(canExportLeads(both, "byteforce")).toBe(true);
    /* B-Systems first — CRM_COMPANIES order, the founder's "I just want the b
       systems CRM" */
    expect(leadsExportCompanies(both)).toEqual(["bsystems", "byteforce"]);
  });

  it("holding both COMPANIES is not holding both exports", () => {
    /* the case the button set exists for: this account can switch companies and
       can open ByteForce's Leads page, but B-Systems' Leads page redirects it to
       the board. One button, not two. */
    const sideways: Role[] = ["bsystems_sales", "byteforce_staff"];
    expect(companiesFor(sideways)).toEqual(["bsystems", "byteforce"]);
    expect(leadsExportCompanies(sideways)).toEqual(["byteforce"]);
    expect(canExportLeads(sideways, "bsystems")).toBe(false);
  });

  it("no roles at all exports nothing", () => {
    expect(leadsExportCompanies([])).toEqual([]);
    for (const company of CRM_COMPANIES) expect(canExportLeads([], company)).toBe(false);
  });

  it("never reports a company outside companiesFor(roles) — for every subset", () => {
    /* the narrowing law of lib/crm/company.ts, restated for this predicate: it
       can only ever subtract from the companies an account already holds */
    for (const roles of allRoleSubsets()) {
      const held = companiesFor(roles);
      for (const company of leadsExportCompanies(roles)) {
        expect(held, `[${roles.join(",")}]`).toContain(company);
      }
    }
  });

  it("the role table is exactly the two Leads pages' own role requirements", () => {
    expect(LEADS_EXPORT_ROLES.bsystems).toEqual(["bsystems_admin"]);
    expect(LEADS_EXPORT_ROLES.byteforce).toEqual(["byteforce_staff"]);
    /* and NOT staffRolesForBrand("bsystems"), which includes internal sales —
       the looser list this feature must not have inherited */
    expect(LEADS_EXPORT_ROLES.bsystems).not.toContain("bsystems_sales");
  });
});

describe("the endpoints carry the company in the ROUTE, never in a parameter", () => {
  it("one address per company, and no query string on either", () => {
    expect(leadsExportHref("byteforce")).toBe("/api/byteforce/leads/export");
    expect(leadsExportHref("bsystems")).toBe("/api/b-systems/leads/export");
    for (const company of CRM_COMPANIES) {
      /* ADR-067's wall: a `?company=` here would be the single way to widen
         this across companies, so there is nothing to type */
      expect(leadsExportHref(company)).not.toContain("?");
      expect(leadsExportHref(company)).not.toContain("company=");
    }
  });

  it("the two addresses sit under the two API namespaces, not one shared one", () => {
    expect(leadsExportHref("byteforce").startsWith("/api/byteforce/")).toBe(true);
    expect(leadsExportHref("bsystems").startsWith("/api/b-systems/")).toBe(true);
  });
});

describe("the STATUS column — his four words, and the overlap decided", () => {
  it("live, won, lost", () => {
    expect(leadExportStatus({ stage: "new", archived: false })).toBe("live");
    expect(leadExportStatus({ stage: "following_up", archived: false })).toBe("live");
    expect(leadExportStatus({ stage: "negotiation", archived: false })).toBe("live");
    expect(leadExportStatus({ stage: "postponed", archived: false })).toBe("live");
    expect(leadExportStatus({ stage: "won", archived: false })).toBe("won");
    expect(leadExportStatus({ stage: "lost", archived: false })).toBe("lost");
  });

  it("ARCHIVED WINS over the stage — including over won and lost", () => {
    /* the data really does overlap (archived is a flag, won/lost are stages),
       and "archived" is the answer to "where did this lead go": it is on no
       screen in the product. The Stage column beside it still reads Won, so
       nothing is lost — filtering the sheet by Stage still counts every win. */
    expect(leadExportStatus({ stage: "won", archived: true })).toBe("archived");
    expect(leadExportStatus({ stage: "lost", archived: true })).toBe("archived");
    expect(leadExportStatus({ stage: "following_up", archived: true })).toBe("archived");
  });
});

describe("the filename says which company and which day", () => {
  it("so the two downloads cannot collide in one Downloads folder", () => {
    expect(leadsExportFilename("byteforce", "2026-10-06")).toBe("byteforce-leads-2026-10-06.xlsx");
    expect(leadsExportFilename("bsystems", "2026-10-06")).toBe("b-systems-leads-2026-10-06.xlsx");
    expect(leadsExportFilename("byteforce", "2026-10-06")).not.toBe(
      leadsExportFilename("bsystems", "2026-10-06"),
    );
  });

  it("is a real .xlsx name, with the product's own spelling of the company", () => {
    for (const company of CRM_COMPANIES) {
      const name = leadsExportFilename(company, "2026-01-02");
      expect(name.endsWith(".xlsx")).toBe(true);
      expect(name).toContain("2026-01-02");
      /* no spaces, no colons — it has to survive a Windows Downloads folder */
      expect(name).toMatch(/^[a-z0-9-]+\.xlsx$/);
    }
  });
});
