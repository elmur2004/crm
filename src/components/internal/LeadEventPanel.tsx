"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOLLOW_UP_METHODS,
  MEETING_MODES,
  STAGE_LABELS,
} from "@/lib/pipeline-engine/constants";
import { internalCrmConfig } from "@/lib/pipeline-engine/configs/internal-crm";
import { toPiasters, toPounds } from "@/lib/money";

/* §6.1/§6.2 — selecting a Next Action opens exactly that stage's field group right
   here; submitting fires ONE mutation (event + group payload). Cancel = nothing
   happened. Meeting outcomes and proposal-sent are separate §5.3 events surfaced
   contextually. Brand-agnostic: Apps A & B pass their own apiBase. */

type Rep = { id: string; name: string };

const inputCls =
  "w-full border border-brand-border rounded-brand-control px-3 py-2 bg-brand-surface-card text-sm";
const labelCls = "block text-sm font-medium mb-1";
const btnPrimary =
  "bg-brand-primary text-brand-on-primary rounded-brand-control px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnGhost =
  "border border-brand-border rounded-brand-control px-4 py-2 text-sm text-brand-muted";

function FollowUpFields({ reps }: { reps: Rep[] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Follow-up date</span>
          <input type="date" name="date" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Follow-up time</span>
          <input type="time" name="time" required className={inputCls} />
        </label>
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
  );
}

function followUpFromForm(fd: FormData) {
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
}

function MeetingFields({ arranged, setArranged, reps }: { arranged: boolean; setArranged: (v: boolean) => void; reps: Rep[] }) {
  return (
    <>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="arranged"
          checked={arranged}
          onChange={(e) => setArranged(e.target.checked)}
        />
        <span className="text-sm font-medium">Arranged?</span>
      </label>
      {arranged ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Date</span>
              <input type="date" name="date" required className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Time</span>
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
          <label className="block">
            <span className={labelCls}>With</span>
            <input type="text" name="withAttendees" className={inputCls} placeholder="Attendees" />
          </label>
          <label className="block">
            <span className={labelCls}>Technical support</span>
            <input
              type="text"
              name="technicalSupport"
              list="rep-names"
              className={inputCls}
              placeholder="Name or rep"
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

function meetingFromForm(fd: FormData, arranged: boolean) {
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

function ProposalFields() {
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
      <p className="text-xs text-brand-muted">
        Save the proposal, then use “Mark as sent” — sending moves the card automatically.
      </p>
    </>
  );
}

function proposalFromForm(fd: FormData) {
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

function LostFields() {
  return (
    <label className="block">
      <span className={labelCls}>Reason (required)</span>
      <textarea name="reason" required rows={3} className={inputCls} />
    </label>
  );
}

function WonFields({ prefillValue }: { prefillValue: number | null }) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Estimated value (EGP)</span>
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
        <span className={labelCls}>Technical owner</span>
        <input type="text" name="technicalOwner" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Collected amount (EGP)</span>
        <input type="number" name="collectedAmount" min="0" step="0.01" required className={inputCls} />
      </label>
    </>
  );
}

function wonFromForm(fd: FormData) {
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
  const attendedDestinations = internalCrmConfig.attendedDestinations("byteforce_staff");
  const cancelledDestinations = [internalCrmConfig.followUpStage, internalCrmConfig.lostStage];

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
      setError(data?.error ?? "Something went wrong");
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

      {/* §5.3: contextual auto-events for the current stage */}
      {stage === "sending_proposal" && hasUnsentProposal ? (
        <div className="border border-brand-border rounded-brand-card p-4 bg-brand-surface-tint">
          <p className="text-sm font-medium mb-2">Proposal ready — mark it as sent?</p>
          <p className="text-xs text-brand-muted mb-3">
            Sending moves this card to Following Up and opens the after-proposal follow-up.
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
            <p className="text-sm font-bold">Following up after proposal</p>
            <FollowUpFields reps={reps} />
            <button type="submit" disabled={busy} className={btnPrimary}>
              Sent — move to Following Up
            </button>
          </form>
        </div>
      ) : null}

      {stage === "meeting_setting" && pendingMeeting ? (
        <div className="border border-brand-border rounded-brand-card p-4 bg-brand-surface-tint">
          <p className="text-sm font-medium mb-2">Meeting outcome</p>
          <select aria-label="Meeting outcome" value={outcome} onChange={(e) => { setOutcome(e.target.value); setDestination(""); }} className={inputCls}>
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
              <p className="text-xs text-brand-muted">Delayed — set the new date &amp; time.</p>
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
              <label className="block">
                <span className={labelCls}>
                  {outcome === "attended" ? "Where does it go next?" : "Cancelled — follow up or lost?"}
                </span>
                <select
                  aria-label="Destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Choose…</option>
                  {(outcome === "attended" ? attendedDestinations : cancelledDestinations).map((d) => (
                    <option key={d} value={d}>
                      {STAGE_LABELS[d]}
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
                    Confirm — move to {STAGE_LABELS[destination]}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* §6.1 Next action */}
      <div>
        <label className="block">
          <span className={labelCls}>Next action</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className={inputCls}
          >
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
                group: groupForTarget(action, new FormData(e.currentTarget)),
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
