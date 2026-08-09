"use client";

import { FOLLOW_UP_METHODS, MEETING_MODES } from "@/lib/pipeline-engine/constants";
import { toPiasters } from "@/lib/money";

/* §8.2 — portal stage group forms ("the same shapes" as §6.2). The follow-up
   Owner is the deal's rep, stamped SERVER-SIDE in applyDealEvent (ADR-026) —
   no owner select renders here and no owner id leaves the client. */

/* Design-system form/button classes (spec §2.8/§2.9) — single source for every
   client form; the classes live token-driven in src/themes/design-system.css. */
export const inputCls = "field-input";
export const labelCls = "field-label block mb-1.5";
export const btnPrimary = "btn-primary";
export const btnAccent = "btn-accent";
export const btnGhost = "btn-ghost";

export function FollowUpFields() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Follow-up date</span>
          <input type="date" name="date" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Follow-up time</span>
          <input type="time" name="time" required className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Method</span>
        <select name="method" required className={inputCls}>
          {FOLLOW_UP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m === "call" ? "Call" : m === "message" ? "Message" : "Visit"}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Following up with</span>
        <input type="text" name="followingUpWith" className={inputCls} placeholder="Contact person" />
      </label>
    </>
  );
}

export function MeetingFields({
  arranged,
  setArranged,
}: {
  arranged: boolean;
  setArranged: (v: boolean) => void;
}) {
  return (
    <>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={arranged} onChange={(e) => setArranged(e.target.checked)} />
        <span className="text-sm font-medium">Arranged?</span>
      </label>
      {arranged ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Date</span>
              <input type="date" name="date" required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Time</span>
              <input type="time" name="time" required className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Mode</span>
            <select name="mode" required className={inputCls}>
              {MEETING_MODES.map((m) => (
                <option key={m} value={m}>
                  {m === "online" ? "Online" : "Offline"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>With</span>
            <input type="text" name="withAttendees" className={inputCls} placeholder="Attendees" />
          </label>
          <label className="block">
            <span className={labelCls}>Technical support</span>
            <input type="text" name="technicalSupport" className={inputCls} />
          </label>
        </>
      ) : null}
    </>
  );
}

export function ProposalFields() {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Service</span>
        <input type="text" name="service" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Estimated value (EGP)</span>
        <input type="number" name="estimatedValue" min="0" step="0.01" className={inputCls} />
      </label>
      <p className="text-xs text-brand-muted">
        Save the proposal, then use “Mark as sent” — sending moves the card automatically.
      </p>
    </>
  );
}

export function LostFields() {
  return (
    <label className="block">
      <span className={labelCls}>Reason (required)</span>
      <textarea name="reason" required rows={3} className={inputCls} />
    </label>
  );
}

/* form-data → group payload builders */

export function followUpFromForm(fd: FormData) {
  return {
    group: "follow_up" as const,
    data: {
      date: String(fd.get("date")),
      time: String(fd.get("time")),
      method: String(fd.get("method")) as "call" | "message" | "visit",
      followingUpWith: String(fd.get("followingUpWith") || "") || undefined,
    },
  };
}

export function meetingFromForm(fd: FormData, arranged: boolean) {
  return {
    group: "meeting" as const,
    data: {
      arranged,
      date: arranged ? String(fd.get("date")) : undefined,
      time: arranged ? String(fd.get("time")) : undefined,
      mode: arranged ? (String(fd.get("mode")) as "online" | "offline") : undefined,
      withAttendees: String(fd.get("withAttendees") || "") || undefined,
      technicalSupport: String(fd.get("technicalSupport") || "") || undefined,
    },
  };
}

export function proposalFromForm(fd: FormData) {
  const raw = String(fd.get("estimatedValue") || "");
  return {
    group: "proposal" as const,
    data: {
      service: String(fd.get("service")),
      estimatedValue: raw ? toPiasters(raw) : undefined,
      sent: false,
    },
  };
}

export function lostFromForm(fd: FormData) {
  return { group: "lost" as const, data: { reason: String(fd.get("reason")) } };
}

/** The form fields + payload for a drop/action into a target portal stage. */
export function groupForPortalStage(
  target: string,
  fd: FormData,
  opts: { arranged: boolean },
) {
  if (target === "following_up") return followUpFromForm(fd);
  if (target === "meeting_setting") return meetingFromForm(fd, opts.arranged);
  if (target === "proposal_sending") return proposalFromForm(fd);
  if (target === "lost") return lostFromForm(fd);
  return undefined; // leads / won (admin) — no group
}
