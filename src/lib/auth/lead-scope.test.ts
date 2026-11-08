import { describe, expect, it } from "vitest";
import { BRANDS, ROLES, type Role } from "@/lib/pipeline-engine/constants";
import {
  COMPANY_ADMIN_ROLES,
  companyAdminUserWhere,
  isCompanyAdmin,
  leadScopeFor,
  scopeOwnerWhere,
  scopeReaches,
} from "./lead-scope";

/* ============================================================================
   Assigned leads only (founder, 2026-11-08) — the one predicate family.

   The company-admin rule is ONE table (COMPANY_ADMIN_ROLES) read two ways: in
   memory (`isCompanyAdmin`, every guard and page) and as a filter over user
   rows (`companyAdminUserWhere`, the chat's mentionable set). These tests sweep
   every role subset and prove the two readings agree, so the database filter
   can never name an admin the guards would refuse — or miss one they admit.
   ========================================================================== */

function allRoleSubsets(): Role[][] {
  const out: Role[][] = [];
  for (let mask = 0; mask < 1 << ROLES.length; mask++) out.push(ROLES.filter((_, i) => mask & (1 << i)));
  return out;
}

/** Evaluate the structural filter against an account holding `roles`. */
function filterAdmits(where: ReturnType<typeof companyAdminUserWhere>, roles: Role[]): boolean {
  return where.AND.every((clause) => roles.includes(clause.roles.some.role as Role));
}

describe("who administers a company's leads", () => {
  it("B-Systems: bsystems_admin. ByteForce: byteforce_staff AND bsystems_admin (the platform admin)", () => {
    expect(COMPANY_ADMIN_ROLES).toEqual({
      bsystems: ["bsystems_admin"],
      byteforce: ["byteforce_staff", "bsystems_admin"],
    });
    expect(isCompanyAdmin({ roles: ["bsystems_admin"] }, "bsystems")).toBe(true);
    expect(isCompanyAdmin({ roles: ["bsystems_admin"] }, "byteforce")).toBe(false);
    expect(isCompanyAdmin({ roles: ["byteforce_staff"] }, "byteforce")).toBe(false);
    expect(isCompanyAdmin({ roles: ["byteforce_staff", "bsystems_admin"] }, "byteforce")).toBe(true);
    for (const role of ["bsystems_sales", "bsystems_agent", "bsystems_partner", "bsystems_data_entry"] as Role[]) {
      expect(isCompanyAdmin({ roles: [role] }, "bsystems"), role).toBe(false);
    }
  });

  it("the in-memory predicate and the database filter agree for every role subset, both companies", () => {
    const subsets = allRoleSubsets();
    expect(subsets.length).toBe(1 << ROLES.length);
    for (const company of BRANDS) {
      const where = companyAdminUserWhere(company);
      for (const roles of subsets) {
        expect(filterAdmits(where, roles), `[${roles.join(",")}] → ${company}`).toBe(
          isCompanyAdmin({ roles }, company),
        );
      }
    }
  });
});

describe("the scope a viewer reads a company's leads under", () => {
  it("the admin: all; everybody else: own — and the two readers of a scope agree", () => {
    expect(leadScopeFor({ id: "a", roles: ["bsystems_admin"] }, "bsystems")).toEqual({ kind: "all" });
    expect(leadScopeFor({ id: "s", roles: ["bsystems_sales"] }, "bsystems")).toEqual({
      kind: "own",
      userId: "s",
    });
    expect(leadScopeFor({ id: "f", roles: ["byteforce_staff"] }, "byteforce")).toEqual({
      kind: "own",
      userId: "f",
    });
    expect(scopeOwnerWhere({ kind: "all" })).toEqual({});
    expect(scopeOwnerWhere({ kind: "own", userId: "s" })).toEqual({ ownerUserId: "s" });
    /* an UNASSIGNED lead reaches the admin only */
    expect(scopeReaches({ kind: "all" }, { ownerUserId: null })).toBe(true);
    expect(scopeReaches({ kind: "own", userId: "s" }, { ownerUserId: null })).toBe(false);
    expect(scopeReaches({ kind: "own", userId: "s" }, { ownerUserId: "s" })).toBe(true);
    expect(scopeReaches({ kind: "own", userId: "s" }, { ownerUserId: "t" })).toBe(false);
  });
});
