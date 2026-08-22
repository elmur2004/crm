"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOLLOW_UP_METHODS,
  MEETING_MODES,
  SAME_STAGE_FORM_TARGET,
  isSameStageAction,
} from "@/lib/pipeline-engine/constants";
import { internalCrmConfig } from "@/lib/pipeline-engine/configs/internal-crm";
import { toPiasters, toPounds } from "@/lib/money";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { sameStageActionLabel, stageLabel } from "@/lib/i18n/dict/labels";
import { common, events } from "@/lib/i18n/dict/internal";

/* §6.1/§6.2 — selecting a Next Action opens exactly that stage's field group right
   here; submitting fires ONE mutation (event + group payload). Cancel = nothing
   happened. Meeting outcomes and proposal-sent are separate §5.3 events surfaced
   contextually. Brand-agnostic: Apps A & B pass their own apiBase. */

type Rep = { id: string; name: string };

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";
const btnPrimary = "btn-primary";
const btnGhost = "btn-ghost";

export function FollowUpFields({ reps }: { reps: Rep[] }) {
  const t = tFor(useLocale());
  return (
    <>
      {/* founder: "remove the time of the follow up just the date" — a follow-up
          is a DAY. No time input anywhere; the stored instant defaults to 09:00
          Cairo server-side (followUpDueAt, ADR-061). Meetings keep their time. */}
      <label className="block">
        <span className={labelCls}>{t(events.followUpDate)}</span>
        <input type="date" name="date" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(events.method)}</span>
        <select name="method" required className={inputCls}>
          {FOLLOW_UP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m === "call" ? t(common.call) : m === "message" ? t(common.message) : t(common.visit)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>{t(events.owner)}</span>
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
        <span className={labelCls}>{t(events.followingUpWith)}</span>
        <input type="text" name="followingUpWith" className={inputCls} placeholder={t(events.contactPerson)} />
      </label>
    </>
  );
}

export function followUpFromForm(fd: FormData) {
  return {
    group: "follow_up" as const,
    data: {
      /* no `time` — the server defaults the slot to 09:00 Cairo (ADR-061) */
      date: String(fd.get("date")),
      method: String(fd.get("method")) as "call" | "message" | "visit",
      ownerSalesRepId: String(fd.get("ownerSalesRepId") || "") || undefined,
      followingUpWith: String(fd.get("followingUpWith") || "") || undefined,
    },
  };
}

