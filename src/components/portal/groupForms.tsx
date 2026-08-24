"use client";

import { FOLLOW_UP_METHODS, MEETING_MODES } from "@/lib/pipeline-engine/constants";
import { toPiasters } from "@/lib/money";
import { useLocale } from "@/components/shared/LocaleProvider";
import { tFor } from "@/lib/i18n/core";
import { stageForms } from "@/lib/i18n/dict/auth";
import { optionalLabel } from "@/lib/i18n/dict/labels";

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
  const locale = useLocale();
  const t = tFor(locale);
  return (
    <>
      {/* founder (ADR-063): "let's get the time back for the follow up but it's
          not mandtory" — the day is required, the time is an extra. Blank keeps
          the ADR-061 behaviour: 09:00 Cairo server-side, rendered date-only. */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(stageForms.followUpDate)}</span>
          <input type="date" name="date" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{optionalLabel(locale, stageForms.followUpTime)}</span>
          <input type="time" name="time" className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(stageForms.method)}</span>
        <select name="method" required className={inputCls}>
          {FOLLOW_UP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m === "call"
                ? t(stageForms.methodCall)
                : m === "message"
                  ? t(stageForms.methodMessage)
                  : t(stageForms.methodVisit)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>{t(stageForms.followingUpWith)}</span>
        <input type="text" name="followingUpWith" className={inputCls} placeholder={t(stageForms.contactPersonPlaceholder)} />
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
  const t = tFor(useLocale());
  return (
    <>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={arranged} onChange={(e) => setArranged(e.target.checked)} />
        <span className="text-sm font-medium">{t(stageForms.arranged)}</span>
      </label>
      {arranged ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>{t(stageForms.date)}</span>
              <input type="date" name="date" required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>{t(stageForms.time)}</span>
              <input type="time" name="time" required className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>{t(stageForms.mode)}</span>
            <select name="mode" required className={inputCls}>
              {MEETING_MODES.map((m) => (
                <option key={m} value={m}>
                  {m === "online" ? t(stageForms.online) : t(stageForms.offline)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>{t(stageForms.withLabel)}</span>
            <input type="text" name="withAttendees" className={inputCls} placeholder={t(stageForms.attendeesPlaceholder)} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(stageForms.technicalSupport)}</span>
            <input type="text" name="technicalSupport" className={inputCls} />
          </label>
        </>
      ) : null}
    </>
  );
}

export function ProposalFields() {
  const t = tFor(useLocale());
  return (
    <>
      <label className="block">
        <span className={labelCls}>{t(stageForms.service)}</span>
        <input type="text" name="service" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(stageForms.estimatedValue)}</span>
        <input type="number" name="estimatedValue" min="0" step="0.01" className={inputCls} />
      </label>
      <p className="text-xs text-brand-muted">{t(stageForms.proposalHint)}</p>
    </>
  );
}

export function LostFields() {
  const t = tFor(useLocale());
  return (
    <label className="block">
      <span className={labelCls}>{t(stageForms.reasonRequired)}</span>
      <textarea name="reason" required rows={3} className={inputCls} />
    </label>
  );
}

/* form-data → group payload builders */

export function followUpFromForm(fd: FormData) {
  return {
    group: "follow_up" as const,
    data: {
      /* ADR-063 — an untouched time input must send NO key: a bare
         String(fd.get("time")) is the literal "null" and 400s the submit. */
      date: String(fd.get("date")),
      time: String(fd.get("time") || "") || undefined,
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
