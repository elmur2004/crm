import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { createLead } from "@/lib/services/leads";
import type { Actor } from "@/lib/services/activity";
import type { Role } from "@/lib/pipeline-engine/constants";
import { countMatchesIn, searchHop, SWITCHED_PARAM } from "./search-hop";

/* ============================================================================
   ADR-085 §1 — THE HOP CANNOT WIDEN ACCESS BY ONE ROW.

   The probe asks "would the OTHER company's board show this to THIS person",
   and the only honest way to ask is to run that board's own predicate. These
   tests are what stops it drifting into a brand-only count, which would tell a
   partner that somebody else's lead matched his search — a disclosure even
   though it names nothing, because it answers a question he may not ask.
   ========================================================================== */

const actor: Actor = { id: null, label: "Test Staff" };

async function user(name: string, roles: Role[]) {
  const row = await db.user.create({
    data: { name, email: `${name}@x.example`, passwordHash: "h" },
  });
  for (const role of roles) await db.userRole.create({ data: { userId: row.id, role } });
  return { id: row.id, roles };
}

beforeEach(async () => {
  await resetDb();
});

describe("The cross-company probe runs the target board's own wall (ADR-085)", () => {
  it("finds a B-Systems lead for the admin, and the ByteForce one for ByteForce", async () => {
    await createLead(
      "bsystems",
      { name: "Nile Foods", number: "0100000001", type: "cold_call" },
      actor,
    );
    await createLead(
      "byteforce",
      { name: "Nile Mills", number: "0100000002", type: "cold_call" },
      actor,
    );
    const admin = await user("elmur", ["bsystems_admin", "byteforce_staff"]);

    expect(await countMatchesIn("bsystems", admin, { search: "Nile" })).toBe(1);
    expect(await countMatchesIn("byteforce", admin, { search: "Nile" })).toBe(1);
    /* each company counts only its own rows — the brand wall, from the board */
    expect(await countMatchesIn("bsystems", admin, { search: "Mills" })).toBe(0);
    expect(await countMatchesIn("byteforce", admin, { search: "Foods" })).toBe(0);
  });

  it("matches the company and the number the way the search box does", async () => {
    await createLead(
      "byteforce",
      {
        name: "Delta",
        number: "0101234567",
        type: "cold_call",
        companyName: "Delta Trading LLC",
      },
      actor,
    );
    const u = await user("bf", ["bsystems_admin", "byteforce_staff"]);
    expect(await countMatchesIn("byteforce", u, { search: "delta trading" })).toBe(1); // company
    expect(await countMatchesIn("byteforce", u, { search: "010 123" })).toBe(1); // spaced number
    expect(await countMatchesIn("byteforce", u, { search: "DELTA" })).toBe(1); // case
  });

  /* THE WALL, case by case. Each of these would be a disclosure if the probe
     counted by brand alone. */
  it("hides another owner's lead from a SALES rep — the internal bucket only", async () => {
    const agent = await user("omar", ["bsystems_agent"]);
    await createLead(
      "bsystems",
      { name: "Agent's Own Lead", number: "0100000003", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    const sales = await user("sara", ["bsystems_sales", "byteforce_staff"]);
    /* the B-Systems board shows `bsystems_sales` the INTERNAL bucket, and this
       lead is in the agent bucket */
    expect(await countMatchesIn("bsystems", sales, { search: "Agent's Own" })).toBe(0);

    await createLead(
      "bsystems",
      { name: "Internal Lead", number: "0100000004", type: "cold_call" },
      actor,
    );
    expect(await countMatchesIn("bsystems", sales, { search: "Internal" })).toBe(1);
  });

  it("hides one agent's lead from ANOTHER agent", async () => {
    const mine = await user("omar", ["bsystems_agent", "byteforce_staff"]);
    const theirs = await user("hassan", ["bsystems_agent"]);
    await createLead(
      "bsystems",
      { name: "Hassan Lead", number: "0100000005", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: theirs.id },
    );
    await createLead(
      "bsystems",
      { name: "Omar Lead", number: "0100000006", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: mine.id },
    );

    expect(await countMatchesIn("bsystems", mine, { search: "Hassan" })).toBe(0);
    expect(await countMatchesIn("bsystems", mine, { search: "Omar" })).toBe(1);
  });

  it("counts ZERO for an account with no B-Systems board at all — fail closed", async () => {
    await createLead(
      "bsystems",
      { name: "Nile Foods", number: "0100000007", type: "cold_call" },
      actor,
    );
    /* ADR-051 carves data entry out of every pipeline screen, so there is no
       board to send them to and the probe must not pretend otherwise */
    const entry = await user("dataentry", ["bsystems_data_entry"]);
    expect(await countMatchesIn("bsystems", entry, { search: "Nile" })).toBe(0);
    /* and an account holding no role for that company at all */
    const bfOnly = await user("bfonly", ["byteforce_staff"]);
    expect(await countMatchesIn("bsystems", bfOnly, { search: "Nile" })).toBe(0);
  });

  it("excludes archived leads and anything off the board, as the boards do", async () => {
    const lead = await createLead(
      "byteforce",
      { name: "Archived Co", number: "0100000008", type: "cold_call" },
      actor,
    );
    const u = await user("bf", ["bsystems_admin", "byteforce_staff"]);
    expect(await countMatchesIn("byteforce", u, { search: "Archived Co" })).toBe(1);
    await db.lead.update({ where: { id: lead.id }, data: { archived: true } });
    expect(await countMatchesIn("byteforce", u, { search: "Archived Co" })).toBe(0);
  });
});

describe("The whole hop decision, against a real database (ADR-085)", () => {
  const hop = (
    u: { id: string; roles: Role[] },
    current: "bsystems" | "byteforce",
    params: Record<string, string | string[] | undefined>,
  ) =>
    searchHop({
      search: (params.q as string | undefined) ?? "",
      user: u,
      current,
      path: "/b-systems/crm",
      params,
    });

  it("sends the founder to ByteForce when only ByteForce has it", async () => {
    await createLead(
      "byteforce",
      { name: "Nile Mills", number: "0100000009", type: "cold_call" },
      actor,
    );
    const admin = await user("elmur", ["bsystems_admin", "byteforce_staff"]);

    const result = await hop(admin, "bsystems", { q: "Nile Mills" });
    expect(result?.to).toBe("byteforce");
    const url = new URL(result!.url, "https://x.example");
    expect(url.searchParams.get("company")).toBe("byteforce");
    expect(url.searchParams.get("q")).toBe("Nile Mills");
    expect(url.searchParams.get(SWITCHED_PARAM)).toBe("bsystems");
  });

  it("stays put when the current company HAS it", async () => {
    await createLead(
      "bsystems",
      { name: "Nile Foods", number: "0100000010", type: "cold_call" },
      actor,
    );
    const admin = await user("elmur", ["bsystems_admin", "byteforce_staff"]);
    expect(await hop(admin, "bsystems", { q: "Nile" })).toBeNull();
  });

  it("stays put when NEITHER company has it — and says nothing", async () => {
    const admin = await user("elmur", ["bsystems_admin", "byteforce_staff"]);
    expect(await hop(admin, "bsystems", { q: "nobody by this name" })).toBeNull();
  });

  /* THE ONE THAT MATTERS: a rep must not be moved to the other company on the
     strength of a lead he would not be shown when he got there. */
  it("does not move an agent for somebody else's lead", async () => {
    const theirs = await user("hassan", ["bsystems_agent"]);
    await createLead(
      "bsystems",
      { name: "Hassan Lead", number: "0100000011", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: theirs.id },
    );
    const mine = await user("omar", ["bsystems_agent", "byteforce_staff"]);
    /* searching from ByteForce: B-Systems "has" a match by brand, but not one
       that is his — so he stays where he is */
    expect(await hop(mine, "byteforce", { q: "Hassan" })).toBeNull();

    /* and when it IS his, he is moved */
    await createLead(
      "bsystems",
      { name: "Omar Lead", number: "0100000012", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: mine.id },
    );
    expect((await hop(mine, "byteforce", { q: "Omar Lead" }))?.to).toBe("bsystems");
  });

  it("refuses a second hop, so two empty companies cannot bounce for ever", async () => {
    await createLead(
      "byteforce",
      { name: "Nile Mills", number: "0100000013", type: "cold_call" },
      actor,
    );
    const admin = await user("elmur", ["bsystems_admin", "byteforce_staff"]);
    /* the marker is on the URL — the state the first hop left behind */
    expect(
      await hop(admin, "bsystems", { q: "Nile Mills", [SWITCHED_PARAM]: "byteforce" }),
    ).toBeNull();
  });

  it("never moves an account locked to one company", async () => {
    await createLead(
      "bsystems",
      { name: "Nile Foods", number: "0100000014", type: "cold_call" },
      actor,
    );
    const locked = await user("bfonly", ["byteforce_staff"]);
    expect(await hop(locked, "byteforce", { q: "Nile Foods" })).toBeNull();
  });
});