export function MeetingFields({ arranged, setArranged, reps }: { arranged: boolean; setArranged: (v: boolean) => void; reps: Rep[] }) {
  const t = tFor(useLocale());
  return (
    <>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="arranged"
          checked={arranged}
          onChange={(e) => setArranged(e.target.checked)}
        />
        <span className="text-sm font-medium">{t(events.arranged)}</span>
      </label>
      {arranged ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>{t(events.date)}</span>
              <input type="date" name="date" required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>{t(events.time)}</span>
              <input type="time" name="time" required className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>{t(events.mode)}</span>
            <select name="mode" required className={inputCls}>
              {MEETING_MODES.map((m) => (
                <option key={m} value={m}>
                  {m === "online" ? t(common.online) : t(common.offline)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>{t(events.withLabel)}</span>
            <input type="text" name="withAttendees" className={inputCls} placeholder={t(events.attendees)} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(events.technicalSupport)}</span>
            <input
              type="text"
              name="technicalSupport"
              list="rep-names"
              className={inputCls}
              placeholder={t(events.nameOrRep)}
            />
            <datalist id="rep-names">
              {reps.map((r) => (
                <option key={r.id} value={r.name} />
              ))}
            </datalist>
          </label>
        </>
      ) : null}
    </>
  );
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

export function ProposalFields() {
  const t = tFor(useLocale());
  return (
    <>
      <label className="block">
        <span className={labelCls}>{t(common.service)}</span>
        <input type="text" name="service" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(events.estimatedValueEgp)}</span>
        <input type="number" name="estimatedValue" min="0" step="0.01" className={inputCls} />
      </label>
      <p className="field-hint">
        {t(events.proposalHint)}
      </p>
    </>
  );
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

export function LostFields() {
  const t = tFor(useLocale());
  return (
    <label className="block">
      <span className={labelCls}>{t(events.reasonRequired)}</span>
      <textarea name="reason" required rows={3} className={inputCls} />
    </label>
  );
}

export function WonFields({ prefillValue }: { prefillValue: number | null }) {
  const t = tFor(useLocale());
  return (
    <>
      <label className="block">
        <span className={labelCls}>{t(events.estimatedValueEgp)}</span>
        <input
          type="number"
          name="estimatedValue"
          min="0"
          step="0.01"
          required
          defaultValue={prefillValue != null ? toPounds(prefillValue) : undefined}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>{t(common.technicalOwner)}</span>
        <input type="text" name="technicalOwner" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(events.collectedAmountEgp)}</span>
        <input type="number" name="collectedAmount" min="0" step="0.01" required className={inputCls} />
      </label>
    </>
  );
}

export function wonFromForm(fd: FormData) {
  return {
    group: "won" as const,
    data: {
      estimatedValue: toPiasters(String(fd.get("estimatedValue"))),
      technicalOwner: String(fd.get("technicalOwner")),
      collectedAmount: toPiasters(String(fd.get("collectedAmount"))),
    },
  };
}

export function LeadEventPanel({
  apiBase,
  leadId,
  stage,
  reps,
  latestProposalValue,
  hasUnsentProposal,
  pendingMeeting,
}: {
  apiBase: string;
  leadId: string;
  stage: string;
  reps: Rep[];
  latestProposalValue: number | null;
  hasUnsentProposal: boolean;
  pendingMeeting: boolean; // latest meeting exists with no outcome
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
  const [action, setAction] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [arranged, setArranged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* All stage/action sets come from the engine config — never hardcoded (§5.1).
     The role argument is inert for internal pipelines (both staff roles get the
     same sets); the server revalidates with the true role on every event. */
  const terminal = internalCrmConfig.terminalStages.includes(stage);
  const nextActions = internalCrmConfig.nextActions(stage, "byteforce_staff");
  /* founder: same-stage records are buttons — the card does not move. */
  const sameStageActions = nextActions.filter(isSameStageAction);
  const stageActions = nextActions.filter((a) => !isSameStageAction(a));
  const formTarget = (a: string) => (isSameStageAction(a) ? SAME_STAGE_FORM_TARGET[a] : a);
  const attendedDestinations = internalCrmConfig.attendedDestinations("byteforce_staff");
  /* ADR-059: the engine owns the cancelled-meeting destinations now — the UI
     asks instead of composing the pair itself. Same answer as before here. */
  const cancelledDestinations = internalCrmConfig.cancelledDestinations("byteforce_staff");

  async function submit(body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(`${apiBase}/leads/${leadId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t(common.somethingWentWrong));
      return;
    }
    setAction("");
    setOutcome("");
    setDestination("");
    router.refresh();
  }

  function groupForTarget(target: string, fd: FormData) {
    if (target === "following_up") return followUpFromForm(fd);
    if (target === "meeting_setting") return meetingFromForm(fd, arranged);
    if (target === "sending_proposal") return proposalFromForm(fd);
    if (target === "lost") return { group: "lost" as const, data: { reason: String(fd.get("reason")) } };
    if (target === "won") return wonFromForm(fd);
    return undefined;
  }

  function fieldsForTarget(target: string) {
    if (target === "following_up") return <FollowUpFields reps={reps} />;
    if (target === "meeting_setting")
      return <MeetingFields arranged={arranged} setArranged={setArranged} reps={reps} />;
    if (target === "sending_proposal") return <ProposalFields />;
    if (target === "lost") return <LostFields />;
    if (target === "won") return <WonFields prefillValue={latestProposalValue} />;
    return null;
  }

  if (terminal) {
    return (
      <p className="empty">
        {t(events.terminalPrefix)} {stageLabel(locale, stage)} {t(events.terminalSuffix)}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="alert-error">
          {error}
        </p>
      ) : null}

      {/* §5.3: contextual auto-events for the current stage */}
      {stage === "sending_proposal" && hasUnsentProposal ? (
        <div className="border border-brand-border rounded-brand-card p-4 bg-brand-surface-tint">
          <p className="u-h3 mb-2">{t(events.proposalReady)}</p>
          <p className="field-hint mb-3">
            {t(events.sendingMoves)}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit({
                event: { type: "proposal_sent" },
                group: followUpFromForm(new FormData(e.currentTarget)),
              });
            }}
            className="space-y-3"
          >
            <p className="u-h3">{t(events.followingUpAfterProposal)}</p>
            <FollowUpFields reps={reps} />
            <button type="submit" disabled={busy} className={btnPrimary}>
              {t(events.sentMoveToFollowingUp)}
            </button>
          </form>
        </div>
      ) : null}

      {stage === "meeting_setting" && pendingMeeting ? (
        <div className="border border-brand-border rounded-brand-card p-4 bg-brand-surface-tint">
          <p className="u-h3 mb-2">{t(events.meetingOutcome)}</p>
          <select aria-label={t(events.meetingOutcome)} value={outcome} onChange={(e) => { setOutcome(e.target.value); setDestination(""); }} className={inputCls}>
            <option value="">{t(events.chooseOutcome)}</option>
            <option value="attended">{t(events.attended)}</option>
            <option value="cancelled">{t(events.cancelled)}</option>
            <option value="delayed">{t(events.delayed)}</option>
          </select>

          {outcome === "delayed" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                void submit({
                  event: { type: "meeting_outcome", outcome: "delayed" },
                  group: {
                    group: "meeting_reschedule",
                    data: { date: String(fd.get("date")), time: String(fd.get("time")) },
                  },
                });
              }}
              className="space-y-3 mt-3"
            >
              <p className="field-hint">{t(events.delayedSetNew)}</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" name="date" required className={inputCls} />
                <input type="time" name="time" required className={inputCls} />
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {t(events.saveNewDate)}
              </button>
            </form>
          ) : null}

          {outcome === "attended" || outcome === "cancelled" ? (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className={labelCls}>
                  {outcome === "attended" ? t(events.whereNext) : t(events.cancelledFollowUpOrLost)}
                </span>
                <select
                  aria-label={t(events.destination)}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t(events.choose)}</option>
                  {(outcome === "attended" ? attendedDestinations : cancelledDestinations).map((d) => (
                    <option key={d} value={d}>
                      {stageLabel(locale, d)}
                    </option>
                  ))}
                </select>
              </label>
              {destination ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit({
                      event: { type: "meeting_outcome", outcome, destination },
                      group: groupForTarget(destination, new FormData(e.currentTarget)),
                    });
                  }}
                  className="space-y-3"
                >
                  {fieldsForTarget(destination)}
                  <button type="submit" disabled={busy} className={btnPrimary}>
                    {t(events.confirmMoveTo)} {stageLabel(locale, destination)}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* founder: "a button inside the lead" — another follow-up while still
          Following Up, a rescheduled meeting while still Meeting Setting. */}
      {sameStageActions.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {sameStageActions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                /* a reschedule always records an ARRANGED meeting */
                if (a === "reschedule_meeting") setArranged(true);
                setAction(a);
              }}
              className={btnGhost}
            >
              {sameStageActionLabel(locale, a)}
            </button>
          ))}
        </div>
      ) : null}

      {/* §6.1 Next action */}
      <div>
        <label className="block">
          <span className={labelCls}>{t(events.nextAction)}</span>
          <select
            value={isSameStageAction(action) ? "" : action}
            onChange={(e) => setAction(e.target.value)}
            className={inputCls}
          >
            <option value="">{t(events.chooseNextAction)}</option>
            {stageActions.map((a) => (
              <option key={a} value={a}>
                {stageLabel(locale, a)}
              </option>
            ))}
          </select>
        </label>

        {action ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit({
                event: { type: "next_action", action },
                group: groupForTarget(formTarget(action), new FormData(e.currentTarget)),
              });
            }}
            className="card card-pad mt-3 space-y-3"
          >
            <p className="u-h3">
              {isSameStageAction(action)
                ? sameStageActionLabel(locale, action)
                : stageLabel(locale, action)}
            </p>
            {fieldsForTarget(formTarget(action))}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {isSameStageAction(action) ? t(events.saveRecord) : t(events.saveAndMove)}
              </button>
              <button type="button" onClick={() => setAction("")} className={btnGhost}>
                {t(common.cancel)}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
