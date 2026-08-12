"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { common, eventPanel as msg } from "@/lib/i18n/dict/crm";
import {
  FollowUpFieldsV2,
  GroupFieldsV2,
  buildGroupPayload,
  followUpPayload,
  isLight,
  useGroupFormState,
  type BsFormRole,
} from "./roleForms";

/* V2 — the lead-detail action panel for the unified B-Systems pipeline. */

export function BsEventPanel({
  leadId,
  stage,
  role,
  reps,
  hasUnsentProposal,
  pendingMeeting,
  readyToClose,
}: {
  leadId: string;
  stage: string;
  role: BsFormRole;
  reps: Array<{ id: string; name: string }>;
  hasUnsentProposal: boolean;
  pendingMeeting: boolean;
  readyToClose: boolean;
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const engineRole =
    role === "admin"
      ? ("bsystems_admin" as const)
      : role === "sales"
        ? ("bsystems_sales" as const)
        : role === "agent"
          ? ("bsystems_agent" as const)
          : ("bsystems_partner" as const);
  const light = isLight(role);
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingSent, setMeetingSent] = useState(false);
  const formState = useGroupFormState();

  const terminal = bsystemsCrmConfig.terminalStages.includes(stage);
  const nextActions = bsystemsCrmConfig.nextActions(stage, engineRole);
  const attendedDestinations = bsystemsCrmConfig.attendedDestinations(engineRole);
  const cancelledDestinations = [bsystemsCrmConfig.followUpStage, bsystemsCrmConfig.lostStage];

  async function submit(body: unknown, onOk?: () => void) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/b-systems/leads/${leadId}/event`, {
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
    onOk?.();
    router.refresh();
  }

  if (terminal) {
    return (
      <p className="u-muted">
        {t(msg.terminalNote).replace("{stage}", stageLabel(locale, stage))}
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
      {meetingSent && light ? (
        <p role="status" className="info-banner">
          {t(msg.requestReceived)}
        </p>
      ) : null}

      {!readyToClose ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await fetch(`/api/b-systems/leads/${leadId}/ready`, { method: "POST" });
            setBusy(false);
            router.refresh();
          }}
          className="border border-brand-accent text-brand-accent rounded-brand-control px-3 py-1.5 text-sm font-medium"
        >
          {t(common.markReadyToClose)}
        </button>
      ) : (
        <p className="text-sm">
          <span className="badge badge--accent">{t(common.readyToClose)}</span>
        </p>
      )}

      {stage === "sending_proposal" && hasUnsentProposal ? (
        <div className="card card-pad space-y-3">
          <p className="u-h3">{t(msg.proposalReady)}</p>
          {light ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit({ event: { type: "proposal_sent" } })}
              className={btnPrimary}
            >
              {t(msg.sentBackToFollowUp)}
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit({
                  event: { type: "proposal_sent" },
                  group: followUpPayload(new FormData(e.currentTarget), false),
                });
              }}
              className="space-y-3"
            >
              <p className="u-label">{t(msg.followUpAfterProposal)}</p>
              <FollowUpFieldsV2 light={false} reps={reps} />
              <button type="submit" disabled={busy} className={btnPrimary}>
                {t(msg.sentMoveToFollowUp)}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {stage === "meeting_setting" && pendingMeeting ? (
        <div className="card card-pad space-y-3">
          <p className="u-h3">{t(msg.meetingOutcome)}</p>
          <select
            aria-label={t(msg.meetingOutcome)}
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setDestination("");
            }}
            className={inputCls}
          >
            <option value="">{t(msg.chooseOutcome)}</option>
            <option value="attended">{t(msg.attended)}</option>
            <option value="cancelled">{t(msg.cancelled)}</option>
            <option value="delayed">{t(msg.delayed)}</option>
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
                {t(msg.saveNewDate)}
              </button>
            </form>
          ) : null}

          {outcome === "attended" || outcome === "cancelled" ? (
            <div className="mt-3 space-y-3">
              <select
                aria-label={t(msg.destination)}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={inputCls}
              >
                <option value="">{t(msg.chooseDestination)}</option>
                {(outcome === "attended" ? attendedDestinations : cancelledDestinations).map((d) => (
                  <option key={d} value={d}>
                    {stageLabel(locale, d)}
                  </option>
                ))}
              </select>
              {destination ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit({
                      event: { type: "meeting_outcome", outcome, destination },
                      group: buildGroupPayload(destination, new FormData(e.currentTarget), {
                        light,
                        agreed: formState.agreed,
                        milestoneCount: formState.milestoneCount,
                      }),
                    });
                  }}
                  className="space-y-3"
                >
                  <GroupFieldsV2
                    target={destination}
                    role={role}
                    reps={reps}
                    agreed={formState.agreed}
                    setAgreed={formState.setAgreed}
                    milestoneCount={formState.milestoneCount}
                    setMilestoneCount={formState.setMilestoneCount}
                  />
                  <button type="submit" disabled={busy} className={btnPrimary}>
                    {t(msg.confirmMoveTo).replace("{stage}", stageLabel(locale, destination))}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="block">
          <span className={labelCls}>{t(common.nextAction)}</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
            <option value="">{t(msg.chooseNextAction)}</option>
            {nextActions.map((a) => (
              <option key={a} value={a}>
                {a === "won" ? t(common.confirmWin) : stageLabel(locale, a)}
              </option>
            ))}
          </select>
        </label>

        {action ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(
                {
                  event: { type: "next_action", action },
                  group: buildGroupPayload(action, new FormData(e.currentTarget), {
                    light,
                    agreed: formState.agreed,
                    milestoneCount: formState.milestoneCount,
                  }),
                },
                () => {
                  if (action === "meeting_setting" && light) setMeetingSent(true);
                },
              );
            }}
            className="mt-3 space-y-3 card card-pad"
          >
            <p className="u-h3">{action === "won" ? t(common.confirmWin) : stageLabel(locale, action)}</p>
            <GroupFieldsV2
              target={action}
              role={role}
              reps={reps}
              agreed={formState.agreed}
              setAgreed={formState.setAgreed}
              milestoneCount={formState.milestoneCount}
              setMilestoneCount={formState.setMilestoneCount}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {t(msg.saveAndMove)}
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
