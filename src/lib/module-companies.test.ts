import { describe, expect, it } from "vitest";
import { BRANDS, type Role } from "@/lib/pipeline-engine/constants";
import { BS_CRM_ROLES } from "@/lib/crm/company";
import { canUseModule } from "@/lib/auth/roles";
import { moduleCompaniesFor, resolveModuleCompany } from "./module-companies";
import { acctView } from "./accounting/params";
import {
  seesUntagged,
  vaultCompanyWhere,
  vaultCompanyWhereNullable,
} from "./services/vault/tenancy";

/* ============================================================================
   ADR-074 — the MODULE tenancy, proved rather than promised.

   Accounting and the Data Vault are ONE screen set with a company filter, and
   the founder asked for two things about them at once: Mindoo must have them,
   and nothing of B-Systems' may reach Mindoo. Both come down to a single
   predicate, so this file hammers it — including the case that is easy to get
   right by accident and wrong in a hurry: adding a company must not add a tab
   to anybody who was already here.
   ========================================================================== */

const BS_ADMIN: Role[] = ["bsystems_admin"];
const MINDOO: Role[] = ["mindoo_staff"];
const BOTH: Role[] = ["bsystems_admin", "mindoo_staff"];

const bearer = (roles: Role[]) => ({
  roles,
  canAccessAccounting: true,
  canAccessVault: true,
});

describe("moduleCompaniesFor — narrowing only", () => {
  it("a B-Systems admin keeps EXACTLY the two companies he has always had", () => {
    /* the regression this whole file exists to prevent: a third company on the
       platform must not appear in his books */
    expect(moduleCompaniesFor(BS_ADMIN)).toEqual(["byteforce", "bsystems"]);
  });

  it("a Mindoo account gets Mindoo and nothing else", () => {
    expect(moduleCompaniesFor(MINDOO)).toEqual(["mindoo"]);
  });

  it("every other role gets NOTHING — the role is the floor", () => {
    for (const role of BS_CRM_ROLES) {
      if (role === "bsystems_admin") continue;
      expect(moduleCompaniesFor([role])).toEqual([]);
    }
    expect(moduleCompaniesFor(["byteforce_staff"])).toEqual([]);
    expect(moduleCompaniesFor([])).toEqual([]);
  });

  it("NEVER returns a company outside the platform's brands — for every subset", () => {
    const all: Role[] = [...BS_CRM_ROLES, "byteforce_staff", "mindoo_staff"];
    for (let mask = 0; mask < 1 << all.length; mask++) {
      const roles = all.filter((_, i) => mask & (1 << i));
      for (const c of moduleCompaniesFor(roles)) expect(BRANDS).toContain(c);
    }
  });

  it("holding BOTH is the union, and B-Systems' default still wins", () => {
    expect(moduleCompaniesFor(BOTH)).toEqual(["byteforce", "bsystems", "mindoo"]);
    /* order is load-bearing: the module opens on the first entry */
    expect(moduleCompaniesFor(BOTH)[0]).toBe("byteforce");
  });
});

describe("canUseModule — Mindoo clears the floor, everybody else is unchanged", () => {
  it("admits both administrators", () => {
    expect(canUseModule(bearer(BS_ADMIN), "accounting")).toBe(true);
    expect(canUseModule(bearer(MINDOO), "vault")).toBe(true);
  });

  it("still refuses every non-administrator, flags or no flags", () => {
    for (const role of ["bsystems_sales", "bsystems_agent", "bsystems_partner", "bsystems_data_entry", "byteforce_staff"] as Role[]) {
      expect(canUseModule(bearer([role]), "accounting")).toBe(false);
      expect(canUseModule(bearer([role]), "vault")).toBe(false);
    }
  });

  it("ADR-066 is intact — a per-account flag still takes one module away", () => {
    const blocked = { roles: MINDOO, canAccessAccounting: false, canAccessVault: true };
    expect(canUseModule(blocked, "accounting")).toBe(false);
    expect(canUseModule(blocked, "vault")).toBe(true);
  });
});

