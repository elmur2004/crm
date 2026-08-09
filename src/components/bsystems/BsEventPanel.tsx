"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
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
      setError(data?.error ?? "Something went wrong");
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
      <p className="text-sm text-brand-muted">
        This lead is {STAGE_LABELS[stage]} — no further actions.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      ) : null}
      {meetingSent && light ? (
        <p role="status" className="text-sm bg-brand-surface-tint rounded-brand-control px-3 py-2">
          Your request was received — we&apos;ll confirm on WhatsApp.
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
          Mark ready to close
        </button>
      ) : (
        <p className="text-sm">
          <span className="bg-brand-accent text-brand-on-accent rounded-brand-control px-2 py-1">
            Ready to close
          </span>
        </p>
      )}

      {stage === "sending_proposal" && hasUnsentProposal ? (
        <div className="border border-brand-border rounded-brand-card p-4 bg-brand-surface-tint">
          <p className="text-sm font-medium mb-2">Proposal ready — mark it as sent?</p>
          {light ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit({ event: { type: "proposal_sent" } })}
              className={btnPrimary}
            >
              Sent — back to Following Up
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
              <p className="text-sm font-bold">Following up after proposal</p>
              <FollowUpFieldsV2 light={false} reps={reps} />
              <button type="submit" disabled={busy} className={btnPrimary}>
                Sent — move to Following Up
              </button>
            </form>
          )}
        </div>
      ) : null}

      {stage === "meeting_setting" && pendingMeeting ? (
        <div className="border border-brand-border rounded-brand-card p-4 bg-brand-surface-tint">
          <p className="text-sm font-medium mb-2">Meeting outcome</p>
          <select
            aria-label="Meeting outcome"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setDestination("");
            }}
            className={inputCls}
          >
            <option value="">Choose an outcome…</option>
            <option value="attended">Attended</option>
            <option value="cancelled">Cancelled</option>
            <option value="delayed">Delayed</option>
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
                Save new date
              </button>
            </form>
          ) : null}

          {outcome === "attended" || outcome === "cancelled" ? (
            <div className="mt-3 space-y-3">
              <select
                aria-label="Destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={inputCls}
              >
                <option value="">Choose a destination…</option>
                {(outcome === "attended" ? attendedDestinations : cancelledDestinations).map((d) => (
                  <option key={d} value={d}>
                    {STAGE_LABELS[d]}
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
                    Confirm — move to {STAGE_LABELS[destination]}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="block">
          <span className={labelCls}>Next action</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
            <option value="">Choose a next action…</option>
            {nextActions.map((a) => (
              <option key={a} value={a}>
                {a === "won" ? "Confirm win" : STAGE_LABELS[a]}
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
            className="mt-3 space-y-3 border border-brand-border rounded-brand-card p-4"
          >
            <p className="text-sm font-bold">{action === "won" ? "Confirm win" : STAGE_LABELS[action]}</p>
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
                Save &amp; move
              </button>
              <button type="button" onClick={() => setAction("")} className={btnGhost}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
