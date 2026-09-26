import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SHARED_PATHS, targetFor } from "./switch-target";
import { crmNavFor } from "./nav";
import { BS_CRM_ROLES, CRM_COMPANIES } from "./company";

/* ADR-081 — the first test this list has ever had. It shipped in a client
   component, so nothing in this suite could import it, and the Calendar was
   missing from it for a month without a single failure anywhere. */

describe("the company switch keeps you where you are, when it can", () => {
  it("a SHARED path survives the switch, carrying the new company", () => {
    for (const p of SHARED_PATHS) {
      for (const company of CRM_COMPANIES) {
        expect(targetFor(p, company)).toBe(`${p}?company=${company}`);
      }
    }
  });

  it("the DAILY REPORT survives it — the one screen whose content is the same either way", () => {
    expect(targetFor("/b-systems/daily-report", "byteforce")).toBe(
      "/b-systems/daily-report?company=byteforce",
    );
    expect(targetFor("/b-systems/daily-report", "bsystems")).toBe(
      "/b-systems/daily-report?company=bsystems",
    );
  });

  it("a company-EXCLUSIVE section or a deep link falls back to that company's Home", () => {
    for (const p of [
      "/b-systems/users",
      "/b-systems/statements",
      "/b-systems/clients",
      "/b-systems/crm/lead/abc123",
      "/b-systems/leads/lead/abc123",
      "/b-systems/entry",
    ]) {
      expect(targetFor(p, "byteforce")).toBe("/b-systems?company=byteforce");
    }
  });

  it("every SHARED path is a real page that BOTH companies' navs can reach", () => {
    /* the property that keeps this list honest: a path here that only one
       company has would send the other company to a screen its guard refuses */
    const app = path.join(process.cwd(), "src", "app", "(bsystems)", "b-systems", "(app)");
    for (const p of SHARED_PATHS) {
      const rest = p.replace(/^\/b-systems\/?/, "");
      const file = path.join(app, ...(rest ? rest.split("/") : []), "page.tsx");
      const src = readFileSync(file, "utf8");
      /* a shared address resolves the company itself rather than pinning it */
      expect(src, `${p} must be a shared page`).not.toMatch(/requireCompanySection\(/);
    }
  });

  it("every path in BOTH navs at once is listed here (the omission that lost the Calendar)", () => {
    const byteforce = new Set(crmNavFor("byteforce", null).map((i) => i.href));
    const bsystems = new Set(
      BS_CRM_ROLES.flatMap((role) => crmNavFor("bsystems", role)).map((i) => i.href),
    );
    const inBoth = [...byteforce].filter((href) => bsystems.has(href)).sort();
    expect(inBoth.length).toBeGreaterThan(3);
    for (const href of inBoth) {
      expect(
        SHARED_PATHS,
        `${href} is in BOTH companies' navs, so switching company from it must keep the path ` +
          "rather than bounce to Home — add it to SHARED_PATHS (ADR-081)",
      ).toContain(href);
    }
  });
});
