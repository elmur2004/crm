import { formatCairo } from "@/lib/datetime";
import { formatEGP } from "@/lib/money";
import { FOLLOW_UP_CONTEXT_TITLES } from "@/lib/pipeline-engine/constants";
import type { FollowUpContext } from "@/lib/pipeline-engine/constants";

/* §5.2 — field groups are additive history, shown chronologically. Accepts the
   lead/prospect/deal detail's included child records (superset shape, all optional). */

type FollowUpRow = {
  id: string;
  context: string;
  dueAt: Date;
  method: string;
  followingUpWith: string | null;
  ownerSalesRep?: { name: string } | null;
  ownerPortalRep?: { firstName: string; lastName: string } | null;
  createdAt: Date;
};
type MeetingRow = {
  id: string;
  arranged: boolean;
  datetime: Date | null;
  mode: string | null;
  withAttendees: string | null;
  technicalSupport: string | null;
  outcome: string | null;
  createdAt: Date;
};
type ProposalRow = {
  id: string;
  service: string;
  estimatedValue: number | null;
  sent: boolean;
  sentAt: Date | null;
  createdAt: Date;
};
type LostRow = { id: string; reason: string; createdAt: Date };

function Section({ title, at, children }: { title: string; at: Date; children: React.ReactNode }) {
  return (
    <div className="record-group">
      <div className="flex items-baseline justify-between gap-2">
        <p className="record-title">{title}</p>
        <p className="record-time">{formatCairo(at)}</p>
      </div>
      <div className="record-grid">{children}</div>
    </div>
  );
}

export function GroupHistory({
  followUps = [],
  meetings = [],
  proposals = [],
  lostInfo = [],
  won,
}: {
  followUps?: FollowUpRow[];
  meetings?: MeetingRow[];
  proposals?: ProposalRow[];
  lostInfo?: LostRow[];
  won?: { estimatedValue: number; technicalOwner: string; collectedAmount: number; createdAt: Date } | null;
}) {
  const items: Array<{ at: Date; node: React.ReactNode }> = [];

  for (const f of followUps) {
    const owner = f.ownerSalesRep?.name ?? (f.ownerPortalRep ? `${f.ownerPortalRep.firstName} ${f.ownerPortalRep.lastName}` : null);
    items.push({
      at: f.createdAt,
      node: (
        <Section
          key={`f${f.id}`}
          title={FOLLOW_UP_CONTEXT_TITLES[f.context as FollowUpContext] ?? "Following up"}
          at={f.createdAt}
        >
          <p>Due {formatCairo(f.dueAt)} · {f.method === "call" ? "Call" : f.method === "message" ? "Message" : "Visit"}</p>
          {owner ? <p>Owner: {owner}</p> : null}
          {f.followingUpWith ? <p>With: {f.followingUpWith}</p> : null}
        </Section>
      ),
    });
  }
  for (const m of meetings) {
    items.push({
      at: m.createdAt,
      node: (
        <Section key={`m${m.id}`} title="Meeting" at={m.createdAt}>
          {m.arranged && m.datetime ? (
            <p>
              {formatCairo(m.datetime)} · {m.mode === "online" ? "Online" : "Offline"}
            </p>
          ) : (
            <p>Not arranged yet</p>
          )}
          {m.withAttendees ? <p>With: {m.withAttendees}</p> : null}
          {m.technicalSupport ? <p>Technical support: {m.technicalSupport}</p> : null}
          {m.outcome ? <p>Outcome: {m.outcome}</p> : null}
        </Section>
      ),
    });
  }
  for (const p of proposals) {
    items.push({
      at: p.createdAt,
      node: (
        <Section key={`p${p.id}`} title="Proposal" at={p.createdAt}>
          <p>{p.service}</p>
          <p>
            {p.estimatedValue != null ? formatEGP(p.estimatedValue) : "No value set"} ·{" "}
            {p.sent ? `Sent ${p.sentAt ? formatCairo(p.sentAt) : ""}` : "Not sent"}
          </p>
        </Section>
      ),
    });
  }
  for (const l of lostInfo) {
    items.push({
      at: l.createdAt,
      node: (
        <Section key={`l${l.id}`} title="Lost" at={l.createdAt}>
          <p>{l.reason}</p>
        </Section>
      ),
    });
  }
  if (won) {
    items.push({
      at: won.createdAt,
      node: (
        <Section key="won" title="Won" at={won.createdAt}>
          <p>Estimated {formatEGP(won.estimatedValue)}</p>
          <p>Technical owner: {won.technicalOwner}</p>
          <p>Collected {formatEGP(won.collectedAmount)}</p>
        </Section>
      ),
    });
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime());

  if (items.length === 0) {
    return <p className="empty">No stage records yet.</p>;
  }
  return <div className="space-y-2">{items.map((i) => i.node)}</div>;
}
