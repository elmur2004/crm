import { beforeEach, describe, expect, it, vi } from "vitest";

/* The ONE piece of the request that cannot come from the database: the session.
   Everything else here is real — the real route modules, the real guards, the
   real service, the real Postgres. Mocked by module path so the guards' own
   `./index` import resolves to this stub (the todo-done-routes precedent). */
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ user?: { id: string } } | null>>(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { exportBackup, importBackup } from "./backup";
import { markLeadWhatsappSent } from "./whatsapp";
import { getLeadDetail, setNoAnswer } from "./leads";
import { deleteUser } from "./users";
import { pendingUndoFor, performUndo } from "./undo";
import { POST as bsLeadPost } from "@/app/api/b-systems/leads/[id]/whatsapp/route";
import { POST as bfLeadPost } from "@/app/api/byteforce/leads/[id]/whatsapp/route";
import { POST as prospectPost } from "@/app/api/b-systems/partners-pipeline/[id]/whatsapp/route";

/* ADR-069 — the shared WhatsApp mark, at the wall.

   Founder: "when I click on the WhatsApp button, it should turn to be green to
   signal that I already sent WhatsApp to that prospect or to that lead, and it
   signals not just for my user, for any user that we have contacted this lead
   through WhatsApp."

   Three things this file has to prove, because all three are load-bearing: the
   wall is the same one that governs READING the record (per role, on the real
   handlers); a second press keeps the FIRST record; and the mark is visible to
   somebody OTHER than the person who pressed — which is the whole request. */

type Role =
  | "bsystems_admin"
  | "bsystems_sales"
  | "bsystems_agent"
  | "bsystems_partner"
  | "bsystems_data_entry"
  | "byteforce_staff";

let seq = 0;
async function makeUser(name: string, ...roles: Role[]) {
  return db.user.create({
    data: {
      name,
      phone: `+2010777200${seq++}`,
      passwordHash: "x",
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

async function makeLead(opts: {
  name: string;
  brand?: string;
  ownerType?: string;
  ownerUserId?: string | null;
  archived?: boolean;
}) {
  return db.lead.create({
    data: {
      brand: opts.brand ?? "bsystems",
      name: opts.name,
      number: "01001234567",
      type: "cold_call",
      stage: "new",
      ownerType: opts.ownerType ?? "internal",
      ownerUserId: opts.ownerUserId ?? null,
      archived: opts.archived ?? false,
    },
  });
}

const makeProspect = (name: string) =>
  db.partnerProspect.create({
    data: { kind: "agent", name, number: "01055522233", speciality: "ERP" },
  });

type Body = { ok?: boolean; error?: string; sentAt?: string | null; sentBy?: string | null };

/** Sign in as `user` (or nobody) and POST the mark. The chip fires this with
    `navigator.sendBeacon`, which sends NO body — so neither does this, unless a
    test is deliberately proving a body cannot change who the actor is. */
async function press(
  route: "bs-lead" | "bf-lead" | "prospect",
  user: { id: string } | null,
  id: string,
  body?: unknown,
): Promise<{ status: number; json: Body }> {
  authMock.mockResolvedValue(user ? { user: { id: user.id } } : null);
  const url = `http://localhost/api/mark/${id}`;
  const req = body
    ? new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    : new Request(url, { method: "POST" });
  const ctx = { params: Promise.resolve({ id }) };
  const handler =
    route === "bs-lead" ? bsLeadPost : route === "bf-lead" ? bfLeadPost : prospectPost;
  const res = await handler(req, ctx);
  return { status: res.status, json: (await res.json()) as Body };
}

const markOf = (leadId: string) =>
  db.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { whatsappSentAt: true, whatsappSentById: true, whatsappSentByLabel: true },
  });

beforeEach(async () => {
  authMock.mockReset();
  await resetDb();
});

describe("POST …/whatsapp — authentication runs before the record lookup", () => {
  it("an anonymous press is 401 for a REAL id and a made-up one alike (no existence oracle)", async () => {
    const lead = await makeLead({ name: "Anon Probe" });

    const real = await press("bs-lead", null, lead.id);
    const fake = await press("bs-lead", null, "does-not-exist");
    expect(real.status).toBe(401);
    expect(fake.status).toBe(401);
    expect(real.json.error).toBe(fake.json.error); // byte-identical — nothing leaks

    expect((await markOf(lead.id)).whatsappSentAt).toBeNull();
  });
});

describe("POST …/whatsapp — the wall, per role", () => {
  it("bsystems_sales marks an INTERNAL lead and is refused an agent-owned one", async () => {
    const sales = await makeUser("Sales Rep", "bsystems_sales");
    const agent = await makeUser("Agent Karim", "bsystems_agent");
    const internal = await makeLead({ name: "Internal Lead" });
    const agentLead = await makeLead({
      name: "Agent Lead",
      ownerType: "agent",
      ownerUserId: agent.id,
    });

    const ok = await press("bs-lead", sales, internal.id);
    expect(ok.status).toBe(200);
    expect(ok.json.sentBy).toBe("Sales Rep");
    expect((await markOf(internal.id)).whatsappSentById).toBe(sales.id);

    const walled = await press("bs-lead", sales, agentLead.id);
    expect(walled.status).toBe(403);
    expect((await markOf(agentLead.id)).whatsappSentAt).toBeNull();
  });

  it("an agent reaches ONLY his own lead", async () => {
    const mine = await makeUser("Agent Own", "bsystems_agent");
    const other = await makeUser("Agent Other", "bsystems_agent");
    const ownLead = await makeLead({ name: "Own", ownerType: "agent", ownerUserId: mine.id });
    const otherLead = await makeLead({
      name: "Not Mine",
      ownerType: "agent",
      ownerUserId: other.id,
    });

    expect((await press("bs-lead", mine, ownLead.id)).status).toBe(200);
    expect((await press("bs-lead", mine, otherLead.id)).status).toBe(403);
    expect((await markOf(otherLead.id)).whatsappSentAt).toBeNull();
  });

  it("the two brand namespaces cannot reach across, in either direction", async () => {
    const bfStaff = await makeUser("BF Staff", "byteforce_staff");
    const bsAdmin = await makeUser("BS Admin", "bsystems_admin");
    const bsLead = await makeLead({ name: "B-Systems Lead" });
    const bfLead = await makeLead({ name: "ByteForce Lead", brand: "byteforce" });

    /* the BRAND comes from the ROUTE: a B-Systems id through /api/byteforce is
       404 — indistinguishable from a lead that does not exist */
    expect((await press("bf-lead", bfStaff, bsLead.id)).status).toBe(404);
    expect((await markOf(bsLead.id)).whatsappSentAt).toBeNull();

    /* …and a ByteForce id through /api/b-systems is refused by requireLeadAccess */
    expect((await press("bs-lead", bsAdmin, bfLead.id)).status).toBe(403);
    expect((await markOf(bfLead.id)).whatsappSentAt).toBeNull();

    /* each through its own door works */
    expect((await press("bf-lead", bfStaff, bfLead.id)).status).toBe(200);
    expect((await press("bs-lead", bsAdmin, bsLead.id)).status).toBe(200);
  });

  it("the prospect mark is admin-only — the wall its every surface already has", async () => {
    const admin = await makeUser("Prospect Admin", "bsystems_admin");
    const sales = await makeUser("Prospect Sales", "bsystems_sales");
    const entry = await makeUser("Data Entry", "bsystems_data_entry");
    const prospect = await makeProspect("Kindfilter Agent");

    for (const who of [sales, entry]) {
      expect((await press("prospect", who, prospect.id)).status).toBe(403);
    }
    expect(
      (await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } })).whatsappSentAt,
    ).toBeNull();

    const ok = await press("prospect", admin, prospect.id);
    expect(ok.status).toBe(200);
    const fresh = await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(fresh.whatsappSentById).toBe(admin.id);
    expect(fresh.whatsappSentByLabel).toBe("Prospect Admin");
  });

  it("the actor is the SESSION's, never the request body's", async () => {
    const sales = await makeUser("Real Presser", "bsystems_sales");
    const someoneElse = await makeUser("Framed Colleague", "bsystems_sales");
    const lead = await makeLead({ name: "Actor Probe" });

    const res = await press("bs-lead", sales, lead.id, {
      userId: someoneElse.id,
      actorLabel: "Framed Colleague",
    });
    expect(res.status).toBe(200);
    const mark = await markOf(lead.id);
    expect(mark.whatsappSentById).toBe(sales.id);
    expect(mark.whatsappSentByLabel).toBe("Real Presser");
  });
});

