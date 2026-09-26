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
   the predicate that decides which companies an account may point them at is
   the whole wall. ADR-080 removed the tenant this file was written for; the
   predicate stays, and so does the property the file hammers — including the
   case that is easy to get right by accident and wrong in a hurry: a company
   list must never contain a company the roles do not carry, and a role this
   build does not know must resolve to nothing rather than to a default.
   ========================================================================== */

const BS_ADMIN: Role[] = ["bsystems_admin"];
/* ADR-080 — cast in, because `Role` no longer contains it: the assertions
   below are what a stale session carrying the retired role must do in a MODULE,
   which is get no books and no vault rows at all. */
const RETIRED: Role[] = ["mindoo_staff" as Role];

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

  it("ADR-080 — a RETIRED role gets NO company, not a default one", () => {
    expect(moduleCompaniesFor(RETIRED)).toEqual([]);
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
    const all: Role[] = [...BS_CRM_ROLES, "byteforce_staff", ...RETIRED];
    for (let mask = 0; mask < 1 << all.length; mask++) {
      const roles = all.filter((_, i) => mask & (1 << i));
      for (const c of moduleCompaniesFor(roles)) expect(BRANDS).toContain(c);
    }
  });

  it("order is load-bearing — the module opens on the first entry", () => {
    expect(moduleCompaniesFor(BS_ADMIN)[0]).toBe("byteforce");
  });

  it("ADR-080 — a retired role alongside the live one adds no company", () => {
    expect(moduleCompaniesFor([...BS_ADMIN, ...RETIRED])).toEqual(["byteforce", "bsystems"]);
  });
});

describe("canUseModule — the role is the floor", () => {
  it("admits the administrator", () => {
    expect(canUseModule(bearer(BS_ADMIN), "accounting")).toBe(true);
    expect(canUseModule(bearer(BS_ADMIN), "vault")).toBe(true);
  });

  it("ADR-080 — and REFUSES the retired role outright", () => {
    expect(canUseModule(bearer(RETIRED), "accounting")).toBe(false);
    expect(canUseModule(bearer(RETIRED), "vault")).toBe(false);
  });

  it("still refuses every non-administrator, flags or no flags", () => {
    for (const role of ["bsystems_sales", "bsystems_agent", "bsystems_partner", "bsystems_data_entry", "byteforce_staff"] as Role[]) {
      expect(canUseModule(bearer([role]), "accounting")).toBe(false);
      expect(canUseModule(bearer([role]), "vault")).toBe(false);
    }
  });

  it("ADR-066 is intact — a per-account flag still takes one module away", () => {
    const blocked = { roles: BS_ADMIN, canAccessAccounting: false, canAccessVault: true };
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
    /* ADR-080 — including a RETIRED company's literal off an old bookmark */
    expect(resolveModuleCompany(moduleCompaniesFor(BS_ADMIN), "mindoo")).toBe("byteforce");
    expect(resolveModuleCompany(["bsystems"], "byteforce")).toBe("bsystems");
  });

  it("treats junk, absence and repetition alike", () => {
    for (const raw of [undefined, null, "", "junk", ["bsystems", "mindoo"]]) {
      expect(resolveModuleCompany(["bsystems"], raw)).toBe("bsystems");
    }
  });

  it("gives an account with no company null", () => {
    expect(resolveModuleCompany([], "bsystems")).toBeNull();
  });
});

describe("acctView — the accounting module opens on a company you hold", () => {
  it("an account never lands on a company's books it does not hold", () => {
    const view = acctView({ company: "byteforce" }, ["bsystems"]);
    expect(view.company).toBe("bsystems");
    expect(view.companies).toEqual(["bsystems"]);
  });

  it("ADR-080 — a RETIRED role has no books to open at all", () => {
    const view = acctView({ company: "mindoo" }, moduleCompaniesFor(RETIRED));
    expect(view.companies).toEqual([]);
  });

  it("a B-Systems admin's default and tabs are byte-for-byte what they were", () => {
    const view = acctView({}, moduleCompaniesFor(BS_ADMIN));
    expect(view.company).toBe("byteforce");
    expect(view.companies).toEqual(["byteforce", "bsystems"]);
  });
});

describe("the vault's company clause", () => {
  const BS_VISIBLE = ["byteforce", "bsystems"] as const;
  /* ADR-080 — an account holding ONE company and not the module's default. It
     was Mindoo's list; the property it proves is about the DEFAULT, not about
     which company, so B-Systems-only carries it with a company that exists. */
  const ONE_VISIBLE = ["bsystems"] as const;

  it("an untagged row belongs to the accounts that own the default company", () => {
    expect(seesUntagged(BS_VISIBLE)).toBe(true);
    expect(seesUntagged(ONE_VISIBLE)).toBe(false);
  });

  it("with no filter, a list is every company this account holds", () => {
    expect(vaultCompanyWhere(BS_VISIBLE, undefined)).toEqual({
      AND: [{ company: { in: ["byteforce", "bsystems"] } }],
    });
    expect(vaultCompanyWhere(ONE_VISIBLE, undefined)).toEqual({
      AND: [{ company: { in: ["bsystems"] } }],
    });
  });

  it("a filter naming a company the account holds narrows to it", () => {
    expect(vaultCompanyWhere(BS_VISIBLE, "bsystems")).toEqual({
      AND: [{ company: { in: ["bsystems"] } }],
    });
  });

  it("a filter naming a company it does NOT hold is ignored, never obeyed", () => {
    /* the important one: a `?company=` naming a company this session does not
       hold must not return that company's rows, and must not return nothing
       either — it is a filter that does not apply */
    expect(vaultCompanyWhereNullable(ONE_VISIBLE, "byteforce")).toEqual({
      AND: [{ OR: [{ company: { in: ["bsystems"] } }] }],
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
    /* and an account without the default company never sees them at all */
    expect(vaultCompanyWhereNullable(ONE_VISIBLE, undefined)).toEqual({
      AND: [{ OR: [{ company: { in: ["bsystems"] } }] }],
    });
  });

  it("rides AND, never OR — the search box already owns OR", () => {
    /* spreading a second `OR` into the same where object silently REPLACES the
       first, dropping either the search or the wall depending on key order */
    expect(Object.keys(vaultCompanyWhere(BS_VISIBLE, undefined))).toEqual(["AND"]);
    expect(Object.keys(vaultCompanyWhereNullable(BS_VISIBLE, undefined))).toEqual(["AND"]);
  });
});
