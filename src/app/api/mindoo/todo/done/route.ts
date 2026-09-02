import { z } from "zod";
import { handleRoute, requireLeadAccess, requireUser } from "@/lib/auth/guards";
import { leadIdOfTodoRecord, setTodoDone } from "@/lib/services/todo-done";

/* ADR-062 / ADR-073 — Mindoo's To-Do completion marks.

   Only the LEAD-BACKED kinds exist here: statements and milestones are
   B-Systems admin subsystems and `todoFor` never emits them for this company,
   so the schema refuses them rather than relying on that staying true.

   `negotiation_response` IS accepted, and that is the one line where this file
   differs from the ByteForce twin: Mindoo runs the B-Systems pipeline, so it
   HAS a negotiation stage and its To-Do really can emit that row. ByteForce's
   enum stops at two members as a permanent proof that its pipeline has none —
   the same reasoning, reaching the opposite answer.

   Review hardening, inherited: `requireUser` runs BEFORE `leadIdOfTodoRecord`,
   so an anonymous POST is refused without any database work and learns nothing
   about which record ids exist. */
const bodySchema = z.object({
  kind: z.enum(["follow_up", "negotiation_response", "meeting"]),
  recordId: z.string().min(1),
  done: z.boolean(),
});

export const POST = handleRoute(async (req: Request) => {
  const body = bodySchema.parse(await req.json());
  const caller = await requireUser(); // auth first — before any lookup on input
  const { user } = await requireLeadAccess(
    await leadIdOfTodoRecord(body.kind, body.recordId),
    caller,
  );
  await setTodoDone({
    brand: "mindoo",
    kind: body.kind,
    recordId: body.recordId,
    done: body.done,
    actor: { id: user.id, label: user.name },
  });
  return Response.json({ ok: true, done: body.done });
});