describe("the mark keeps the FIRST press", () => {
  it("a second press by anybody leaves who and when untouched — and still logs", async () => {
    const first = await makeUser("Omar Farouk", "bsystems_admin");
    const second = await makeUser("Sara Hassan", "bsystems_admin");
    const lead = await makeLead({ name: "First Wins" });

    const one = await press("bs-lead", first, lead.id);
    expect(one.status).toBe(200);
    const after = await markOf(lead.id);

    const two = await press("bs-lead", second, lead.id);
    expect(two.status).toBe(200);
    /* the response the SECOND presser gets back is the FIRST record — the chip
       must not tell him he was the one who did the diligence */
    expect(two.json.sentBy).toBe("Omar Farouk");

    const later = await markOf(lead.id);
    expect(later.whatsappSentById).toBe(first.id);
    expect(later.whatsappSentByLabel).toBe("Omar Farouk");
    expect(later.whatsappSentAt).toEqual(after.whatsappSentAt);

    /* but every press IS recorded: the columns keep the first message, the
       ActivityLog keeps them all, which is where "who messaged them most
       recently" is answered from (ADR-069) */
    const log = await db.activityLog.findMany({
      where: { entityType: "lead", entityId: lead.id, trigger: "whatsapp_sent" },
      orderBy: { createdAt: "asc" },
    });
    expect(log).toHaveLength(2);
    expect(log.map((e) => e.actorLabel)).toEqual(["Omar Farouk", "Sara Hassan"]);
  });

  it("racing presses cannot interleave into a half-written row", async () => {
    const a = await makeUser("Racer A", "bsystems_admin");
    const b = await makeUser("Racer B", "bsystems_admin");
    const lead = await makeLead({ name: "Race" });

    /* the mark is a CONDITIONAL update (`whatsappSentAt: null` in the WHERE),
       so the loser matches no row rather than overwriting the winner */
    await Promise.all([
      markLeadWhatsappSent("bsystems", lead.id, { id: a.id, label: a.name }),
      markLeadWhatsappSent("bsystems", lead.id, { id: b.id, label: b.name }),
    ]);
    const mark = await markOf(lead.id);
    expect(mark.whatsappSentAt).not.toBeNull();
    /* whoever won, the row is CONSISTENT: the id and the label belong to the
       same person, and both presses are in the history */
    const winner = [a, b].find((u) => u.id === mark.whatsappSentById);
    expect(winner).toBeDefined();
    expect(mark.whatsappSentByLabel).toBe(winner!.name);
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "whatsapp_sent" } }),
    ).toBe(2);
  });

  it("an ARCHIVED lead can still be marked — the message really was sent", async () => {
    const admin = await makeUser("Archive Admin", "bsystems_admin");
    const lead = await makeLead({ name: "Archived", archived: true });
    expect((await press("bs-lead", admin, lead.id)).status).toBe(200);
    expect((await markOf(lead.id)).whatsappSentAt).not.toBeNull();
  });
});

