import { beforeEach, describe, expect, it } from "vitest";

/* ============================================================================
   THE ASSIGN DIALOG'S PEOPLE — one roster, every place it opens (ADR-104).

   `assignRosterFor` builds the list behind every "Assign owner": both lead
   pages, every To-Do row and every row of both Leads lists. Proved here, on
   the real Postgres: exactly the people each company's list has always had —
   and, the property that keeps the dialog honest, every one of them is a
   target `resolveAssignee` (the write's own re-check) ACCEPTS, so the dialog
   can never offer somebody the server would refuse.
   ========================================================================== */

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import type { Role } from "@/lib/pipeline-engine/constants";
import { assignRosterFor } from "./assign-roster";
import { resolveAssignee } from "./leads";

let seq = 0;
async function makeUser(
  name: string,
  roles: Role[],
  opts: { active?: boolean; registrationStatus?: string } = {},
) {
  seq += 1;
  return db.user.create({
    data: {
      name,
      phone: `+2010444${String(seq).padStart(4, "0")}`,
      passwordHash: "x",
      active: opts.active ?? true,
      registrationStatus: opts.registrationStatus ?? "approved",
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("B-Systems: live agents, partners and internal sales — never an admin", () => {
  it("is exactly that set, labelled by role, and every one is a target the write accepts", async () => {
    const admin = await makeUser("Elmur", ["bsystems_admin", "byteforce_staff"]);
    await makeUser("Agent Amr", ["bsystems_agent"]);
    await makeUser("Partner Co", ["bsystems_partner"]);
    await makeUser("Sales Sami", ["bsystems_sales"]);
    await makeUser("Second Admin", ["bsystems_admin"]);
    await makeUser("Entry Eman", ["bsystems_data_entry"]);
    await makeUser("Staff Sara", ["byteforce_staff"]);
    await makeUser("Gone Sales", ["bsystems_sales"], { active: false });
    await makeUser("Pending Agent", ["bsystems_agent"], { registrationStatus: "pending" });

    for (const includeSelf of [true, false]) {
      const roster = await assignRosterFor("bsystems", admin, "en", { includeSelf });
      expect(roster.map((r) => `${r.name} — ${r.roleLabel}`)).toEqual([
        "Agent Amr — Agent",
        "Partner Co — Partner",
        "Sales Sami — Internal sales",
      ]);
      for (const entry of roster) {
        await expect(resolveAssignee("bsystems", entry.id)).resolves.toMatchObject({ id: entry.id });
      }
    }
  });

  it("speaks the viewer's language", async () => {
    const admin = await makeUser("Elmur", ["bsystems_admin"]);
    await makeUser("Sales Sami", ["bsystems_sales"]);
    const [entry] = await assignRosterFor("bsystems", admin, "ar", { includeSelf: false });
    expect(entry!.roleLabel).toBe("مبيعات داخلية");
  });
});

describe("ByteForce: every live staff account — the admin as '(me)' where he may take it", () => {
  it("offers him on the lead page and the lists, leaves him out on the To-Do; never anyone else", async () => {
    const admin = await makeUser("Elmur", ["bsystems_admin", "byteforce_staff"]);
    await makeUser("Staff Sara", ["byteforce_staff"]);
    await makeUser("Staff Tarek", ["byteforce_staff"]);
    await makeUser("Gone Staff", ["byteforce_staff"], { active: false });
    await makeUser("Sales Sami", ["bsystems_sales"]);

    const withSelf = await assignRosterFor("byteforce", admin, "en", { includeSelf: true });
    expect(withSelf.map((r) => r.name)).toEqual(["Elmur (me)", "Staff Sara", "Staff Tarek"]);
    expect(new Set(withSelf.map((r) => r.roleLabel))).toEqual(new Set(["ByteForce staff"]));
    for (const entry of withSelf) {
      await expect(resolveAssignee("byteforce", entry.id)).resolves.toMatchObject({ id: entry.id });
    }

    const withoutSelf = await assignRosterFor("byteforce", admin, "en", { includeSelf: false });
    expect(withoutSelf.map((r) => r.name)).toEqual(["Staff Sara", "Staff Tarek"]);
  });
});
