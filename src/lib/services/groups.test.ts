import { describe, expect, it } from "vitest";
import { utcToCairo } from "@/lib/datetime";
import { followUpDueAt } from "./groups";

/* followUpDueAt is the ONE place the ADR-061 default slot and the DST guard
   live. Fixed dates, Cairo assertions — the pins hold on a machine in any
   timezone. */

describe("followUpDueAt (ADR-061)", () => {
  it("absent time defaults to the 09:00 Cairo slot", () => {
    const at = followUpDueAt({ date: "2026-08-20", method: "call" });
    expect(utcToCairo(at)).toEqual({ date: "2026-08-20", time: "09:00" });
  });

  it("an explicit API-posted time is kept as posted", () => {
    const at = followUpDueAt({ date: "2026-08-20", time: "16:45", method: "call" });
    expect(utcToCairo(at)).toEqual({ date: "2026-08-20", time: "16:45" });
  });

  it("a 00:xx time on Egypt's spring-forward day cannot land on the eve (review)", () => {
    /* 2026-04-24 00:30 Cairo does not exist (00:00 jumps to 01:00) — the raw
       solver resolves it to 2026-04-23 23:30, the EVE. The guard re-anchors
       one hour forward so the follow-up stays on its POSTED date. */
    const at = followUpDueAt({ date: "2026-04-24", time: "00:30", method: "call" });
    expect(utcToCairo(at)).toEqual({ date: "2026-04-24", time: "01:30" });
  });
});
