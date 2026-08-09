"use client";

import { useState } from "react";
import { FOLLOW_UP_METHODS, MEETING_MODES } from "@/lib/pipeline-engine/constants";
import { toPiasters } from "@/lib/money";
import { inputCls, labelCls } from "@/components/portal/groupForms";

/* V2 §3/§4 — the role-aware stage forms for the unified B-Systems pipeline.
   `light` = agent/partner variants (no time on follow-ups, no owner/with, the
   meeting Q&A flow). Admin/sales get the ByteForce-style full forms. */

export type BsFormRole = "admin" | "sales" | "agent" | "partner";
export const isLight = (r: BsFormRole) => r === "agent" || r === "partner";

type Rep = { id: string; name: string };

export function FollowUpFieldsV2({ light, reps }: { light: boolean; reps: Rep[] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Follow-up date</span>
          <input type="date" name="date" required className={inputCls} />
        </label>
        {!light ? (
          <label className="block">
            <span className={labelCls}>Follow-up time</span>
            <input type="time" name="time" required className={inputCls} />
          </label>
        ) : null}
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
      {!light ? (
        <>
          <label className="block">
            <span className={labelCls}>Owner</span>
            <select name="ownerSalesRepId" className={inputCls}>
              <option value="">—</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Following up with</span>
            <input type="text" name="followingUpWith" className={inputCls} placeholder="Contact person" />
          </label>
        </>
      ) : null}
    </>
  );
}

export function followUpPayload(fd: FormData, light: boolean) {
  return {
    group: "follow_up" as const,
    data: {
      date: String(fd.get("date")),
      time: light ? undefined : String(fd.get("time")),
      method: String(fd.get("method")) as "call" | "message" | "visit",
      ownerSalesRepId: light ? undefined : String(fd.get("ownerSalesRepId") || "") || undefined,
      followingUpWith: light ? undefined : String(fd.get("followingUpWith") || "") || undefined,
    },
  };
}

/* Agent meeting flow (V2 §3): "Did you agree with the client on a time?" */
export function MeetingFieldsV2({
  light,
  reps,
  agreed,
  setAgreed,
}: {
  light: boolean;
  reps: Rep[];
  agreed: boolean;
  setAgreed: (v: boolean) => void;
}) {
  return (
    <>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span className="text-sm font-medium">
          {light ? "Did you agree with the client on a time?" : "Arranged?"}
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{agreed ? "Date" : "Date that suits you"}</span>
          <input type="date" name="date" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{agreed ? "Time" : "Time that suits you"}</span>
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
      {light ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needsTechnical" />
          <span className="text-sm font-medium">Do you need a technical colleague with you?</span>
        </label>
      ) : (
        <>
          <label className="block">
            <span className={labelCls}>With</span>
            <input type="text" name="withAttendees" className={inputCls} placeholder="Attendees" />
          </label>
          <label className="block">
            <span className={labelCls}>Technical support</span>
            <input type="text" name="technicalSupport" list="bs-rep-names" className={inputCls} />
            <datalist id="bs-rep-names">
              {reps.map((r) => (
                <option key={r.id} value={r.name} />
              ))}
            </datalist>
          </label>
        </>
      )}
    </>
  );
}

export function meetingPayload(fd: FormData, light: boolean, agreed: boolean) {
  return {
    group: "meeting" as const,
    data: {
      arranged: agreed,
      date: String(fd.get("date")),
      time: String(fd.get("time")),
      mode: String(fd.get("mode")) as "online" | "offline",
      withAttendees: light ? undefined : String(fd.get("withAttendees") || "") || undefined,
      technicalSupport: light ? undefined : String(fd.get("technicalSupport") || "") || undefined,
      needsTechnical: light ? fd.get("needsTechnical") === "on" : undefined,
    },
  };
}

export function ProposalFieldsV2() {
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
    </>
  );
}

