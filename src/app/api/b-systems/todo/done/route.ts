import { z } from "zod";
import { assertRole, handleRoute, requireLeadAccess, requireUser } from "@/lib/auth/guards";
import { leadIdOfTodoRecord, setTodoDone } from "@/lib/services/todo-done";

/* Founder 2.2/2.3 (ADR-062) — check/uncheck one To-Do task. The wall is the
   projection's own, re-derived server-side from the RECORD (never from client
   input): lead-backed kinds pass requireLeadAccess on the record's lead —
   admin any B-Systems lead, sales the internal bucket, agent/partner only
   their own — and the MONEY kinds (statement/milestone) are admin-only, like
   the rows themselves. A prospect-parented record 404s outright (ADR-061).

   Review hardening: AUTHENTICATION COMES FIRST — the house guard-first order.
   These routes are the one shape that must look a record up to find the lead
   it hangs off, so `requireUser` runs before `leadIdOfTodoRecord` touches the
   database: an anonymous POST always gets 401, never a 404/401 split that
   would tell it whether a record id exists. */

const bodySchema = z.object({
  kind: z.enum(["follow_up", "meeting", "statement", "milestone"]),
  recordId: z.string().min(1),
  done: z.boolean(),
});

export const POST = handleRoute(async (req: Request) => {
  const body = bodySchema.parse(await req.json());
  const user = await requireUser(); // auth first — before any lookup on input
  const actor =
    body.kind === "follow_up" || body.kind === "meeting"
      ? (await requireLeadAccess(await leadIdOfTodoRecord(body.kind, body.recordId), user)).user
      : assertRole(user, "bsystems_admin"); // the money kinds, admin-only
  await setTodoDone({
    brand: "bsystems",
    kind: body.kind,
    recordId: body.recordId,
    done: body.done,
    actor: { id: actor.id, label: actor.name },
  });
  return Response.json({ ok: true, done: body.done });
});