describe("the mark is the RECORD's, not the presser's", () => {
  it("a DIFFERENT user reads the same mark on the same lead", async () => {
    const presser = await makeUser("Omar Farouk", "bsystems_sales");
    const reader = await makeUser("Elmur", "bsystems_admin");
    const lead = await makeLead({ name: "Shared Signal" });

    expect((await press("bs-lead", presser, lead.id)).status).toBe(200);

    /* the reader is a different account on a different role, reading through
       the path every surface uses — and sees the mark Omar left */
    authMock.mockResolvedValue({ user: { id: reader.id } });
    const { lead: seen } = await getLeadDetail("bsystems", lead.id);
    expect(seen.whatsappSentAt).not.toBeNull();
    expect(seen.whatsappSentByLabel).toBe("Omar Farouk");

    /* and nothing about the mark is keyed to a viewer: there is no second row
       anywhere, only the one record */
    const marked = await db.lead.findMany({ where: { whatsappSentAt: { not: null } } });
    expect(marked.map((l) => l.id)).toEqual([lead.id]);
  });

  it("the sentence survives the sender's account being permanently deleted", async () => {
    const leaver = await makeUser("Leaver", "bsystems_admin");
    const admin = await makeUser("Remaining Admin", "bsystems_admin");
    const lead = await makeLead({ name: "Sender Deleted" });
    expect((await press("bs-lead", leaver, lead.id)).status).toBe(200);

    await deleteUser(leaver.id, { id: admin.id, label: admin.name });

    const mark = await markOf(lead.id);
    expect(mark.whatsappSentById).toBeNull(); // the FK released (SET NULL)
    expect(mark.whatsappSentByLabel).toBe("Leaver"); // the words did not
    expect(mark.whatsappSentAt).not.toBeNull();
  });
});

