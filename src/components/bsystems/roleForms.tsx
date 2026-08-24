"use client";

import { useState } from "react";
import { FOLLOW_UP_METHODS, MEETING_MODES } from "@/lib/pipeline-engine/constants";
import { toPiasters } from "@/lib/money";
import { inputCls, labelCls } from "@/components/portal/groupForms";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { common, stageForm as msg } from "@/lib/i18n/dict/crm";
import { optionalLabel } from "@/lib/i18n/dict/labels";

/* V2 §3/§4 — the role-aware stage forms for the unified B-Systems pipeline.
   `light` = agent/partner variants (no owner/with, the meeting Q&A flow).
   Admin/sales get the ByteForce-style full forms. Founder (ADR-061): follow-ups
   are DATE-only for EVERY role now — what used to be the light form's privilege
   ("no time on follow-ups") is the only behavior; meetings keep their time. */

export type BsFormRole = "admin" | "sales" | "agent" | "partner";
export const isLight = (r: BsFormRole) => r === "agent" || r === "partner";

type Rep = { id: string; name: string };

export function FollowUpFieldsV2({ light, reps }: { light: boolean; reps: Rep[] }) {
  const locale = useLocale();
  const t = tFor(locale);
  return (
    <>
      {/* founder (ADR-063): "let's get the time back for the follow up but it's
          not mandtory" — for EVERY role, light forms included. The day is
          required, the time is an extra; blank keeps the ADR-061 behaviour
          exactly (09:00 Cairo server-side, date-only everywhere). */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(msg.followUpDate)}</span>
          <input type="date" name="date" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{optionalLabel(locale, msg.followUpTime)}</span>
          <input type="time" name="time" className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(msg.method)}</span>
        <select name="method" required className={inputCls}>
          {FOLLOW_UP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m === "call" ? t(msg.methodCall) : m === "message" ? t(msg.methodMessage) : t(msg.methodVisit)}
            </option>
          ))}
        </select>
      </label>
      {!light ? (
        <>
          <label className="block">
            <span className={labelCls}>{t(common.owner)}</span>
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
            <span className={labelCls}>{t(msg.followingUpWith)}</span>
            <input type="text" name="followingUpWith" className={inputCls} placeholder={t(msg.contactPerson)} />
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
      /* ADR-063 — an untouched time input must send NO key: a bare
         String(fd.get("time")) is the literal "null" and 400s the submit. */
      date: String(fd.get("date")),
      time: String(fd.get("time") || "") || undefined,
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
  lockArranged = false,
}: {
  light: boolean;
  reps: Rep[];
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  /** founder reschedule: the new slot IS agreed — the question is not asked */
  lockArranged?: boolean;
}) {
  const t = tFor(useLocale());
  return (
    <>
      {!lockArranged ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span className="field-label">
            {light ? t(msg.agreedQuestion) : t(msg.arranged)}
          </span>
        </label>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{agreed ? t(msg.date) : t(msg.dateThatSuits)}</span>
          <input type="date" name="date" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{agreed ? t(msg.time) : t(msg.timeThatSuits)}</span>
          <input type="time" name="time" required className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(msg.mode)}</span>
        <select name="mode" required className={inputCls}>
          {MEETING_MODES.map((m) => (
            <option key={m} value={m}>
              {m === "online" ? t(msg.online) : t(msg.offline)}
            </option>
          ))}
        </select>
      </label>
      {light ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needsTechnical" />
          <span className="field-label">{t(msg.needsTechnical)}</span>
        </label>
      ) : (
        <>
          <label className="block">
            <span className={labelCls}>{t(msg.withLabel)}</span>
            <input type="text" name="withAttendees" className={inputCls} placeholder={t(msg.attendees)} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(msg.technicalSupport)}</span>
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
  const t = tFor(useLocale());
  return (
    <>
      <label className="block">
        <span className={labelCls}>{t(msg.service)}</span>
        <input type="text" name="service" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(msg.estimatedValue)}</span>
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
  const t = tFor(useLocale());
  return (
    <label className="block">
      <span className={labelCls}>{t(msg.negotiationNote)}</span>
      <textarea name="note" required rows={3} className={inputCls} placeholder={t(msg.negotiationPlaceholder)} />
    </label>
  );
}

export function LostFieldsV2() {
  const t = tFor(useLocale());
  return (
    <label className="block">
      <span className={labelCls}>{t(msg.lostReason)}</span>
      <textarea name="reason" required rows={3} className={inputCls} />
    </label>
  );
}

/* V2 §4 — the confirm-win milestone tab (admin/sales). Live math (founder):
   milestone values must total the estimated value, commissions must total the
   commission %, milestones must be chronological — the summary updates as you
   type and the server refuses incoherent numbers. */
export function WonDealTab({
  count,
  setCount,
}: {
  count: number;
  setCount: (n: number) => void;
}) {
  const t = tFor(useLocale());
  const [sums, setSums] = useState<{
    estimated: number;
    values: number;
    expectedCommission: number;
    commissions: number;
  } | null>(null);

  function recalc(el: HTMLElement | null) {
    const form = el?.closest("form");
    if (!form) return;
    const fd = new FormData(form);
    const estimated = Number(fd.get("estimatedValue") || 0);
    const percent = Number(fd.get("totalCommissionPercent") || 0);
    let values = 0;
    let commissions = 0;
    for (let i = 0; i < count; i++) {
      values += Number(fd.get(`m${i}value`) || 0);
      commissions += Number(fd.get(`m${i}commission`) || 0);
    }
    setSums({
      estimated,
      values,
      expectedCommission: (estimated * percent) / 100,
      commissions,
    });
  }

  const fmt = (n: number) => `EGP ${n.toLocaleString("en-EG")}`;
  const valuesOk = sums ? sums.values === sums.estimated : true;
  const commissionsOk = sums ? Math.abs(sums.commissions - sums.expectedCommission) <= 1 : true;

  return (
    <div className="contents" onInput={(e) => recalc(e.target as HTMLElement)}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(msg.estimatedValue)}</span>
          <input type="number" name="estimatedValue" min="0" step="0.01" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(msg.totalCommission)}</span>
          <input type="number" name="totalCommissionPercent" min="0" max="100" step="0.01" required className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(msg.contractDate)}</span>
          <input type="date" name="contractDate" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(msg.milestoneCount)}</span>
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
          <div key={i} className="record-group grid grid-cols-2 gap-2">
            <p className="col-span-2 record-title">{t(msg.milestoneN).replace("{n}", String(i + 1))}</p>
            <label className="block col-span-2">
              <span className={labelCls}>{t(common.name)}</span>
              <input type="text" name={`m${i}label`} placeholder={t(msg.milestoneN).replace("{n}", String(i + 1))} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>{t(msg.valueEgp)}</span>
              <input type="number" name={`m${i}value`} min="0" step="0.01" required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>{t(msg.closerCommission)}</span>
              <input type="number" name={`m${i}commission`} min="0" step="0.01" required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>{t(msg.expectedStart)}</span>
              <input type="date" name={`m${i}start`} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>{t(msg.expectedEnd)}</span>
              <input type="date" name={`m${i}end`} className={inputCls} />
            </label>
          </div>
        ))}
      </div>
      {sums ? (
        <div className="record-group text-sm space-y-1">
          <p className={valuesOk ? "" : "text-brand-danger"}>
            {t(msg.milestoneValuesLine)
              .replace("{a}", fmt(sums.values))
              .replace("{b}", fmt(sums.estimated))}
            {valuesOk ? " ✓" : t(msg.mustMatchEstimated)}
          </p>
          <p className={commissionsOk ? "" : "text-brand-danger"}>
            {t(msg.commissionsLine)
              .replace("{a}", fmt(sums.commissions))
              .replace("{b}", fmt(sums.expectedCommission))}
            {commissionsOk ? " ✓" : t(msg.mustMatchCommission)}
          </p>
        </div>
      ) : null}
    </div>
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
  lockArranged = false,
  milestoneCount,
  setMilestoneCount,
}: {
  target: string;
  role: BsFormRole;
  reps: Rep[];
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  lockArranged?: boolean;
  milestoneCount: number;
  setMilestoneCount: (n: number) => void;
}) {
  const t = tFor(useLocale());
  const light = isLight(role);
  if (target === "following_up") return <FollowUpFieldsV2 light={light} reps={reps} />;
  if (target === "meeting_setting")
    return (
      <MeetingFieldsV2
        light={light}
        reps={reps}
        agreed={agreed}
        setAgreed={setAgreed}
        lockArranged={lockArranged}
      />
    );
  if (target === "sending_proposal") return <ProposalFieldsV2 />;
  if (target === "negotiation") return <NegotiationFields />;
  if (target === "lost") return <LostFieldsV2 />;
  if (target === "won") return <WonDealTab count={milestoneCount} setCount={setMilestoneCount} />;
  if (target === "new")
    return <p className="u-muted">{t(msg.backToNew)}</p>;
  return null;
}

/* small state hook shared by board modal + detail panel */
export function useGroupFormState() {
  const [agreed, setAgreed] = useState(true);
  const [milestoneCount, setMilestoneCount] = useState(3);
  return { agreed, setAgreed, milestoneCount, setMilestoneCount };
}
