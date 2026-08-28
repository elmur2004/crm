import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/pipeline-engine/constants";
import {
  BS_CRM_ROLES,
  CRM_COMPANIES,
  canSwitchCompany,
  companiesFor,
  crmQuery,
  defaultCompanyFor,
  parseCompany,
  resolveCompany,
  withCompany,
} from "./company";

/* ============================================================================
   ADR-067 — the company predicate is a PERMISSION, so the tests are the
   deliverable. Every role combination the seed can produce is here, against
   every shape a `?company=` value can arrive in: absent, junk, the company you
   hold, the company you do not.
   ========================================================================== */

const BF: Role[] = ["byteforce_staff"];
const ADMIN: Role[] = ["bsystems_admin"];
const BOTH: Role[] = ["bsystems_admin", "byteforce_staff"]; // the seeded founder

describe("companiesFor — narrowing only", () => {
  it("a ByteForce-only account holds ByteForce and nothing else", () => {
    expect(companiesFor(BF)).toEqual(["byteforce"]);
  });

  it.each(BS_CRM_ROLES)("a %s account holds B-Systems and nothing else", (role) => {
    expect(companiesFor([role])).toEqual(["bsystems"]);
  });

  it("an account holding both holds both, B-Systems FIRST", () => {
    expect(companiesFor(BOTH)).toEqual(["bsystems", "byteforce"]);
    /* the order is the default, and the founder asked for B-Systems */
    expect(companiesFor(["byteforce_staff", "bsystems_admin"])).toEqual(["bsystems", "byteforce"]);
  });

  it("an account with no CRM role holds NOTHING", () => {
    expect(companiesFor([])).toEqual([]);
    expect(companiesFor(["portal_rep" as Role])).toEqual([]);
  });
});

describe("the switch renders only for an account that can actually switch", () => {
  it("is hidden from every single-company account", () => {
    expect(canSwitchCompany(BF)).toBe(false);
    for (const role of BS_CRM_ROLES) expect(canSwitchCompany([role])).toBe(false);
    expect(canSwitchCompany([])).toBe(false);
  });
  it("is shown to an account holding both", () => {
    expect(canSwitchCompany(BOTH)).toBe(true);
  });
});

describe("defaultCompanyFor — a pure function of the ROLES, never of a session", () => {
  it("gives a locked account its one company", () => {
    expect(defaultCompanyFor(BF)).toBe("byteforce");
    expect(defaultCompanyFor(ADMIN)).toBe("bsystems");
    expect(defaultCompanyFor(["bsystems_data_entry"])).toBe("bsystems");
  });
  it("gives a dual account B-Systems — the founder's own words", () => {
    expect(defaultCompanyFor(BOTH)).toBe("bsystems");
  });
  it("gives an account with no CRM role nothing at all", () => {
    expect(defaultCompanyFor([])).toBeNull();
  });
});

describe("parseCompany", () => {
  it("accepts exactly the two literals", () => {
    expect(parseCompany("bsystems")).toBe("bsystems");
    expect(parseCompany("byteforce")).toBe("byteforce");
  });
  it("rejects everything else, including near misses", () => {
    for (const junk of [undefined, null, "", "BYTEFORCE", "b-systems", "byteforce ", "1", "all"]) {
      expect(parseCompany(junk)).toBeNull();
    }
  });
});

describe("resolveCompany — the whole matrix", () => {
  const cases: Array<{ who: string; roles: Role[]; own: "bsystems" | "byteforce" }> = [
    { who: "ByteForce staff", roles: BF, own: "byteforce" },
    { who: "B-Systems admin", roles: ADMIN, own: "bsystems" },
    { who: "B-Systems sales", roles: ["bsystems_sales"], own: "bsystems" },
    { who: "B-Systems agent", roles: ["bsystems_agent"], own: "bsystems" },
    { who: "B-Systems partner", roles: ["bsystems_partner"], own: "bsystems" },
    { who: "B-Systems data entry", roles: ["bsystems_data_entry"], own: "bsystems" },
  ];

  it.each(cases)("$who: no param falls back to their own company", ({ roles, own }) => {
    expect(resolveCompany(roles, undefined)).toEqual({
      kind: "ok",
      company: own,
      companies: [own],
    });
  });

  it.each(cases)("$who: junk falls back rather than 400s", ({ roles, own }) => {
    for (const junk of ["", "nope", "BYTEFORCE", "b-systems"]) {
      expect(resolveCompany(roles, junk)).toEqual({ kind: "ok", company: own, companies: [own] });
    }
  });

  it.each(cases)("$who: asking for their OWN company is honoured", ({ roles, own }) => {
    expect(resolveCompany(roles, own)).toEqual({ kind: "ok", company: own, companies: [own] });
  });

  it.each(cases)("$who: asking for the OTHER company is REFUSED", ({ roles, own }) => {
    const other = own === "bsystems" ? "byteforce" : "bsystems";
    expect(resolveCompany(roles, other)).toEqual({
      kind: "refused",
      company: own,
      companies: [own],
    });
  });

  it("a dual account may ask for either, and gets neither refused", () => {
    for (const c of CRM_COMPANIES) {
      expect(resolveCompany(BOTH, c)).toEqual({
        kind: "ok",
        company: c,
        companies: ["bsystems", "byteforce"],
      });
    }
    expect(resolveCompany(BOTH, undefined).company).toBe("bsystems");
  });

  it("an account with no CRM role resolves to nothing, whatever it asks for", () => {
    for (const asked of [undefined, "bsystems", "byteforce", "junk"]) {
      expect(resolveCompany([], asked)).toEqual({ kind: "none" });
    }
  });

  /* THE property, stated as a test: nothing this function returns can ever be
     a company the roles do not already carry. This is the line that makes
     "nobody gains access they do not have today" mechanical rather than a
     promise — it holds for every role subset, not just the seeded ones. */
  it("NEVER returns a company outside companiesFor(roles) — for every subset", () => {
    const all: Role[] = [...BS_CRM_ROLES, "byteforce_staff"];
    for (let mask = 0; mask < 1 << all.length; mask++) {
      const roles = all.filter((_, i) => mask & (1 << i));
      const held = companiesFor(roles);
      for (const asked of [undefined, "bsystems", "byteforce", "junk", ""]) {
        const r = resolveCompany(roles, asked);
        if (r.kind === "none") {
          expect(held).toEqual([]);
          continue;
        }
        expect(held).toContain(r.company);
        expect(r.companies).toEqual(held);
      }
    }
  });
});

describe("query helpers", () => {
  it("crmQuery starts a query string", () => {
    expect(crmQuery("byteforce")).toBe("?company=byteforce");
  });
  it("withCompany joins onto an href that may already carry one", () => {
    expect(withCompany("/b-systems/crm", "byteforce")).toBe("/b-systems/crm?company=byteforce");
    expect(withCompany("/b-systems/leads/rep/x?view=archived", "byteforce")).toBe(
      "/b-systems/leads/rep/x?view=archived&company=byteforce",
    );
  });
});
