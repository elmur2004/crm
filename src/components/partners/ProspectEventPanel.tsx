"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOLLOW_UP_METHODS,
  IMPORTANCE_LEVELS,
  MEETING_MODES,
  isSameStageAction,
} from "@/lib/pipeline-engine/constants";
import { partnersConfigFor } from "@/lib/pipeline-engine/configs/partners";
import { requiredGroupFor, requiredGroupForTarget } from "@/lib/pipeline-engine/transition";
import type { RequiredGroup } from "@/lib/pipeline-engine/types";
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

/* §7.2 — the Partners & Agents pipeline's action panel. Same one-mutation
   commit model as the internal CRM (ADR-023); a partner's Qualified opens the
   completeness gate (PP-4); Didn't Answer reveals the number slots (PP-1).

   ADR-059 — the forms are keyed off the REQUIRED GROUP the engine returns, never
   off the target stage. That is the only way three founder rules stay true in
   one place: Contacted and Waiting open NOTHING (1.2 / 1.1), an agent's
   Qualified opens NOTHING (1.3), and "Record a follow-up" still renders the
   follow-up form even though no STAGE plays the follow-up role any more (2.1). */

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
export function WonAgentGateFields({ defaults }: { defaults: ProspectGateDefaults }) {
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

/** The required group → the payload harvested from the form (V2 §6 shapes).
    Keyed off the GROUP, so a stage that opens no group yields nothing at all. */
export function prospectGroupPayload(group: RequiredGroup | null, fd: FormData) {
  if (!group) return undefined; // contacted / waiting / lead / agent-qualified
  if (group.group === "follow_up")
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
  if (group.group === "meeting")
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
  if (group.group === "lost")
    return { group: "lost" as const, data: { reason: String(fd.get("reason")) } };
  if (group.group === "won_partner")
    /* ADR-059 / founder 1.3: email stays optional and there is NO password
       field at all — qualifying never asks for credentials. */
    return {
      group: "won_partner" as const,
      data: {
        companyName: String(fd.get("companyName")),
        keyPersonName: String(fd.get("keyPersonName")),
        keyPersonRole: String(fd.get("keyPersonRole")),
        address: String(fd.get("address")),
        number: String(fd.get("number")),
        email: String(fd.get("email") || "") || undefined,
        businessActivity: businessActivityFrom(fd),
        importance: String(fd.get("importance")) as "high" | "medium" | "low",
      },
    };
  if (group.group === "numbers") {
    // V2 §6: record WHICH number(s) went unanswered
    const dialed = fd.getAll("dialedNumbers").map(String).filter(Boolean);
    return { group: "numbers" as const, data: { dialedNumbers: dialed } };
  }
  return undefined;
}

/** The required group → its form body. `null` renders nothing: the move commits
    with no questions asked (founder 1.2 / 1.1 / 1.3). */
export function ProspectGroupFields({
  group,
  target,
  reps,
  defaults,
  cardNumbers,
}: {
  group: RequiredGroup | null;
  /** only for the informational "returns to Lead" note — never for the form */
  target?: string;
  reps: Rep[];
  defaults: ProspectGateDefaults;
  cardNumbers: string[];
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const config = partnersConfigFor(defaults.kind);
  if (!group) {
    return target === config.intakeStage ? (
      <p className="u-muted">{t(pPanel.returnsToLead)}</p>
    ) : null;
  }
  if (group.group === "follow_up") return <FollowUpFields reps={reps} />;
  if (group.group === "meeting")
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
  if (group.group === "lost")
    return (
      <label className="block">
        <span className={labelCls}>{t(pPanel.reasonRequired)}</span>
        <textarea name="reason" required rows={3} className={inputCls} />
      </label>
    );
  if (group.group === "won_partner") return <WonGateFields defaults={defaults} />;
  if (group.group === "numbers")
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
  /* ADR-059 — ask the ENGINE which group (if any) an action opens. It answers
     for the same-stage records too, so "Record a follow-up" still renders the
     follow-up form with no stage playing the follow-up role. */
  const groupForAction = (a: string) => requiredGroupFor(config, stage, a);
  const attendedDestinations = config.attendedDestinations("bsystems_admin");
  const cancelledDestinations = config.cancelledDestinations("bsystems_admin");

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

  const groupForDestination = (target: string) => requiredGroupForTarget(config, stage, target);
  const fieldsFor = (group: RequiredGroup | null, target?: string) => (
    <ProspectGroupFields
      group={group}
      target={target}
      reps={reps}
      defaults={defaults}
      cardNumbers={cardNumbers}
    />
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
                      group: prospectGroupPayload(
                        groupForDestination(destination),
                        new FormData(e.currentTarget),
                      ),
                    });
                  }}
                  className="space-y-3"
                >
                  {fieldsFor(groupForDestination(destination), destination)}
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
                group: prospectGroupPayload(groupForAction(action), new FormData(e.currentTarget)),
              });
            }}
            className="card card-pad mt-3 space-y-3"
          >
            <p className="u-h3">
              {isSameStageAction(action)
                ? sameStageActionLabel(locale, action)
                : stageLabel(locale, action)}
            </p>
            {fieldsFor(groupForAction(action), action)}
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
