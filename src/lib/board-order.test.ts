import { describe, expect, it } from "vitest";
import { meetingSortKey, orderMeetingColumn } from "./board-order";

/* ADR-064 — the Meeting Setting column is a diary: soonest meeting first,
   always, whatever `updatedAt` says. Fixed instants, so the assertions hold on
   any machine in any zone. */

/** a card as the boards build it — only the two fields the ordering reads */
const card = (id: string, stage: string, meetingAt: string | null) => ({
  id,
  stage,
  meetingAt,
});

describe("orderMeetingColumn (ADR-064)", () => {
  it("puts three meetings in the order they will take place, soonest first", () => {
    /* incoming order is `updatedAt desc` — deliberately NOT the meeting order */
    const cards = [
      card("late", "meeting_setting", "2026-09-03T13:00:00Z"),
      card("soon", "meeting_setting", "2026-09-01T07:00:00Z"),
      card("mid", "meeting_setting", "2026-09-02T09:00:00Z"),
    ];
    expect(orderMeetingColumn(cards, "meeting_setting").map((c) => c.id)).toEqual([
      "soon",
      "mid",
      "late",
    ]);
  });

  it("orders by the INSTANT, not the day: two meetings on one date keep their clocks", () => {
    const cards = [
      card("evening", "meeting_setting", "2026-09-01T16:00:00Z"),
      card("morning", "meeting_setting", "2026-09-01T06:00:00Z"),
    ];
    expect(orderMeetingColumn(cards, "meeting_setting").map((c) => c.id)).toEqual([
      "morning",
      "evening",
    ]);
  });

  it("sorts a card with NO meeting datetime last — it never vanishes", () => {
    const cards = [
      card("none", "meeting_setting", null),
      card("late", "meeting_setting", "2026-09-03T13:00:00Z"),
      card("soon", "meeting_setting", "2026-09-01T07:00:00Z"),
    ];
    const out = orderMeetingColumn(cards, "meeting_setting");
    expect(out.map((c) => c.id)).toEqual(["soon", "late", "none"]);
    expect(out).toHaveLength(cards.length);
  });

  it("keeps SEVERAL datetime-less cards in their incoming order, at the back", () => {
    const cards = [
      card("noneA", "meeting_setting", null),
      card("soon", "meeting_setting", "2026-09-01T07:00:00Z"),
      card("noneB", "meeting_setting", null),
    ];
    expect(orderMeetingColumn(cards, "meeting_setting").map((c) => c.id)).toEqual([
      "soon",
      "noneA",
      "noneB",
    ]);
  });

  it("leaves every OTHER column exactly as it was, in its own slots", () => {
    const cards = [
      card("f1", "following_up", null),
      card("m-late", "meeting_setting", "2026-09-03T13:00:00Z"),
      card("p1", "sending_proposal", null),
      card("m-soon", "meeting_setting", "2026-09-01T07:00:00Z"),
      card("f2", "following_up", null),
    ];
    /* the meeting cards swap with each other and ONLY with each other: the two
       slots they occupied (1 and 3) still hold meeting cards, and the three
       untouched cards are still at 0, 2 and 4 */
    expect(orderMeetingColumn(cards, "meeting_setting").map((c) => c.id)).toEqual([
      "f1",
      "m-soon",
      "p1",
      "m-late",
      "f2",
    ]);
  });

  it("is a pure function: the input array is not mutated", () => {
    const cards = [
      card("late", "meeting_setting", "2026-09-03T13:00:00Z"),
      card("soon", "meeting_setting", "2026-09-01T07:00:00Z"),
    ];
    const out = orderMeetingColumn(cards, "meeting_setting");
    expect(cards.map((c) => c.id)).toEqual(["late", "soon"]);
    expect(out).not.toBe(cards);
  });

  it("no-ops on an empty or single-card column", () => {
    expect(orderMeetingColumn([], "meeting_setting")).toEqual([]);
    const one = [card("only", "meeting_setting", null)];
    expect(orderMeetingColumn(one, "meeting_setting")).toEqual(one);
  });

  it("takes the stage key it is given — the prospect board shares it (ADR-059)", () => {
    const cards = [
      card("late", "meeting_setting", "2026-09-03T13:00:00Z"),
      card("soon", "meeting_setting", "2026-09-01T07:00:00Z"),
    ];
    /* a different stage name means nothing to order here */
    expect(orderMeetingColumn(cards, "waiting").map((c) => c.id)).toEqual(["late", "soon"]);
  });

  it("treats an unparseable instant as 'no datetime' instead of poisoning the sort", () => {
    expect(meetingSortKey("not-a-date")).toBe(Number.POSITIVE_INFINITY);
    expect(meetingSortKey(null)).toBe(Number.POSITIVE_INFINITY);
    expect(meetingSortKey("2026-09-01T07:00:00Z")).toBe(Date.parse("2026-09-01T07:00:00Z"));
    const cards = [
      card("bad", "meeting_setting", "not-a-date"),
      card("good", "meeting_setting", "2026-09-01T07:00:00Z"),
    ];
    expect(orderMeetingColumn(cards, "meeting_setting").map((c) => c.id)).toEqual(["good", "bad"]);
  });
});