describe("backup carries the mark", () => {
  it("export → wipe → import restores who and when, on both record kinds", async () => {
    const admin = await makeUser("Backup Admin", "bsystems_admin");
    const lead = await makeLead({ name: "Backed Up" });
    const prospect = await makeProspect("Backed Up Agent");
    expect((await press("bs-lead", admin, lead.id)).status).toBe(200);
    expect((await press("prospect", admin, prospect.id)).status).toBe(200);

    const before = await markOf(lead.id);
    const payload = await exportBackup();
    await importBackup(payload, { id: null, label: "Restore" });

    expect(await markOf(lead.id)).toEqual(before);
    const p = await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(p.whatsappSentByLabel).toBe("Backup Admin");
    expect(p.whatsappSentAt).not.toBeNull();
  });

  it("a PRE-ADR-069 backup restores as 'never messaged', inventing no diligence", async () => {
    const lead = await makeLead({ name: "Legacy Row" });
    const payload = await exportBackup();
    /* the shape an export taken before today really has: no such keys at all */
    for (const row of payload.tables["lead"]!) {
      delete row["whatsappSentAt"];
      delete row["whatsappSentById"];
      delete row["whatsappSentByLabel"];
    }
    await importBackup(payload, { id: null, label: "Restore" });

    expect(await markOf(lead.id)).toEqual({
      whatsappSentAt: null,
      whatsappSentById: null,
      whatsappSentByLabel: null,
    });
  });
});

describe("the mark is a SIDE EFFECT — it disturbs nothing else on the record", () => {
  it("leaves updatedAt alone, so a pending Undo still applies and the card keeps its place", async () => {
    const omar = await makeUser("Undo Omar", "bsystems_admin");
    const lead = await makeLead({ name: "Undo Probe" });
    /* something undoable, first: the founder flags the lead as no-answer and
       the header offers him "Undo" for ten minutes */
    await setNoAnswer("bsystems", lead.id, true, { id: omar.id, label: omar.name });
    const before = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(await pendingUndoFor(omar.id)).not.toBeNull();

    /* …then he opens WhatsApp. Prisma applies `@updatedAt` CLIENT-side, so an
       `updateMany` here would stamp `updatedAt = now()` (backup.ts's
       `normaliseProspectStages` writes raw for exactly this reason) — which
       would break undo's integrity FINGERPRINT and re-sort the card to the top
       of its column on a board that orders by `updatedAt desc`. */
    expect((await press("bs-lead", omar, lead.id)).status).toBe(200);

    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.whatsappSentAt).not.toBeNull();
    expect(after.updatedAt).toEqual(before.updatedAt);
    /* the raw write must still store UTC. `whatsappSentAt` is TIMESTAMP(3)
       WITHOUT time zone, so a driver that bound the Date in LOCAL time would
       silently shift it by the Cairo offset — and nothing else in this file
       would notice, because every other assertion only asks whether it is set. */
    expect(Math.abs(after.whatsappSentAt!.getTime() - Date.now())).toBeLessThan(60_000);

    /* the pill still points at a LIVE action: it applies, rather than 409-ing
       for ever on a fingerprint the WhatsApp press invalidated */
    expect(await pendingUndoFor(omar.id)).not.toBeNull();
    await performUndo({ id: omar.id, label: omar.name });
    const undone = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(undone.noAnswer).toBe(false);
    expect(undone.noAnswerCount).toBe(0);
    /* and the inverse put back only what it snapshotted — the mark survives it */
    expect(undone.whatsappSentAt).not.toBeNull();
    expect(undone.whatsappSentByLabel).toBe("Undo Omar");
  });

  it("the partner/agent card's mark leaves its updatedAt alone too", async () => {
    const admin = await makeUser("Order Keeping Admin", "bsystems_admin");
    const prospect = await makeProspect("Order Keeper");
    const before = await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } });

    expect((await press("prospect", admin, prospect.id)).status).toBe(200);

    const after = await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(after.whatsappSentAt).not.toBeNull();
    expect(after.whatsappSentByLabel).toBe("Order Keeping Admin");
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(Math.abs(after.whatsappSentAt!.getTime() - Date.now())).toBeLessThan(60_000);
  });
});
