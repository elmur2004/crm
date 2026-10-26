import { describe, expect, it } from "vitest";
import { meetingFromForm } from "./LeadEventPanel";
import { meetingPayload } from "@/components/bsystems/roleForms";
import { meetingSchema } from "@/lib/services/groups";

/* ADR-096 — the founder, on the "Arranged?" checkbox that opened the meeting
   form: "شيل الخطوة دي ملهاش اي معنى خش في المعاد علطول" (remove this step — go
   straight to the appointment), and "شيل برضو ال technical support". These pin
   what the forms now SEND, so the step cannot quietly come back. */

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  /* a stale field a browser might still post must not be forwarded */
  fd.append("technicalSupport", "Somebody");
  return fd;
}

const MEETING = { date: "2026-11-02", time: "14:30", mode: "online", withAttendees: "Their CFO" };

describe("the ByteForce meeting form (ADR-096)", () => {
  it("always records an ARRANGED meeting, with no Technical support", () => {
    const payload = meetingFromForm(form(MEETING));
    expect(payload.data).toEqual({
      arranged: true,
      date: "2026-11-02",
      time: "14:30",
      mode: "online",
      withAttendees: "Their CFO",
    });
    expect(meetingSchema.safeParse(payload.data).success).toBe(true);
  });
});

describe("the B-Systems meeting form (ADR-096)", () => {
  it("internal roles (admin, sales) always set the AGREED meeting, whatever the old toggle said", () => {
    const payload = meetingPayload(form(MEETING), false, false);
    expect(payload.data.arranged).toBe(true);
    expect("technicalSupport" in payload.data).toBe(false);
    expect(meetingSchema.safeParse(payload.data).success).toBe(true);
  });

  it("the agent/partner flow keeps its own question: an unagreed answer is a PROPOSED slot", () => {
    expect(meetingPayload(form(MEETING), true, false).data.arranged).toBe(false);
    expect(meetingPayload(form(MEETING), true, true).data.arranged).toBe(true);
  });
});
