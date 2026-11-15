"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import type { Brand, Role } from "@/lib/pipeline-engine/constants";
import { SAME_STAGE_FORM_TARGET, isSameStageAction } from "@/lib/pipeline-engine/constants";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { sameStageActionLabel, stageLabel } from "@/lib/i18n/dict/labels";
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
import {
  AssignToField,
  assignToFromForm,
  type AssigneeOption,
} from "@/components/shared/AssignToField";

/* V2 — the lead-detail action panel for the unified B-Systems pipeline. */

export function BsEventPanel({
  leadId,
  stage,
  role,
  reps,
  company,
  apiBase,
  people = [],
  hasUnsentProposal,
  assignees,
}: {
  leadId: string;
  stage: string;
  role: BsFormRole;
  reps: Array<{ id: string; name: string }>;
  /* ADR-073 — WHICH pipeline this lead runs on. Required, like BsBoard's: the
     panel decides which next actions to offer, and they are ROLE-GATED per
     company. Hardcoded to one company it offers another company's staff no way
     to win their own deals. */
  company: Brand;
  /** ADR-074 — this surface's API namespace. Required rather than defaulted to
      the `/api/b-systems` literal, so no call site inherits a company: a panel
      posting to the wrong namespace offers actions the brand wall refuses. */
  apiBase: string;
  /** ADR-071 — the company roster for the meeting form's "Also blocks". */
  people?: Array<{ id: string; name: string }>;
  hasUnsentProposal: boolean;
  /** Founder (2026-11-08) — "Hand this follow-up to": the COMPANY ADMIN's
      options, pre-translated. Absent for everybody else, so no select renders
      (and the server refuses an assignee from them regardless). */
  assignees?: AssigneeOption[];
}) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  /* ADR-073 — the ENGINE role comes from the COMPANY, not from the form role.

     `BsFormRole` describes the FORM SHAPE (full or light), and it is a lossy
     four-value summary of a role: mapping a role into it and back out again
     necessarily lands on a B-Systems role, because those are the only four it
     can name. For any other company that round trip produces `bsystems_admin`,
     which is in neither of that company's config lists — so the Won action
     vanishes and the panel looks complete with no way to close a deal. The
     company is the only thing that can answer this. */
  const engineRole: Role =
    company === "byteforce"
      ? "byteforce_staff"
      : role === "admin"
        ? "bsystems_admin"
        : role === "sales"
          ? "bsystems_sales"
          : role === "agent"
            ? "bsystems_agent"
            : "bsystems_partner";
  const light = isLight(role);
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingSent, setMeetingSent] = useState(false);
  const formState = useGroupFormState();

  const config = configForBrand(company);
  const terminal = config.terminalStages.includes(stage);
  const nextActions = config.nextActions(stage, engineRole);
  /* founder: the same-stage records are BUTTONS, not options in a "where does
     this go next" select — nothing moves when you press them. */
  const sameStageActions = nextActions.filter(isSameStageAction);
  const stageActions = nextActions.filter((a) => !isSameStageAction(a));
  /* a same-stage action reuses its stage's own field group (V2 §3 role-aware) */
  const formTarget = (a: string) => (isSameStageAction(a) ? SAME_STAGE_FORM_TARGET[a] : a);
  /* the form target that records a FOLLOW-UP — the only one that can carry a
     hand-over (the server asks the engine the same question) */
  const followUpTarget = config.followUpStage;

  async function submit(body: unknown, onOk?: () => void) {
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

      {/* ADR-107 — no "Mark ready to close" (founder: "remove the whole mark
          ready to close thing"). ADR-108 — no meeting outcome either: what
          happened in a meeting goes in the comments, and the card moves on by
          Next action (Reschedule meeting covers a delay). */}
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
                const fd = new FormData(e.currentTarget);
                void submit({
                  event: { type: "proposal_sent" },
                  group: followUpPayload(fd, false),
                  assignTo: assignToFromForm(fd),
                });
              }}
              className="space-y-3"
            >
              <p className="u-label">{t(msg.followUpAfterProposal)}</p>
              <FollowUpFieldsV2 light={false} />
              <AssignToField options={assignees} />
              <button type="submit" disabled={busy} className={btnPrimary}>
                {t(msg.sentMoveToFollowUp)}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {/* founder: "add a button inside the lead" — record another follow-up, the
          negotiation's response date, or a rescheduled meeting, WITHOUT the card
          leaving its column. Every role that can act on the lead sees them. */}
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
          <span className={labelCls}>{t(common.nextAction)}</span>
          <select
            value={isSameStageAction(action) ? "" : action}
            onChange={(e) => setAction(e.target.value)}
            className={inputCls}
          >
            <option value="">{t(msg.chooseNextAction)}</option>
            {stageActions.map((a) => (
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
              const fd = new FormData(e.currentTarget);
              void submit(
                {
                  event: { type: "next_action", action },
                  group: buildGroupPayload(formTarget(action), fd, {
                    light,
                    /* a reschedule always records an ARRANGED meeting — it is a
                       new date agreed with the client, not a proposed slot */
                    agreed: action === "reschedule_meeting" ? true : formState.agreed,
                    milestoneCount: formState.milestoneCount,
                  }),
                  assignTo: formTarget(action) === followUpTarget ? assignToFromForm(fd) : undefined,
                },
                () => {
                  if (action === "meeting_setting" && light) setMeetingSent(true);
                },
              );
            }}
            className="crm-reveal mt-3 space-y-3 card card-pad"
          >
            <p className="u-h3">
              {isSameStageAction(action)
                ? sameStageActionLabel(locale, action)
                : action === "won"
                  ? t(common.confirmWin)
                  : stageLabel(locale, action)}
            </p>
            <GroupFieldsV2
              people={people}
              target={formTarget(action)}
              role={role}
              reps={reps}
              agreed={action === "reschedule_meeting" ? true : formState.agreed}
              setAgreed={formState.setAgreed}
              lockArranged={action === "reschedule_meeting"}
              milestoneCount={formState.milestoneCount}
              setMilestoneCount={formState.setMilestoneCount}
            />
            {formTarget(action) === followUpTarget ? <AssignToField options={assignees} /> : null}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {isSameStageAction(action) ? t(msg.saveRecord) : t(msg.saveAndMove)}
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