export function proposalPayload(fd: FormData) {
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

export function NegotiationFields() {
  return (
    <label className="block">
      <span className={labelCls}>Negotiation note</span>
      <textarea name="note" required rows={3} className={inputCls} placeholder="What is being negotiated?" />
    </label>
  );
}

export function LostFieldsV2() {
  return (
    <label className="block">
      <span className={labelCls}>Reason (required)</span>
      <textarea name="reason" required rows={3} className={inputCls} />
    </label>
  );
}

/* V2 §4 — the confirm-win milestone tab (admin/sales). */
export function WonDealTab({
  count,
  setCount,
}: {
  count: number;
  setCount: (n: number) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Estimated value (EGP)</span>
          <input type="number" name="estimatedValue" min="0" step="0.01" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Total commission (%)</span>
          <input type="number" name="totalCommissionPercent" min="0" max="100" step="0.01" required className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Contract date</span>
          <input type="date" name="contractDate" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Number of milestones</span>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            className={inputCls}
          />
        </label>
      </div>
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="border border-brand-border rounded-brand-card p-3 grid grid-cols-2 gap-2">
            <p className="col-span-2 text-brand-meta text-brand-muted">Milestone {i + 1}</p>
            <label className="block col-span-2">
              <span className={labelCls}>Name</span>
              <input type="text" name={`m${i}label`} placeholder={`Milestone ${i + 1}`} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Value (EGP)</span>
              <input type="number" name={`m${i}value`} min="0" step="0.01" required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Closer&apos;s commission (EGP)</span>
              <input type="number" name={`m${i}commission`} min="0" step="0.01" required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Expected start</span>
              <input type="date" name={`m${i}start`} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Expected end</span>
              <input type="date" name={`m${i}end`} className={inputCls} />
            </label>
          </div>
        ))}
      </div>
    </>
  );
}

export function wonDealPayload(fd: FormData, count: number) {
  const milestones = Array.from({ length: count }, (_, i) => ({
    label: String(fd.get(`m${i}label`) || "") || undefined,
    value: toPiasters(String(fd.get(`m${i}value`) || "0")),
    commissionValue: toPiasters(String(fd.get(`m${i}commission`) || "0")),
    expectedStart: String(fd.get(`m${i}start`) || "") || undefined,
    expectedEnd: String(fd.get(`m${i}end`) || "") || undefined,
  }));
  return {
    group: "won_deal" as const,
    data: {
      estimatedValue: toPiasters(String(fd.get("estimatedValue") || "0")),
      totalCommissionPercentBp: Math.round(Number(fd.get("totalCommissionPercent") || 0) * 100),
      contractDate: String(fd.get("contractDate") || "") || undefined,
      milestones,
    },
  };
}

/** target stage → payload builder (role-aware). */
export function buildGroupPayload(
  target: string,
  fd: FormData,
  opts: { light: boolean; agreed: boolean; milestoneCount: number },
) {
  if (target === "following_up") return followUpPayload(fd, opts.light);
  if (target === "meeting_setting") return meetingPayload(fd, opts.light, opts.agreed);
  if (target === "sending_proposal") return proposalPayload(fd);
  if (target === "negotiation")
    return { group: "negotiation" as const, data: { note: String(fd.get("note")) } };
  if (target === "lost") return { group: "lost" as const, data: { reason: String(fd.get("reason")) } };
  if (target === "won") return wonDealPayload(fd, opts.milestoneCount);
  return undefined; // intake
}

/** target stage → form body (role-aware). */
export function GroupFieldsV2({
  target,
  role,
  reps,
  agreed,
  setAgreed,
  milestoneCount,
  setMilestoneCount,
}: {
  target: string;
  role: BsFormRole;
  reps: Rep[];
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  milestoneCount: number;
  setMilestoneCount: (n: number) => void;
}) {
  const light = isLight(role);
  if (target === "following_up") return <FollowUpFieldsV2 light={light} reps={reps} />;
  if (target === "meeting_setting")
    return <MeetingFieldsV2 light={light} reps={reps} agreed={agreed} setAgreed={setAgreed} />;
  if (target === "sending_proposal") return <ProposalFieldsV2 />;
  if (target === "negotiation") return <NegotiationFields />;
  if (target === "lost") return <LostFieldsV2 />;
  if (target === "won") return <WonDealTab count={milestoneCount} setCount={setMilestoneCount} />;
  if (target === "new")
    return <p className="text-sm text-brand-muted">The lead returns to the New column.</p>;
  return null;
}

/* small state hook shared by board modal + detail panel */
export function useGroupFormState() {
  const [agreed, setAgreed] = useState(true);
  const [milestoneCount, setMilestoneCount] = useState(3);
  return { agreed, setAgreed, milestoneCount, setMilestoneCount };
}
