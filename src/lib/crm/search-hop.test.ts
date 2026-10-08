import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/pipeline-engine/constants";
import { hopCandidate, hopUrl, SWITCHED_PARAM } from "./search-hop";

/* ============================================================================
   ADR-085 — the pure half of the cross-company search hop. No database, so the
   whole decision is testable: WHETHER to hop, and WHERE TO.
   ========================================================================== */

const BOTH: Role[] = ["bsystems_admin", "byteforce_staff"];
const BS_ONLY: Role[] = ["bsystems_admin"];
const BF_ONLY: Role[] = ["byteforce_staff"];

const candidate = (over: Partial<Parameters<typeof hopCandidate>[0]> = {}) =>
  hopCandidate({ search: "nile", resultCount: 0, roles: BOTH, current: "bsystems", ...over });

describe("When a search hops to the other company (ADR-085)", () => {
  it("hops when the current company found nothing and the account holds another", () => {
    expect(candidate()).toBe("byteforce");
    /* and the other way round, so it is not a one-direction feature */
    expect(candidate({ current: "byteforce", roles: BOTH })).toBe("bsystems");
  });

  it("never hops when nothing was searched", () => {
    expect(candidate({ search: "" })).toBeNull();
    expect(candidate({ search: "   " })).toBeNull(); // whitespace is not a search
  });

  it("never hops when the search WORKED — §2", () => {
    expect(candidate({ resultCount: 1 })).toBeNull();
    expect(candidate({ resultCount: 250 })).toBeNull();
  });

  /* §4 — the founder's own answer on the merge: a ByteForce-only user is locked
     to ByteForce. There is nowhere to hop, so nothing is probed. */
  it("never hops an account locked to one company", () => {
    expect(candidate({ roles: BS_ONLY })).toBeNull();
    expect(candidate({ roles: BF_ONLY, current: "byteforce" })).toBeNull();
    expect(candidate({ roles: [] })).toBeNull();
    /* data entry holds B-Systems and nothing else (ADR-051) */
    expect(candidate({ roles: ["bsystems_data_entry"] })).toBeNull();
  });

  /* §3 — THE LOOP GUARD, and it is the most important case in this file. Two
     companies that both find nothing would redirect to each other for ever. */
  it("hops AT MOST ONCE, whatever the second company finds", () => {
    expect(candidate({ switched: "bsystems" })).toBeNull();
    expect(candidate({ switched: "byteforce" })).toBeNull();
    /* the Back link lands with `switched` naming the company it landed ON, and
       that must still hold the guard — otherwise Back bounces straight back */
    expect(candidate({ switched: "bsystems", current: "bsystems" })).toBeNull();
  });

  it("treats a junk or repeated marker as no marker, exactly as ?company= is treated", () => {
    /* BUG-019's shape: a repeated parameter is junk to every reader in this app.
       Junk cannot silently disable the hop — it reads as absent, so the hop
       runs and its own fresh marker is what guards the next load. */
    expect(candidate({ switched: ["bsystems", "byteforce"] })).toBe("byteforce");
    expect(candidate({ switched: "mindoo" })).toBe("byteforce"); // a dead company
    expect(candidate({ switched: "" })).toBe("byteforce");
    expect(candidate({ switched: null })).toBe("byteforce");
    expect(candidate({ switched: undefined })).toBe("byteforce");
  });
});

describe("The hop's URL (ADR-085)", () => {
  const url = (params: Record<string, string | string[] | undefined>) =>
    new URL(
      hopUrl({ path: "/b-systems/crm", params, to: "byteforce", from: "bsystems" }),
      "https://x.example",
    );

  it("keeps the search and the type, and records where it came from", () => {
    const u = url({ q: "nile", type: "cold_call" });
    expect(u.pathname).toBe("/b-systems/crm");
    expect(u.searchParams.get("q")).toBe("nile");
    expect(u.searchParams.get("type")).toBe("cold_call");
    expect(u.searchParams.get("company")).toBe("byteforce");
    expect(u.searchParams.get(SWITCHED_PARAM)).toBe("bsystems");
  });

  /* ADR-067's CompanySwitch rule, inherited: "owner, stage and sort are
     B-Systems-shaped and mean nothing to the ByteForce bodies, so carrying them
     over would leave a board that looks filtered but is not". The hop IS a
     switch, so it drops them. */
  it("drops the filters the other company's board does not have", () => {
    const u = url({ q: "nile", owner: "agent", stage: "negotiation", sort: "priority" });
    expect(u.searchParams.get("owner")).toBeNull();
    expect(u.searchParams.get("stage")).toBeNull();
    expect(u.searchParams.get("sort")).toBeNull();
    expect(u.searchParams.get("q")).toBe("nile"); // but the search survives
  });

  it("cannot emit the repeated-company shape the app discards (BUG-019)", () => {
    const u = url({ q: "nile", company: "bsystems", [SWITCHED_PARAM]: "byteforce" });
    expect(u.searchParams.getAll("company")).toEqual(["byteforce"]);
    expect(u.searchParams.getAll(SWITCHED_PARAM)).toEqual(["bsystems"]);
  });

  it("drops a repeated or empty filter rather than guessing which one he meant", () => {
    const u = url({ q: ["a", "b"], type: "" });
    expect(u.searchParams.get("q")).toBeNull();
    expect(u.searchParams.get("type")).toBeNull();
    expect(u.searchParams.get("company")).toBe("byteforce");
  });

  it("escapes a search that would otherwise break the query string", () => {
    const u = url({ q: "a&b=c d" });
    expect(u.searchParams.get("q")).toBe("a&b=c d");
  });
});
