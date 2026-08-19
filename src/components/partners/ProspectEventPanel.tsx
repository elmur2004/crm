"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOLLOW_UP_METHODS,
  IMPORTANCE_LEVELS,
  MEETING_MODES,
  SAME_STAGE_FORM_SLOT,
  isSameStageAction,
} from "@/lib/pipeline-engine/constants";
import { partnersConfigFor } from "@/lib/pipeline-engine/configs/partners";
import { BusinessActivityField, businessActivityFrom } from "./forms";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { sameStageActionLabel, stageLabel } from "@/lib/i18n/dict/labels";
import {
  followUpMethodLabel,
  importanceOptionLabel,
  meetingModeLabel,
  pCommon,
  pPanel,
} from "@/lib/i18n/dict/partners";
import { fields as authFields, signup } from "@/lib/i18n/dict/auth";

/* §7.2 — the Partners pipeline's action panel. Same one-mutation commit model as
   the internal CRM (ADR-023); Won opens the completeness gate (PP-4); Didn't
   Answer reveals the number slots (PP-1). Every set derives from the CARD'S OWN
   config — ADR-057: an agent card runs `contacted`/`qualified` where a partner
   card runs `following_up`/`won`, so a literal stage key here would offer the
   wrong next actions and render an empty stage form. */

type Rep = { id: string; name: string };

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";
const btnPrimary = "btn-primary";
const btnGhost = "btn-ghost";

function FollowUpFields({ reps }: { reps: Rep[] }) {
  const locale = useLocale();
  const t = tFor(locale);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(pPanel.followUpDate)}</span>
          <input type="date" name="date" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(pPanel.followUpTime)}</span>
          <input type="time" name="time" required className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(pPanel.method)}</span>
        <select name="method" required className={inputCls}>
          {FOLLOW_UP_METHODS.map((m) => (
            <option key={m} value={m}>
              {followUpMethodLabel(locale, m)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>{t(pPanel.owner)}</span>
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
        <span className={labelCls}>{t(pPanel.followingUpWith)}</span>
        <input type="text" name="followingUpWith" className={inputCls} placeholder={t(pPanel.contactPersonPh)} />
      </label>
    </>
  );
}

function WonGateFields({ defaults }: { defaults: ProspectGateDefaults }) {
  const locale = useLocale();
  const t = tFor(locale);
  return (
    <>
      <p className="field-hint">
        {t(pPanel.wonGateHint)}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(pCommon.companyName)}</span>
          <input type="text" name="companyName" required defaultValue={defaults.companyName ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(pCommon.keyPersonName)}</span>
          <input type="text" name="keyPersonName" required defaultValue={defaults.name} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(pCommon.keyPersonRole)}</span>
          <input type="text" name="keyPersonRole" required defaultValue={defaults.role ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(pCommon.number)}</span>
          <input type="tel" name="number" required defaultValue={defaults.number} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(signup.email)}</span>
          <input type="email" name="email" defaultValue={defaults.email ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(authFields.password)}</span>
          <input
            type="text"
            name="password"
            autoComplete="off"
            placeholder={t(pPanel.passwordPh)}
            className={inputCls}
          />
          <span className="field-hint">
            {t(pPanel.passwordHint)}
          </span>
        </label>
        <label className="block">
          <span className={labelCls}>{t(pCommon.importance)}</span>
          <select name="importance" required className={inputCls}>
            {IMPORTANCE_LEVELS.map((i) => (
              <option key={i} value={i}>
                {importanceOptionLabel(locale, i)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(authFields.address)}</span>
        <input type="text" name="address" required className={inputCls} />
      </label>
      <BusinessActivityField defaultValue={defaults.businessActivity ?? undefined} />
    </>
  );
}

/* Founder (PP-4a): the AGENT card's Won gate. The profile half is prefilled
   from the card — the admin only confirms it — and the credential half is the
   admin's to set, because an agent added here never applies for anything. */
function WonAgentGateFields({ defaults }: { defaults: ProspectGateDefaults }) {
  const t = tFor(useLocale());
  const [first = "", ...rest] = defaults.name.trim().split(/\s+/);
  return (
    <>
      <p className="field-hint">{t(pPanel.qualifiedAgentHint)}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(authFields.firstName)}</span>
          <input type="text" name="firstName" required defaultValue={first} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(authFields.lastName)}</span>
          <input type="text" name="lastName" required defaultValue={rest.join(" ")} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(signup.phone)}</span>
          <input type="tel" name="phone" required defaultValue={defaults.number} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(signup.email)}</span>
          <input type="email" name="email" required defaultValue={defaults.email ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(authFields.password)}</span>
          <input
            type="text"
            name="password"
            required
            minLength={8}
            autoComplete="off"
            placeholder={t(pPanel.agentPasswordPh)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t(authFields.speciality)}</span>
          <input
            type="text"
            name="speciality"
            required
            defaultValue={defaults.speciality ?? ""}
            placeholder={t(signup.specialityPlaceholder)}
            className={inputCls}
          />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(authFields.address)}</span>
        <input type="text" name="address" required defaultValue={defaults.address ?? ""} className={inputCls} />
      </label>
    </>
  );
}

