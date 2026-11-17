import { describe, expect, it } from "vitest";
import {
  arrivedByHop,
  BOARD_PERSON_COOKIE,
  boardPersonValue,
  boardPersonWhere,
  parseBoardPerson,
  resolveBoardPerson,
  type BoardPerson,
} from "./board-person";

/* ADR-109 — founder (2026-11-17): "a button on top of the CRMs, both CRMs …
   just visible for the admin … either mine or either this person or this
   person". The rules the boards apply, without a database. */

describe("the wire value", () => {
  it("round-trips every choice", () => {
    const choices: BoardPerson[] = [
      { kind: "all" },
      { kind: "mine" },
      { kind: "unassigned" },
      { kind: "user", userId: "cm1abc_DEF-2" },
    ];
    for (const c of choices) expect(parseBoardPerson(boardPersonValue(c))).toEqual(c);
  });

  it("reads anything unknown, empty or malformed as Everyone", () => {
    for (const raw of [undefined, null, "", "any", "ALL", "user:", "user:a b", `user:${"x".repeat(65)}`, "user:../x", "mine "]) {
      expect(parseBoardPerson(raw)).toEqual({ kind: "all" });
    }
  });

  it("keeps a separate cookie for each company", () => {
    expect(BOARD_PERSON_COOKIE.bsystems).not.toBe(BOARD_PERSON_COOKIE.byteforce);
  });
});

describe("the narrowing", () => {
  it("adds nothing for Everyone and an owner for the rest", () => {
    expect(boardPersonWhere({ kind: "all" }, "me")).toEqual({});
    expect(boardPersonWhere({ kind: "mine" }, "me")).toEqual({ ownerUserId: "me" });
    expect(boardPersonWhere({ kind: "unassigned" }, "me")).toEqual({ ownerUserId: null });
    expect(boardPersonWhere({ kind: "user", userId: "u1" }, "me")).toEqual({ ownerUserId: "u1" });
  });
});

describe("the choice the board applies", () => {
  const base = {
    isAdmin: true,
    viewerId: "me",
    offered: new Set(["u1", "u2"]),
    arrivedByHop: false,
  };

  it("applies the admin's stored choice", () => {
    for (const stored of [
      { kind: "all" },
      { kind: "mine" },
      { kind: "unassigned" },
      { kind: "user", userId: "u2" },
    ] as BoardPerson[]) {
      expect(resolveBoardPerson({ ...base, stored })).toEqual(stored);
    }
  });

  it("is ignored whole for anybody who is not the company admin", () => {
    for (const stored of [
      { kind: "mine" },
      { kind: "unassigned" },
      { kind: "user", userId: "u1" },
    ] as BoardPerson[]) {
      expect(resolveBoardPerson({ ...base, isAdmin: false, stored })).toEqual({ kind: "all" });
    }
  });

  it("shows everyone on a search hop's arrival", () => {
    expect(
      resolveBoardPerson({ ...base, arrivedByHop: true, stored: { kind: "user", userId: "u1" } }),
    ).toEqual({ kind: "all" });
    expect(resolveBoardPerson({ ...base, arrivedByHop: true, stored: { kind: "mine" } })).toEqual({
      kind: "all",
    });
  });

  it("falls back to Everyone for a person who is not on offer", () => {
    expect(resolveBoardPerson({ ...base, stored: { kind: "user", userId: "gone" } })).toEqual({
      kind: "all",
    });
  });

  it("reads the admin himself, chosen by id, as Mine", () => {
    expect(resolveBoardPerson({ ...base, stored: { kind: "user", userId: "me" } })).toEqual({
      kind: "mine",
    });
  });
});

describe("a search hop's arrival (ADR-085)", () => {
  it("is an arrival only when the marker names the OTHER company", () => {
    expect(arrivedByHop("bsystems", "byteforce")).toBe(true);
    expect(arrivedByHop("byteforce", "bsystems")).toBe(true);
    /* the notice's way back marks the board it returns to */
    expect(arrivedByHop("bsystems", "bsystems")).toBe(false);
    expect(arrivedByHop("byteforce", "byteforce")).toBe(false);
    for (const junk of [undefined, null, "", "mindoo", "BSYSTEMS"]) {
      expect(arrivedByHop(junk, "bsystems")).toBe(false);
    }
  });
});
