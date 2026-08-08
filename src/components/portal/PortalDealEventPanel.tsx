"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { portalConfig } from "@/lib/pipeline-engine/configs/portal";
import {
  FollowUpFields,
  LostFields,
  MeetingFields,
  ProposalFields,
  btnGhost,
  btnPrimary,
  followUpFromForm,
  groupForPortalStage,
  inputCls,
  labelCls,
} from "./groupForms";

/* §8.2 — next-action panel on the deal detail. Action list comes from
   portalConfig per the caller's role (Won never offered to reps; the server
   re-validates regardless — P-2/P-3). */

export function PortalDealEventPanel({
  dealId,
  stage,
  isAdmin,
  ownerPortalRepId,
  hasUnsentProposal,
  pendingMeeting,
}: {
  dealId: string;
  stage: string;
  isAdmin: boolean;
  ownerPortalRepId?: string;
  hasUnsentProposal: boolean;
  pendingMeeting: boolean;
}) {
  const router = useRouter();
  const role = isAdmin ? ("portal_admin" as const) : ("portal_rep" as const);
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [destination, setDestination] = useState("");
  const [arranged, setArranged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terminal = portalConfig.terminalStages.includes(stage);
  const nextActions = portalConfig.nextActions(stage, role);
  const attendedDestinations = portalConfig.attendedDestinations(role);
  const cancelledDestinations = [portalConfig.followUpStage, portalConfig.lostStage];

  async function submit(body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/portal/deals/${dealId}/event`, {
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
    router.refresh();
  }

  function fieldsForTarget(target: string) {
    if (target === "following_up") return <FollowUpFields />;
    if (target === "meeting_setting")
      return <MeetingFields arranged={arranged} setArranged={setArranged} />;
    if (target === "proposal_sending") return <ProposalFields />;
    if (target === "lost") return <LostFields />;
    if (target === "leads")
      return <p className="text-sm text-brand-muted">The deal returns to the Leads column.</p>;
    if (target === "won")
      return (
        <p className="text-sm text-brand-muted">
          The deal moves to Won and its Won Deal record is created automatically.
        </p>
      );
    return null;
  }

  if (terminal) {
    return (
      <p className="text-sm text-brand-muted">
        This deal is {STAGE_LABELS[stage]} — no further actions.
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

      {stage === "proposal_sending" && hasUnsentProposal ? (
        <div className="border border-brand-border rounded-brand-card p-4 bg-brand-surface-tint">
          <p className="text-sm font-medium mb-2">Proposal ready — mark it as sent?</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit({
                event: { type: "proposal_sent" },
                group: followUpFromForm(new FormData(e.currentTarget), ownerPortalRepId),
              });
            }}
            className="space-y-3"
          >
            <p className="text-sm font-bold">Following up after proposal</p>
            <FollowUpFields />
            <button type="submit" disabled={busy} className={btnPrimary}>
              Sent — move to Following Up
            </button>
          </form>
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
                      group: groupForPortalStage(destination, new FormData(e.currentTarget), {
                        arranged,
                        ownerPortalRepId,
                      }),
                    });
                  }}
                  className="space-y-3"
                >
                  {fieldsForTarget(destination)}
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
                {STAGE_LABELS[a] ?? a}
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
                group: groupForPortalStage(action, new FormData(e.currentTarget), {
                  arranged,
                  ownerPortalRepId,
                }),
              });
            }}
            className="mt-3 space-y-3 border border-brand-border rounded-brand-card p-4"
          >
            <p className="text-sm font-bold">{STAGE_LABELS[action]}</p>
            {fieldsForTarget(action)}
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