/* ---------- shared stage-form builders (panel + draggable board) ---------- */

export type ProspectGateDefaults = {
  /** partner | agent — chosen at creation, fixed afterwards */
  kind: string;
  companyName: string | null;
  name: string;
  role: string | null;
  number: string;
  email: string | null;
  businessActivity: string | null;
  address: string | null;
  speciality: string | null;
};

/** target stage → the group payload harvested from the form (V2 §6 shapes). */
export function prospectGroupPayload(target: string, fd: FormData, kind = "partner") {
  const config = partnersConfigFor(kind);
  if (target === config.followUpStage)
    return {
      group: "follow_up" as const,
      data: {
        date: String(fd.get("date")),
        time: String(fd.get("time")),
        method: String(fd.get("method")) as "call" | "message" | "visit",
        ownerSalesRepId: String(fd.get("ownerSalesRepId") || "") || undefined,
        followingUpWith: String(fd.get("followingUpWith") || "") || undefined,
      },
    };
  if (target === config.meetingStage)
    /* V2 §6 — partners meeting is simplified: date + time + mode only. */
    return {
      group: "meeting" as const,
      data: {
        arranged: true,
        date: String(fd.get("date")),
        time: String(fd.get("time")),
        mode: String(fd.get("mode")) as "online" | "offline",
      },
    };
  if (target === config.lostStage)
    return { group: "lost" as const, data: { reason: String(fd.get("reason")) } };
  if (target === config.wonStage && kind === "agent")
    return {
      group: "won_agent" as const,
      data: {
        firstName: String(fd.get("firstName")),
        lastName: String(fd.get("lastName")),
        address: String(fd.get("address")),
        speciality: String(fd.get("speciality")),
        email: String(fd.get("email")),
        password: String(fd.get("password")),
        phone: String(fd.get("phone")),
      },
    };
  if (target === config.wonStage)
    return {
      group: "won_partner" as const,
      data: {
        companyName: String(fd.get("companyName")),
        keyPersonName: String(fd.get("keyPersonName")),
        keyPersonRole: String(fd.get("keyPersonRole")),
        address: String(fd.get("address")),
        number: String(fd.get("number")),
        email: String(fd.get("email") || "") || undefined,
        password: String(fd.get("password") || "") || undefined,
        businessActivity: businessActivityFrom(fd),
        importance: String(fd.get("importance")) as "high" | "medium" | "low",
      },
    };
  if (target === config.didntAnswerStage) {
    // V2 §6: record WHICH number(s) went unanswered
    const dialed = fd.getAll("dialedNumbers").map(String).filter(Boolean);
    return { group: "numbers" as const, data: { dialedNumbers: dialed } };
  }
  return undefined;
}

