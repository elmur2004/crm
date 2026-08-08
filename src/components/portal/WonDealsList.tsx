"use client";

import { useEffect, useState } from "react";
import { formatEGP } from "@/lib/money";
import type { RepWonDeal } from "@/lib/services/won-deals";

/* §8.3 — read-only Won Deals with milestone locks. Values of locked milestones
   never arrive from the server (redacted serializer); this list re-polls every 5s
   so an admin's milestone check unlocks the next one in near-real-time (ADR-009). */

const POLL_MS = 5000;

export function WonDealsList({ initial }: { initial: RepWonDeal[] }) {
  const [wonDeals, setWonDeals] = useState(initial);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/portal/won-deals", { cache: "no-store" });
        if (res.ok) setWonDeals((await res.json()) as RepWonDeal[]);
      } catch {
        /* transient network error — next tick retries */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  if (wonDeals.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        No won deals yet. When the admin marks one of your deals as Won, it appears here.
      </p>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {wonDeals.map((w) => (
        <div
          key={w.id}
          className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4 space-y-2"
        >
          <div>
            <p className="font-brand-display font-bold">{w.deal.name}</p>
            <p className="text-sm text-brand-muted">
              {w.deal.position} · {w.deal.companyName} · {w.deal.industry}
            </p>
            <p className="text-sm text-brand-muted">
              {w.deal.number}
              {w.deal.email ? ` · ${w.deal.email}` : ""}
            </p>
          </div>
          <div className="text-sm grid grid-cols-2 gap-2">
            <p>
              <span className="text-brand-meta text-brand-muted block">Estimated value</span>
              {w.estimatedValue != null ? formatEGP(w.estimatedValue) : "Pending"}
            </p>
            <p>
              <span className="text-brand-meta text-brand-muted block">Total commission</span>
              {w.totalCommission != null ? formatEGP(w.totalCommission) : "Pending"}
            </p>
          </div>
          <div>
            <p className="text-brand-meta text-brand-muted mb-1">Milestones</p>
            {w.milestones.length === 0 ? (
              <p className="text-sm text-brand-muted">Milestones not defined yet.</p>
            ) : (
              <ol className="space-y-1">
                {w.milestones.map((m) => (
                  <li
                    key={m.id}
                    className={`flex items-center gap-2 text-sm rounded-brand-control px-2 py-1.5 ${
                      m.locked ? "bg-brand-surface-tint text-brand-muted" : "bg-brand-surface"
                    }`}
                  >
                    <input type="checkbox" checked={m.completed} disabled readOnly aria-label={`Milestone ${m.index} ${m.completed ? "completed" : "open"}`} />
                    <span className="font-medium">Milestone {m.index}</span>
                    {m.locked ? (
                      <span className="ms-auto inline-flex items-center gap-1" title="Locked until the previous milestone is completed">
                        <LockIcon />
                        <span aria-hidden>•••</span>
                        <span className="sr-only">value hidden while locked</span>
                      </span>
                    ) : (
                      <span className="ms-auto">{formatEGP(m.value ?? 0)}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
