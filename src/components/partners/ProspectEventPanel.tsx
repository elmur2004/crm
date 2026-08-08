"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOLLOW_UP_METHODS,
  IMPORTANCE_LEVELS,
  MEETING_MODES,
  STAGE_LABELS,
} from "@/lib/pipeline-engine/constants";
import { partnersConfig } from "@/lib/pipeline-engine/configs/partners";

/* §7.2 — the Partners pipeline's action panel. Same one-mutation commit model as
   the internal CRM (ADR-023); Won opens the completeness gate (PP-4); Didn't
   Answer reveals the number slots (PP-1). All sets derive from partnersConfig. */

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

function WonGateFields({ defaults }: { defaults: { companyName: string; name: string; role: string | null; number: string; email: string | null; businessActivity: string } }) {
  return (
    <>
      <p className="text-xs text-brand-muted">
        Won saves only when the partner record is complete.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Company name</span>
          <input type="text" name="companyName" required defaultValue={defaults.companyName} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Key person name</span>
          <input type="text" name="keyPersonName" required defaultValue={defaults.name} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Key person role</span>
          <input type="text" name="keyPersonRole" required defaultValue={defaults.role ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Number</span>
          <input type="tel" name="number" required defaultValue={defaults.number} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input type="email" name="email" defaultValue={defaults.email ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Importance</span>
          <select name="importance" required className={inputCls}>
            {IMPORTANCE_LEVELS.map((i) => (
              <option key={i} value={i}>
                {i[0]!.toUpperCase() + i.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Address</span>
        <input type="text" name="address" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Business activity</span>
        <input type="text" name="businessActivity" required defaultValue={defaults.businessActivity} className={inputCls} />
      </label>
    </>
  );
}

export function ProspectEventPanel({
  prospectId,
  stage,
  reps,
  pendingMeeting,
  defaults,
}: {
  prospectId: string;
  stage: string;
  reps: Rep[];
  pendingMeeting: boolean;
  defaults: { companyName: string; name: string; role: string | null; number: string; email: string | null; businessActivity: string };
}) {
  const router = useRouter();
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [destination, setDestination] = useState("");
  const [arranged, setArranged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terminal = partnersConfig.terminalStages.includes(stage);
  const nextActions = partnersConfig.nextActions(stage, "bsystems_staff");
  const attendedDestinations = partnersConfig.attendedDestinations("bsystems_staff");
  const cancelledDestinations = [partnersConfig.followUpStage, partnersConfig.lostStage];

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
      setError(data?.error ?? "Something went wrong");
      return;
    }
    setAction("");
    setOutcome("");
    setDestination("");
    router.refresh();
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

  function groupForTarget(target: string, fd: FormData) {
    if (target === "following_up") return followUpFromForm(fd);
    if (target === "meeting_setting")
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
    if (target === "lost")
      return { group: "lost" as const, data: { reason: String(fd.get("reason")) } };
    if (target === "won")
      return {
        group: "won_partner" as const,
        data: {
          companyName: String(fd.get("companyName")),
          keyPersonName: String(fd.get("keyPersonName")),
          keyPersonRole: String(fd.get("keyPersonRole")),
          address: String(fd.get("address")),
          number: String(fd.get("number")),
          email: String(fd.get("email") || "") || undefined,
          businessActivity: String(fd.get("businessActivity")),
          importance: String(fd.get("importance")) as "high" | "medium" | "low",
        },
      };
    return undefined; // didnt_answer — numbers revealed, no payload
  }

  function fieldsForTarget(target: string) {
    if (target === "following_up") return <FollowUpFields reps={reps} />;
    if (target === "meeting_setting")
      return (
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
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
                <input type="text" name="withAttendees" className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Technical support</span>
                <input type="text" name="technicalSupport" className={inputCls} />
              </label>
            </>
          ) : null}
        </>
      );
    if (target === "lost")
      return (
        <label className="block">
          <span className={labelCls}>Reason (required)</span>
          <textarea name="reason" required rows={3} className={inputCls} />
        </label>
      );
    if (target === "won") return <WonGateFields defaults={defaults} />;
    if (target === "didnt_answer")
      return (
        <p className="text-sm text-brand-muted">
          The card moves to Didn&apos;t Answer and reveals the Number 2 / Number 3 fields on
          this page. Saving a new number returns it to Lead automatically.
        </p>
      );
    return null;
  }

  if (terminal) {
    return (
      <p className="text-sm text-brand-muted">
        This card is {STAGE_LABELS[stage]} — no further actions.
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
                {(outcome === "attended" ? attendedDestinations : cancelledDestinations).map(
                  (d) => (
                    <option key={d} value={d}>
                      {STAGE_LABELS[d]}
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
                      group: groupForTarget(destination === "won" ? "won" : destination, new FormData(e.currentTarget)),
                    });
                  }}
                  className="space-y-3"
                >
                  {fieldsForTarget(destination === "won" ? "won" : destination)}
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
                group: groupForTarget(action === "won" ? "won" : action, new FormData(e.currentTarget)),
              });
            }}
            className="mt-3 space-y-3 border border-brand-border rounded-brand-card p-4"
          >
            <p className="text-sm font-bold">{STAGE_LABELS[action]}</p>
            {fieldsForTarget(action === "won" ? "won" : action)}
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