/** target stage → its form body. */
export function ProspectGroupFields({
  target,
  reps,
  defaults,
  cardNumbers,
}: {
  target: string;
  reps: Rep[];
  defaults: ProspectGateDefaults;
  cardNumbers: string[];
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const config = partnersConfigFor(defaults.kind);
  if (target === config.followUpStage) return <FollowUpFields reps={reps} />;
  if (target === config.meetingStage)
    /* V2 §6 — simplified: date + time + online/offline. */
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>{t(pPanel.date)}</span>
            <input type="date" name="date" required className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(pPanel.time)}</span>
            <input type="time" name="time" required className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className={labelCls}>{t(pPanel.mode)}</span>
          <select name="mode" required className={inputCls}>
            {MEETING_MODES.map((m) => (
              <option key={m} value={m}>
                {meetingModeLabel(locale, m)}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  if (target === config.lostStage)
    return (
      <label className="block">
        <span className={labelCls}>{t(pPanel.reasonRequired)}</span>
        <textarea name="reason" required rows={3} className={inputCls} />
      </label>
    );
  if (target === config.wonStage)
    return defaults.kind === "agent" ? (
      <WonAgentGateFields defaults={defaults} />
    ) : (
      <WonGateFields defaults={defaults} />
    );
  if (target === config.didntAnswerStage)
    return (
      <div className="space-y-2">
        <p className="u-label">{t(pPanel.dialedQuestion)}</p>
        {cardNumbers.map((n) => (
          <label key={n} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="dialedNumbers" value={n} defaultChecked={cardNumbers.length === 1} />
            {n}
          </label>
        ))}
        <p className="field-hint">
          {t(pPanel.dialedHint)}
        </p>
      </div>
    );
  if (target === config.intakeStage)
    return <p className="u-muted">{t(pPanel.returnsToLead)}</p>;
  return null;
}

export function ProspectEventPanel({
  prospectId,
  stage,
  reps,
  pendingMeeting,
  defaults,
  cardNumbers,
}: {
  prospectId: string;
  stage: string;
  reps: Rep[];
  pendingMeeting: boolean;
  defaults: ProspectGateDefaults;
  /** all numbers on the card (primary + alternatives) — V2 §6 dialed selection */
  cardNumbers: string[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = partnersConfigFor(defaults.kind);
  const terminal = config.terminalStages.includes(stage);
  const nextActions = config.nextActions(stage, "bsystems_admin");
  /* founder: same-stage records are buttons — the card does not move. */
  const sameStageActions = nextActions.filter(isSameStageAction);
  const stageActions = nextActions.filter((a) => !isSameStageAction(a));
  /* the SLOT, not a literal: `follow_up_again` opens the follow-up form of
     whichever stage this card's pipeline follows up in */
  const formTarget = (a: string) =>
    isSameStageAction(a) ? config[SAME_STAGE_FORM_SLOT[a]] : a;
  const attendedDestinations = config.attendedDestinations("bsystems_admin");
  const cancelledDestinations = [config.followUpStage, config.lostStage];

  async function submit(body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/b-systems/partners-pipeline/${prospectId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t(pCommon.somethingWrong));
      return;
    }
    setAction("");
    setOutcome("");
    setDestination("");
    router.refresh();
  }

  const groupForTarget = (target: string, fd: FormData) =>
    prospectGroupPayload(target, fd, defaults.kind);
  const fieldsForTarget = (target: string) => (
    <ProspectGroupFields target={target} reps={reps} defaults={defaults} cardNumbers={cardNumbers} />
  );

  if (terminal) {
    return (
      <p className="u-muted">
        {t(pPanel.terminalCard).replace("{stage}", stageLabel(locale, stage))}
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

      {stage === config.meetingStage && pendingMeeting ? (
        <div className="bg-brand-surface-tint rounded-brand-card shadow-brand-card p-4">
          <p className="u-h3 mb-2">{t(pPanel.meetingOutcome)}</p>
          <select
            aria-label={t(pPanel.meetingOutcome)}
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setDestination("");
            }}
            className={inputCls}
          >
            <option value="">{t(pPanel.chooseOutcome)}</option>
            <option value="attended">{t(pPanel.attended)}</option>
            <option value="cancelled">{t(pPanel.cancelled)}</option>
            <option value="delayed">{t(pPanel.delayed)}</option>
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
              <div className="grid grid-cols-2 gap-3">
                <input type="date" name="date" required className={inputCls} />
                <input type="time" name="time" required className={inputCls} />
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {t(pPanel.saveNewDate)}
              </button>
            </form>
          ) : null}

          {outcome === "attended" || outcome === "cancelled" ? (
            <div className="mt-3 space-y-3">
              <select
                aria-label={t(pPanel.destination)}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={inputCls}
              >
                <option value="">{t(pPanel.chooseDestination)}</option>
                {(outcome === "attended" ? attendedDestinations : cancelledDestinations).map(
                  (d) => (
                    <option key={d} value={d}>
                      {stageLabel(locale, d)}
                    </option>
                  ),
                )}
              </select>
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
                    {t(pPanel.confirmMoveTo).replace("{stage}", stageLabel(locale, destination))}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* founder: the partnership pipeline has Following Up and Meeting Setting
          too — same buttons, same engine actions, no card movement. */}
      {sameStageActions.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {sameStageActions.map((a) => (
            <button key={a} type="button" onClick={() => setAction(a)} className={btnGhost}>
              {sameStageActionLabel(locale, a)}
            </button>
          ))}
        </div>
      ) : null}

      <div>
        <label className="block">
          <span className={labelCls}>{t(pPanel.nextAction)}</span>
          <select
            value={isSameStageAction(action) ? "" : action}
            onChange={(e) => setAction(e.target.value)}
            className={inputCls}
          >
            <option value="">{t(pPanel.chooseNextAction)}</option>
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
                {isSameStageAction(action) ? t(pPanel.saveRecord) : t(pPanel.saveMove)}
              </button>
              <button type="button" onClick={() => setAction("")} className={btnGhost}>
                {t(pCommon.cancel)}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
