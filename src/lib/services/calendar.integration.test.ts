import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { createLead } from "./leads";
import { calendarFor, listCalendarPeople, type CalendarEntry, type CalendarScope } from "./calendar";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "./calendar-events";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-071 — THE CALENDAR GRANTS NOTHING.

   The feature's whole risk is in one direction: it puts everybody's time on one
   screen, and SPEC §3 says an agent may never read another agent's deals. So
   these tests are written from the NEGATIVE side — the assertions that matter
   are about what is ABSENT from an entry, not about what is present.

   Every case seeds a record belonging to SOMEBODY ELSE first. A test that
   seeded only the viewer's own rows would pass just as happily against a
   service with no scope predicate at all, which is exactly the bug worth
   catching here.
   ========================================================================== */

const actor: Actor = { id: null, label: "Test Admin" };

/* A fixed window, so nothing here depends on the day the suite runs. */
const FROM = new Date("2026-09-01T00:00:00Z");
const TO = new Date("2026-10-01T00:00:00Z");
const AT = new Date("2026-09-15T11:00:00Z"); // 2 PM Cairo

let seq = 0;

async function makeUser(name: string, role: string) {
  seq += 1;
  const user = await db.user.create({
    data: { name, phone: `+2010077700${String(10 + seq)}`, passwordHash: "x" },
  });
  await db.userRole.create({ data: { userId: user.id, role } });
  return user;
}

async function makeLead(
  brand: "bsystems" | "byteforce",
  name: string,
  opts?: { ownerType?: string; ownerUserId?: string },
) {
  seq += 1;
  return createLead(
    brand,
    { name, number: `010777${String(1000 + seq)}`, type: "cold_call" },
    actor,
    opts ? { ownerType: opts.ownerType as never, ownerUserId: opts.ownerUserId } : undefined,
  );
}

async function makeMeeting(
  leadId: string,
  opts?: { at?: Date; arranged?: boolean; attendees?: string[] },
) {
  return db.meeting.create({
    data: {
      leadId,
      arranged: opts?.arranged ?? true,
      datetime: opts?.at ?? AT,
      mode: "online",
      attendees: opts?.attendees?.length
        ? { create: opts.attendees.map((userId) => ({ userId })) }
        : undefined,
    },
  });
}

const read = (brand: "bsystems" | "byteforce", id: string, scope: CalendarScope) =>
  calendarFor({ brand, viewer: { id, scope }, from: FROM, to: TO });

/** The assertion this whole file exists for. */
function expectTellsNothing(entry: CalendarEntry) {
  expect(entry.detail).toBe("busy");
  expect(entry.title).toBeNull();
  expect(entry.href).toBeNull();
  expect(entry.note).toBeNull();
  expect(entry.leadId).toBeNull();
  expect(entry.mode).toBeNull();
  expect(entry.outcome).toBeNull();
  expect(entry.shared).toBeNull();
  expect(entry.mine).toBe(false);
  /* what it DOES carry is the point of the feature: whose time it is */
  expect(entry.people.length).toBeGreaterThan(0);
}

beforeEach(async () => {
  await resetDb();
});

describe("a CRM meeting outside the viewer's scope", () => {
  it("reaches another agent as a busy block that names the person and nothing else", async () => {
    const mine = await makeUser("Agent Mine", "bsystems_agent");
    const theirs = await makeUser("Agent Theirs", "bsystems_agent");
    const lead = await makeLead("bsystems", "Their Client Ltd", {
      ownerType: "agent",
      ownerUserId: theirs.id,
    });
    await makeMeeting(lead.id);

    const entries = await read("bsystems", mine.id, { kind: "own", userId: mine.id });
    expect(entries).toHaveLength(1);
    expectTellsNothing(entries[0]!);
    expect(entries[0]!.people.map((p) => p.name)).toEqual(["Agent Theirs"]);
  });

  it("reaches its OWN agent in full, with the client's name and a way in", async () => {
    const mine = await makeUser("Agent Mine", "bsystems_agent");
    const lead = await makeLead("bsystems", "My Client Ltd", {
      ownerType: "agent",
      ownerUserId: mine.id,
    });
    await makeMeeting(lead.id);

    const [entry] = await read("bsystems", mine.id, { kind: "own", userId: mine.id });
    expect(entry!.detail).toBe("full");
    expect(entry!.title).toBe("My Client Ltd");
    expect(entry!.leadId).toBe(lead.id);
    expect(entry!.href).toContain(lead.id);
    expect(entry!.mode).toBe("online");
  });

  it("is full for the admin and busy for a sales rep it does not belong to", async () => {
    const admin = await makeUser("The Admin", "bsystems_admin");
    const sales = await makeUser("Internal Sales", "bsystems_sales");
    const agent = await makeUser("An Agent", "bsystems_agent");
    const lead = await makeLead("bsystems", "Agent Client", {
      ownerType: "agent",
      ownerUserId: agent.id,
    });
    await makeMeeting(lead.id);

    const [asAdmin] = await read("bsystems", admin.id, { kind: "all" });
    expect(asAdmin!.detail).toBe("full");
    expect(asAdmin!.title).toBe("Agent Client");

    /* sales sees the INTERNAL bucket only — an agent-owned lead is not it */
    const [asSales] = await read("bsystems", sales.id, { kind: "internal" });
    expectTellsNothing(asSales!);
  });
});

