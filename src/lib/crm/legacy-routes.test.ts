import { describe, expect, it } from "vitest";
import { mergedByteforcePath } from "./legacy-routes";

/* ADR-067 — the promise to every bookmark, every emailed link and, above all,
   every web push ALREADY SITTING ON THE FOUNDER'S PHONE: nothing under
   /byteforce may 404. One case per rule, plus the shapes with no merged twin. */

describe("mergedByteforcePath", () => {
  it("leaves every other address alone", () => {
    for (const p of [
      "/b-systems",
      "/b-systems/crm",
      "/login",
      "/api/byteforce/leads", // the API namespace is NOT redirected — it is the wall
      "/api/byteforce/todo/done",
      "/accounting",
      "/byteforcex", // not a path segment boundary
    ]) {
      expect(mergedByteforcePath(p), p).toBeNull();
    }
  });

  it("maps the five sections", () => {
    expect(mergedByteforcePath("/byteforce")).toBe("/b-systems");
    expect(mergedByteforcePath("/byteforce/")).toBe("/b-systems");
    expect(mergedByteforcePath("/byteforce/todo")).toBe("/b-systems/todo");
    expect(mergedByteforcePath("/byteforce/crm")).toBe("/b-systems/crm");
    expect(mergedByteforcePath("/byteforce/clients")).toBe("/b-systems/clients");
    expect(mergedByteforcePath("/byteforce/leads")).toBe("/b-systems/leads");
  });

  it("carries the id through the three id-bearing routes", () => {
    expect(mergedByteforcePath("/byteforce/leads/rep/rep_123")).toBe("/b-systems/leads/rep/rep_123");
    /* the unassigned bucket is a literal repId, not a special case */
    expect(mergedByteforcePath("/byteforce/leads/rep/unassigned")).toBe(
      "/b-systems/leads/rep/unassigned",
    );
    /* this exact shape is baked into pushes already delivered */
    expect(mergedByteforcePath("/byteforce/leads/lead/clx1")).toBe("/b-systems/leads/lead/clx1");
    expect(mergedByteforcePath("/byteforce/leads/lead/clx1/call")).toBe(
      "/b-systems/leads/lead/clx1/call",
    );
  });

  it("sends sign-in to the ONE consolidated login, with no company", () => {
    expect(mergedByteforcePath("/byteforce/login")).toBe("/login");
    expect(mergedByteforcePath("/byteforce/login/")).toBe("/login");
  });

  it("catches everything else on ByteForce's home rather than a 404", () => {
    for (const p of [
      "/byteforce/nonsense",
      "/byteforce/leads/rep", // no rep id — there is no such merged screen
      "/byteforce/leads/lead", // no lead id
      "/byteforce/crm/lead/x", // never existed; a mistyped B-Systems shape
      "/byteforce/todo/done",
      "/byteforce/leads/lead/x/call/extra",
    ]) {
      expect(mergedByteforcePath(p), p).toBe("/b-systems");
    }
  });
});
