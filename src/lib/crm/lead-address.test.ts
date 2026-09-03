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
   them was `brand === "bsystems" ? … : …`. With two brands that is total. With
   three it silently sent MINDOO to a B-Systems address, which `proxy.ts` now
   refuses for `mindoo_staff`: a Mindoo meeting, a Mindoo To-Do row and a Mindoo
   mention push each logged the reader out on a click.

   They were found by review, not by the suite, because nothing here asserted
   the SHAPE of an address. It does now, over `BRANDS` rather than over a list
   written out by hand, so a fourth company fails these cases the day it is
   added rather than the day somebody clicks.
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

  it("MINDOO never points into the B-Systems shell", () => {
    /* the founder's "nothing inside bsystems goes to mindoo and vice versa",
       as the one assertion that would have caught all three services */
    expect(leadHref("mindoo", "x")).toBe("/mindoo/crm/lead/x");
    expect(leadHref("mindoo", "x")).not.toContain("/b-systems");
    expect(leadHref("mindoo", "x")).not.toContain("company=");
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

  it("a MINDOO mention whose lead is unreadable lands on Mindoo, not B-Systems", () => {
    /* comments.ts nulls the leadId per brand precisely so a dual-role reader's
       other bell cannot deep-link into the wrong app; before ADR-074 this fell
       past two `if`s and opened /b-systems, which the proxy refuses */
    expect(deepLinkFor({ type: "mention", leadId: null }, "mindoo")).toBe("/mindoo");
  });
});

describe("moduleBrand — the chrome answers the same question the server did", () => {
  const BS = moduleCompaniesFor(["bsystems_admin"]);
  const MD = moduleCompaniesFor(["mindoo_staff"]);

  it("obeys ?company= only when the account holds it", () => {
    expect(moduleBrand("accounting", "bsystems", "byteforce", BS)).toBe("bsystems");
    expect(moduleBrand("vault", "mindoo", "mindoo", MD)).toBe("mindoo");
  });

  it("IGNORES a company the account does not hold — never labels one company's rows with another's", () => {
    /* the server falls back to the account's own default for an unheld
       company, so obeying the URL here put Mindoo's mark and palette over
       ByteForce's books (and, reversed, ByteForce's over Mindoo's) */
    expect(moduleBrand("accounting", "mindoo", "byteforce", BS)).toBe("byteforce");
    expect(moduleBrand("accounting", "byteforce", "mindoo", MD)).toBe("mindoo");
    expect(moduleBrand("vault", "bsystems", "mindoo", MD)).toBe("mindoo");
  });

  it("falls back to the SERVER's answer when the URL says nothing", () => {
    expect(moduleBrand("accounting", null, "mindoo", MD)).toBe("mindoo");
    expect(moduleBrand("vault", null, "neutral", BS)).toBe("neutral");
  });

  it("never returns a brand outside the account's companies (except the vault's neutral)", () => {
    for (const asked of [...BRANDS, "junk", null]) {
      const got = moduleBrand("accounting", asked, MD[0]!, MD);
      expect(MD).toContain(got);
    }
  });
});