describe("resolveModuleCompany — the URL narrows, it never grants", () => {
  it("gives the asked-for company when the account holds it", () => {
    expect(resolveModuleCompany(moduleCompaniesFor(BS_ADMIN), "bsystems")).toBe("bsystems");
  });

  it("FALLS BACK to the account's own default on a company it does not hold", () => {
    /* never a refusal and never the asked-for company: the module has always
       fallen back on a bad query string, and the fallback is by construction a
       company this account holds */
    expect(resolveModuleCompany(moduleCompaniesFor(BS_ADMIN), "mindoo")).toBe("byteforce");
    expect(resolveModuleCompany(moduleCompaniesFor(MINDOO), "bsystems")).toBe("mindoo");
  });

  it("treats junk, absence and repetition alike", () => {
    for (const raw of [undefined, null, "", "junk", ["bsystems", "mindoo"]]) {
      expect(resolveModuleCompany(moduleCompaniesFor(MINDOO), raw)).toBe("mindoo");
    }
  });

  it("gives an account with no company null", () => {
    expect(resolveModuleCompany([], "bsystems")).toBeNull();
  });
});

describe("acctView — the accounting module opens on a company you hold", () => {
  it("a Mindoo account never lands on another company's books", () => {
    const view = acctView({ company: "byteforce" }, moduleCompaniesFor(MINDOO));
    expect(view.company).toBe("mindoo");
    expect(view.companies).toEqual(["mindoo"]);
  });

  it("a B-Systems admin's default and tabs are byte-for-byte what they were", () => {
    const view = acctView({}, moduleCompaniesFor(BS_ADMIN));
    expect(view.company).toBe("byteforce");
    expect(view.companies).toEqual(["byteforce", "bsystems"]);
  });
});

describe("the vault's company clause", () => {
  const BS_VISIBLE = ["byteforce", "bsystems"] as const;
  const MD_VISIBLE = ["mindoo"] as const;

  it("an untagged row belongs to the accounts that own the default company", () => {
    expect(seesUntagged(BS_VISIBLE)).toBe(true);
    expect(seesUntagged(MD_VISIBLE)).toBe(false);
  });

  it("with no filter, a list is every company this account holds", () => {
    expect(vaultCompanyWhere(BS_VISIBLE, undefined)).toEqual({
      AND: [{ company: { in: ["byteforce", "bsystems"] } }],
    });
    expect(vaultCompanyWhere(MD_VISIBLE, undefined)).toEqual({
      AND: [{ company: { in: ["mindoo"] } }],
    });
  });

  it("a filter naming a company the account holds narrows to it", () => {
    expect(vaultCompanyWhere(BS_VISIBLE, "bsystems")).toEqual({
      AND: [{ company: { in: ["bsystems"] } }],
    });
  });

  it("a filter naming a company it does NOT hold is ignored, never obeyed", () => {
    /* the important one: `?company=bsystems` typed into a Mindoo session must
       not return B-Systems' rows, and must not return nothing either — it is
       a filter that does not apply */
    expect(vaultCompanyWhereNullable(MD_VISIBLE, "bsystems")).toEqual({
      AND: [{ OR: [{ company: { in: ["mindoo"] } }] }],
    });
  });

  it("untagged rows ride along for their owners, and only unfiltered", () => {
    expect(vaultCompanyWhereNullable(BS_VISIBLE, undefined)).toEqual({
      AND: [{ OR: [{ company: { in: ["byteforce", "bsystems"] } }, { company: null }] }],
    });
    /* asking for ONE company must not also hand back the untagged ones */
    expect(vaultCompanyWhereNullable(BS_VISIBLE, "byteforce")).toEqual({
      AND: [{ OR: [{ company: { in: ["byteforce"] } }] }],
    });
    /* and Mindoo never sees them at all */
    expect(vaultCompanyWhereNullable(MD_VISIBLE, undefined)).toEqual({
      AND: [{ OR: [{ company: { in: ["mindoo"] } }] }],
    });
  });

  it("rides AND, never OR — the search box already owns OR", () => {
    /* spreading a second `OR` into the same where object silently REPLACES the
       first, dropping either the search or the wall depending on key order */
    expect(Object.keys(vaultCompanyWhere(BS_VISIBLE, undefined))).toEqual(["AND"]);
    expect(Object.keys(vaultCompanyWhereNullable(BS_VISIBLE, undefined))).toEqual(["AND"]);
  });
});
