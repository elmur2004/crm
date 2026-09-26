import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { BRANDS } from "@/lib/pipeline-engine/constants";
import { appHomeFor, leadHref } from "./surface";
import { deepLinkFor } from "@/lib/services/push/payload";
import { moduleBrand } from "@/components/shared/ModuleBrandScope";
import { moduleCompaniesFor } from "@/lib/module-companies";

/* ============================================================================
   ADR-074 — THE TERNARY CLASS, closed with a test.

   Three services build a link to a lead from outside any page — the calendar
   projection, the To-Do projection and the push deep-link — and every one of
   them was `brand === "bsystems" ? … : …`. That is total with two brands and a
   trapdoor with three, and when a third arrived each one silently pointed at the
   wrong app: the reader was logged out by clicking their own To-Do row.

   They were found by review, not by the suite, because nothing here asserted
   the SHAPE of an address. It does now, over `BRANDS` rather than over a list
   written out by hand, so a THIRD company fails these cases the day it is added
   rather than the day somebody clicks. That is why this file survives ADR-080
   with the tenant it was written for gone.
   ========================================================================== */

const ROOT = process.cwd();

/** Every ROUTE the app serves — the page-file tree with the route-group
    segments `(…)` removed, which is exactly how Next maps files to URLs. Built
    once so the assertions below read as "is this a real address". */
function routeIndex(dir: string, route = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      /* a (group) contributes no URL segment */
      const next = /^\(.*\)$/.test(entry) ? route : `${route}/${entry}`;
      out.push(...routeIndex(full, next));
    } else if (entry === "page.tsx") {
      out.push(route === "" ? "/" : route);
    }
  }
  return out;
}

const ROUTES = new Set(routeIndex(path.join(ROOT, "src", "app")));

/** Does a route exist for this href? The lead id is replaced by the dynamic
    segment the router would match it with. */
function pageExists(href: string): boolean {
  const route = href.split("?")[0]!.replace(/\/lead-1$/, "/[leadId]");
  return ROUTES.has(route);
}

describe("leadHref — every brand's lead lives at its OWN app", () => {
  it.each(BRANDS)("%s resolves to a page that exists", (brand) => {
    const href = leadHref(brand, "lead-1");
    expect(pageExists(href), `${href} has no page.tsx`).toBe(true);
  });

  it("the merged shell's two keep their company, and their own screens", () => {
    /* B-Systems' leads are on the BOARD's detail, ByteForce's on the rep
       directory's — two screens at one prefix, told apart by the parameter */
    expect(leadHref("bsystems", "x")).toBe("/b-systems/crm/lead/x?company=bsystems");
    expect(leadHref("byteforce", "x")).toBe("/b-systems/leads/lead/x?company=byteforce");
  });

  it.each(BRANDS)("%s's app home is a page that exists", (brand) => {
    expect(pageExists(appHomeFor(brand)), `${appHomeFor(brand)} has no page.tsx`).toBe(true);
  });
});

describe("deepLinkFor — a push never opens an app the reader cannot enter", () => {
  it.each(BRANDS)("a %s lead push goes to that brand's own address", (brand) => {
    expect(deepLinkFor({ type: "assigned", leadId: "L" }, brand)).toBe(leadHref(brand, "L"));
  });

  it.each(BRANDS)("a %s mention whose lead is unreadable lands on that brand's home", (brand) => {
    /* comments.ts nulls the leadId per brand precisely so a dual-role reader's
       other bell cannot deep-link into the wrong app */
    expect(deepLinkFor({ type: "mention", leadId: null }, brand)).toBe(appHomeFor(brand));
  });
});

describe("moduleBrand — the chrome answers the same question the server did", () => {
  const BS = moduleCompaniesFor(["bsystems_admin"]);
  /* ADR-080 — an account holding ONE company. There is no role that produces
     this today, and the function must still be right for it: the property is
     about the LIST it is handed, not about who could hand it one. */
  const ONE: readonly string[] = ["bsystems"];

  it("obeys ?company= only when the account holds it", () => {
    expect(moduleBrand("accounting", "bsystems", "byteforce", BS)).toBe("bsystems");
    expect(moduleBrand("vault", "bsystems", "bsystems", ONE)).toBe("bsystems");
  });

  it("IGNORES a company the account does not hold — never labels one company's rows with another's", () => {
    /* the server falls back to the account's own default for an unheld company,
       so obeying the URL here would put one company's mark and palette over
       another's books. ADR-080 — including a RETIRED company's literal, which
       is the shape an old bookmark arrives in. */
    expect(moduleBrand("accounting", "mindoo", "byteforce", BS)).toBe("byteforce");
    expect(moduleBrand("accounting", "byteforce", "bsystems", ONE)).toBe("bsystems");
    expect(moduleBrand("vault", "byteforce", "bsystems", ONE)).toBe("bsystems");
  });

  it("falls back to the SERVER's answer when the URL says nothing", () => {
    expect(moduleBrand("accounting", null, "bsystems", ONE)).toBe("bsystems");
    expect(moduleBrand("vault", null, "neutral", BS)).toBe("neutral");
  });

  it("never returns a brand outside the account's companies (except the vault's neutral)", () => {
    for (const asked of [...BRANDS, "mindoo", "junk", null]) {
      const got = moduleBrand("accounting", asked, ONE[0]!, ONE);
      expect(ONE).toContain(got);
    }
  });
});