describe("what never reaches the grid at all", () => {
  it("ignores an UNARRANGED meeting — a proposed slot is nobody's commitment yet", async () => {
    const admin = await makeUser("The Admin", "bsystems_admin");
    const lead = await makeLead("bsystems", "Maybe Later Ltd");
    await makeMeeting(lead.id, { arranged: false });
    expect(await read("bsystems", admin.id, { kind: "all" })).toHaveLength(0);
  });

  it("ignores a meeting on an ARCHIVED lead", async () => {
    const admin = await makeUser("The Admin", "bsystems_admin");
    const lead = await makeLead("bsystems", "Archived Ltd");
    await makeMeeting(lead.id);
    await db.lead.update({ where: { id: lead.id }, data: { archived: true } });
    expect(await read("bsystems", admin.id, { kind: "all" })).toHaveLength(0);
  });

  it("ignores a meeting outside the window", async () => {
    const admin = await makeUser("The Admin", "bsystems_admin");
    const lead = await makeLead("bsystems", "Next Year Ltd");
    await makeMeeting(lead.id, { at: new Date("2026-12-01T11:00:00Z") });
    expect(await read("bsystems", admin.id, { kind: "all" })).toHaveLength(0);
  });

  it("does not show the OTHER company's meetings", async () => {
    const admin = await makeUser("The Admin", "bsystems_admin");
    const bfLead = await makeLead("byteforce", "ByteForce Client");
    await makeMeeting(bfLead.id);
    expect(await read("bsystems", admin.id, { kind: "all" })).toHaveLength(0);
  });

  it("drops an out-of-scope meeting that occupies NOBODY — there is nothing to tell", async () => {
    const agent = await makeUser("An Agent", "bsystems_agent");
    /* an internal lead with no owner ACCOUNT: nobody's calendar is affected, so
       a hatched block against no name would only leak that a meeting exists */
    const lead = await makeLead("bsystems", "Unassigned Internal Ltd");
    await makeMeeting(lead.id);
    expect(await read("bsystems", agent.id, { kind: "own", userId: agent.id })).toHaveLength(0);
  });
});

describe("personal entries", () => {
  it("shows a colleague's PRIVATE entry as busy, with the title withheld", async () => {
    const me = await makeUser("Me", "bsystems_agent");
    const them = await makeUser("Them", "bsystems_agent");
    await createCalendarEvent(
      { title: "Dentist", note: "second filling", date: "2026-09-10", time: "10:00", allDay: false, shared: false },
      them.id,
    );

    const [entry] = await read("bsystems", me.id, { kind: "own", userId: me.id });
    expectTellsNothing(entry!);
    expect(entry!.people).toEqual([{ id: them.id, name: "Them" }]);
  });

  it("shows a colleague's SHARED entry by name — but never its private note", async () => {
    const me = await makeUser("Me", "bsystems_agent");
    const them = await makeUser("Them", "bsystems_agent");
    await createCalendarEvent(
      { title: "Supplier visit — Alexandria", note: "ask about the invoice", date: "2026-09-10", time: "10:00", allDay: false, shared: true },
      them.id,
    );

    const [entry] = await read("bsystems", me.id, { kind: "own", userId: me.id });
    expect(entry!.detail).toBe("full");
    expect(entry!.title).toBe("Supplier visit — Alexandria");
    /* the founder's toggle NAMES an entry; it does not publish the memo inside
       it, and it does not tell anyone how the owner set the toggle */
    expect(entry!.note).toBeNull();
    expect(entry!.shared).toBeNull();
    expect(entry!.mine).toBe(false);
  });

  it("gives the owner their own entry whole, note and visibility included", async () => {
    const me = await makeUser("Me", "bsystems_agent");
    await createCalendarEvent(
      { title: "Dentist", note: "second filling", date: "2026-09-10", time: "10:00", allDay: false, shared: false },
      me.id,
    );

    const [entry] = await read("bsystems", me.id, { kind: "own", userId: me.id });
    expect(entry!.detail).toBe("full");
    expect(entry!.title).toBe("Dentist");
    expect(entry!.note).toBe("second filling");
    expect(entry!.mine).toBe(true);
    /* round-trips to the edit form, so a typo fix cannot silently un-share it */
    expect(entry!.shared).toBe(false);
  });

  it("spans every day an all-day entry covers, and stops on the last one", async () => {
    const me = await makeUser("Me", "bsystems_agent");
    await createCalendarEvent(
      { title: "Conference", date: "2026-09-07", endDate: "2026-09-09", allDay: true, shared: true },
      me.id,
    );
    const [entry] = await read("bsystems", me.id, { kind: "own", userId: me.id });
    expect(entry!.allDay).toBe(true);
    /* half-open: it ends at the first instant of the 10th, so the 10th is NOT
       covered and the 9th still is */
    expect(entry!.endsAt.getTime()).toBeGreaterThan(new Date("2026-09-09T12:00:00Z").getTime());
    expect(entry!.endsAt.getTime()).toBeLessThanOrEqual(new Date("2026-09-10T00:00:00Z").getTime());
  });

  it("hides a person who holds no role in the company being viewed", async () => {
    const me = await makeUser("Me", "bsystems_agent");
    const outsider = await makeUser("ByteForce Only", "byteforce_staff");
    await createCalendarEvent(
      { title: "Their day", date: "2026-09-10", time: "10:00", allDay: false, shared: true },
      outsider.id,
    );
    expect(await read("bsystems", me.id, { kind: "own", userId: me.id })).toHaveLength(0);
  });
});

