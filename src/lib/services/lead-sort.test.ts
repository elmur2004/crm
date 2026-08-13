import { describe, expect, it } from "vitest";
import { sortLeads, stagePriority } from "./lead-sort";

/* Founder leads-list ordering — pure unit coverage (no db). */

function lead(stage: string, createdAt: string, updatedAt: string) {
  return { stage, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt) };
}

describe("lead sorting (founder: added / updated / pipeline priority)", () => {
  it("ranks stages closer to the finish first, terminals last, unknowns at the bottom", () => {
    expect(stagePriority("negotiation")).toBeLessThan(stagePriority("sending_proposal"));
    expect(stagePriority("sending_proposal")).toBeLessThan(stagePriority("meeting_setting"));
    expect(stagePriority("meeting_setting")).toBeLessThan(stagePriority("following_up"));
    expect(stagePriority("following_up")).toBeLessThan(stagePriority("new"));
    expect(stagePriority("new")).toBeLessThan(stagePriority("won"));
    expect(stagePriority("won")).toBeLessThan(stagePriority("lost"));
    expect(stagePriority("something_else")).toBeGreaterThan(stagePriority("lost"));
  });

  it("sorts by added (createdAt desc), updated (updatedAt desc), and priority (rank, then updated)", () => {
    const a = lead("new", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z");
    const b = lead("negotiation", "2026-08-02T00:00:00Z", "2026-08-03T00:00:00Z");
    const c = lead("won", "2026-08-03T00:00:00Z", "2026-08-12T00:00:00Z");
    const d = lead("negotiation", "2026-08-04T00:00:00Z", "2026-08-05T00:00:00Z");
    const input = [a, b, c, d];

    expect(sortLeads(input, "added")).toEqual([d, c, b, a]);
    expect(sortLeads(input, "updated")).toEqual([c, a, d, b]);
    /* priority: the two negotiations first (most recently updated of them
       first), then new, then won; the input array is not mutated. */
    expect(sortLeads(input, "priority")).toEqual([d, b, a, c]);
    expect(input).toEqual([a, b, c, d]);
  });
});
