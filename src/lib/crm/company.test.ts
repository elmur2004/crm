import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/pipeline-engine/constants";
import {
  BS_CRM_ROLES,
  CRM_COMPANIES,
  canSwitchCompany,
  companiesFor,
  crmQuery,
  defaultCompanyFor,
  companyInParams,
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
/* ADR-073 — and the founder once Mindoo exists: all three companies at once. */
const MINDOO: Role[] = ["mindoo_staff"];
const ALL_THREE: Role[] = ["bsystems_admin", "byteforce_staff", "mindoo_staff"];

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
  it("accepts exactly the three literals", () => {
    expect(parseCompany("bsystems")).toBe("bsystems");
    expect(parseCompany("byteforce")).toBe("byteforce");
    expect(parseCompany("mindoo")).toBe("mindoo"); // ADR-073
  });
  it("rejects everything else, including near misses", () => {
    for (const junk of [
      undefined,
      null,
      "",
      "BYTEFORCE",
      "b-systems",
      "byteforce ",
      "1",
      "all",
      "Mindoo", // ADR-073 — the literal is lowercase; a near miss stays a miss
      "mindo",
    ]) {
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

  it("a dual account may ask for either company it HOLDS, and gets neither refused", () => {
    for (const c of ["bsystems", "byteforce"] as const) {
      expect(resolveCompany(BOTH, c)).toEqual({
        kind: "ok",
        company: c,
        companies: ["bsystems", "byteforce"],
      });
    }
    expect(resolveCompany(BOTH, undefined)).toMatchObject({ company: "bsystems" });
    /* ADR-073 — and the third company is REFUSED to it, which is the whole
       point: holding two of three is not holding all three. Iterating
       CRM_COMPANIES here (as this case used to) quietly asserted the opposite
       the moment a company was added. */
    expect(resolveCompany(BOTH, "mindoo")).toMatchObject({ kind: "refused", company: "bsystems" });
  });

  it("ADR-073 — an account holding ALL THREE may ask for any of them", () => {
    for (const c of CRM_COMPANIES) {
      expect(resolveCompany(ALL_THREE, c)).toEqual({
        kind: "ok",
        company: c,
        companies: ["bsystems", "byteforce", "mindoo"],
      });
    }
    /* default-first order is unchanged by the addition: the founder's own
       "I just want the b systems CRM" still wins */
    expect(resolveCompany(ALL_THREE, undefined)).toMatchObject({ company: "bsystems" });
  });

  it("ADR-073 — a Mindoo-only account holds Mindoo, and is refused the other two", () => {
    expect(companiesFor(MINDOO)).toEqual(["mindoo"]);
    expect(canSwitchCompany(MINDOO)).toBe(false);
    expect(defaultCompanyFor(MINDOO)).toBe("mindoo");
    for (const other of ["bsystems", "byteforce"] as const) {
      expect(resolveCompany(MINDOO, other)).toEqual({
        kind: "refused",
        company: "mindoo",
        companies: ["mindoo"],
      });
    }
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
    /* ADR-073 — mindoo_staff joins the sweep, so this is 128 subsets rather than
       64. The property is the point and it must widen with the role set: a
       proof that ran over the OLD roles only would go on passing while saying
       nothing about the new company. */
    const all: Role[] = [...BS_CRM_ROLES, "byteforce_staff", "mindoo_staff"];
    for (let mask = 0; mask < 1 << all.length; mask++) {
      const roles = all.filter((_, i) => mask & (1 << i));
      const held = companiesFor(roles);
      for (const asked of [undefined, "bsystems", "byteforce", "mindoo", "junk", ""]) {
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
  it("withCompany REPLACES a company already on the href, never doubles it", () => {
    /* ACCESS AUDIT, Run 081 — it used to append unconditionally, so the one
       helper documented as "keeps the current company when navigating" was the
       in-repo way to MANUFACTURE the repeated parameter the two halves of the
       app then read differently. */
    expect(withCompany("/b-systems/leads?company=bsystems", "byteforce")).toBe(
      "/b-systems/leads?company=byteforce",
    );
    expect(withCompany("/b-systems/leads?view=archived&company=bsystems", "byteforce")).toBe(
      "/b-systems/leads?view=archived&company=byteforce",
    );
  });
});

describe("a REPEATED ?company= reads the same on the server and in the chrome", () => {
  /* ACCESS AUDIT, Run 081. Next hands a server page `string[]` for
     `?company=a&company=b`; the client chrome used `params.get`, which is the
     FIRST value. So the page could render one company's rows under the other
     company's nav, label and bell. It never leaked a company the account does
     not hold — the fallback is by construction one it does — but "there is no
     confusion in it" was the founder's whole requirement for the switch.
     One predicate, both halves, asserted side by side. */
  const REPEATS: string[][] = [
    ["byteforce", "byteforce"],
    ["byteforce", "bsystems"],
    ["bsystems", "byteforce"],
    ["junk", "byteforce"],
  ];

  it("treats a repetition as junk on BOTH sides", () => {
    for (const values of REPEATS) {
      const server = parseCompany(values); // what Next gives the page guard
      const client = companyInParams(new URLSearchParams(values.map((v) => ["company", v])));
      expect(server).toBeNull();
      expect(client).toBeNull();
      expect(client).toEqual(server);
    }
  });

  it("and a single value still reads identically on BOTH sides", () => {
    for (const one of ["bsystems", "byteforce", "junk", ""]) {
      const server = parseCompany(one);
      const client = companyInParams(new URLSearchParams([["company", one]]));
      expect(client).toEqual(server);
    }
    /* absent everywhere */
    expect(companyInParams(new URLSearchParams(""))).toBeNull();
    expect(parseCompany(undefined)).toBeNull();
  });

  it("so the SWITCHED page falls back to the account's own default, labelled honestly", () => {
    /* the founder holds both; a doubled ByteForce query is not a ByteForce page */
    expect(resolveCompany(BOTH, ["byteforce", "byteforce"])).toEqual({
      kind: "ok",
      company: "bsystems",
      companies: ["bsystems", "byteforce"],
    });
    /* and the chrome now agrees, instead of printing "Company · ByteForce" */
    expect(companyInParams(new URLSearchParams("company=byteforce&company=byteforce"))).toBeNull();
  });
});