describe("Also blocks — the founder's X and Y", () => {
  it("puts a meeting on the calendar of somebody who does not own the lead", async () => {
    const x = await makeUser("X the Closer", "bsystems_admin");
    const y = await makeUser("Y the Engineer", "bsystems_sales");
    const lead = await makeLead("bsystems", "Big Client", { ownerType: "admin", ownerUserId: x.id });
    await makeMeeting(lead.id, { attendees: [y.id] });

    /* X books it, and Y is now occupied — the whole point of the picker */
    const [asAdmin] = await read("bsystems", x.id, { kind: "all" });
    expect(asAdmin!.people.map((p) => p.name).sort()).toEqual(["X the Closer", "Y the Engineer"]);

    /* and the meeting still tells a viewer outside its scope nothing */
    const stranger = await makeUser("Some Agent", "bsystems_agent");
    const [asStranger] = await read("bsystems", stranger.id, {
      kind: "own",
      userId: stranger.id,
    });
    expectTellsNothing(asStranger!);
    expect(asStranger!.people.map((p) => p.name)).toContain("Y the Engineer");
  });

  it("never lists the same person twice when they own the lead AND are marked", async () => {
    const admin = await makeUser("The Admin", "bsystems_admin");
    const lead = await makeLead("bsystems", "Client", {
      ownerType: "admin",
      ownerUserId: admin.id,
    });
    await makeMeeting(lead.id, { attendees: [admin.id] });
    const [entry] = await read("bsystems", admin.id, { kind: "all" });
    expect(entry!.people).toHaveLength(1);
  });
});

describe("writing an entry is bounded by ownership", () => {
  it("refuses to edit or delete somebody else's entry, with 404 rather than 403", async () => {
    const me = await makeUser("Me", "bsystems_agent");
    const them = await makeUser("Them", "bsystems_agent");
    const row = await createCalendarEvent(
      { title: "Theirs", date: "2026-09-10", time: "10:00", allDay: false, shared: false },
      them.id,
    );
    const edit = { title: "Hijacked", date: "2026-09-10", time: "10:00", allDay: false, shared: false };
    await expect(updateCalendarEvent(row.id, edit, me.id)).rejects.toMatchObject({ status: 404 });
    await expect(deleteCalendarEvent(row.id, me.id)).rejects.toMatchObject({ status: 404 });
    /* and the row is untouched */
    expect((await db.calendarEvent.findUnique({ where: { id: row.id } }))!.title).toBe("Theirs");
  });

  it("refuses a window that ends before it starts", async () => {
    const me = await makeUser("Me", "bsystems_agent");
    await expect(
      createCalendarEvent(
        { title: "Backwards", date: "2026-09-10", time: "14:00", endDate: "2026-09-10", endTime: "13:00", allDay: false, shared: false },
        me.id,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("the roster", () => {
  it("lists the company's own active accounts and nobody else's", async () => {
    const a = await makeUser("BS Admin", "bsystems_admin");
    await makeUser("BF Staff", "byteforce_staff");
    const gone = await makeUser("Deactivated", "bsystems_sales");
    await db.user.update({ where: { id: gone.id }, data: { active: false } });

    const people = await listCalendarPeople("bsystems");
    expect(people.map((p) => p.id)).toEqual([a.id]);
  });
});
