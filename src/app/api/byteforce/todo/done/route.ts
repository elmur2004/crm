import { z } from "zod";
import { handleRoute, requireLeadAccess, requireUser } from "@/lib/auth/guards";
import { leadIdOfTodoRecord, setTodoDone } from "@/lib/services/todo-done";

/* Founder 2.2/2.3 (ADR-062) — the ByteForce twin of /api/b-systems/todo/done.
   Only the lead-backed kinds exist here (statements/milestones are B-Systems
   admin subsystems — todoFor never emits them for this brand, so the schema
   refuses them). requireLeadAccess enforces byteforce_staff for byteforce
   leads; setTodoDone 404s a lead of the other brand — the brand comes from
   the ROUTE, never from input. Review hardening: `requireUser` runs BEFORE
   `leadIdOfTodoRecord`, so an anonymous POST is refused with 401 without any
   database work and learns nothing about which record ids exist. */

/* ADR-068 — and "negotiation_response" is deliberately NOT here either.
   ByteForce's pipeline has no negotiation stage, so its To-Do can never emit
   that row; leaving the enum at two members is a free, permanent proof of it
   rather than a comment somebody has to keep true. */
const bodySchema = z.object({
  kind: z.enum(["follow_up", "meeting"]),
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
    brand: "byteforce",
    kind: body.kind,
    recordId: body.recordId,
    done: body.done,
    actor: { id: user.id, label: user.name },
  });
  return Response.json({ ok: true, done: body.done });
});
