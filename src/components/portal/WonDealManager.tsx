"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEGP, toPiasters, toPounds } from "@/lib/money";
import { btnGhost, btnPrimary, inputCls, labelCls } from "./groupForms";

/* §8.5.3 — per-won-deal management: estimated value + total commission, milestone
   definition (choose the count → that many value fields), and the P-8 check /
   uncheck boxes. Checking milestone i unlocks i+1 for the rep in real time
   (their view polls). A-11 sum mismatch → non-blocking warning banner. */

export interface AdminWonDeal {
  id: string;
  repName: string;
  dealName: string;
  companyName: string;
  estimatedValue: number | null;
  totalCommission: number | null;
  milestones: Array<{ id: string; index: number; value: number; completed: boolean }>;
}

export function WonDealManager({ wonDeal }: { wonDeal: AdminWonDeal }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [milestoneCount, setMilestoneCount] = useState<number>(
    wonDeal.milestones.length || 3,
  );
  const [defining, setDefining] = useState(wonDeal.milestones.length === 0);

  async function call(url: string, method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Something went wrong");
      return false;
    }
    const data = (await res.json().catch(() => null)) as { warning?: string | null } | null;
    setWarning(data?.warning ?? null); // A-11 — non-blocking
    router.refresh();
    return true;
  }

  return (
    <div className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4 space-y-4">
      <div>
        <p className="font-brand-display font-bold">{wonDeal.dealName}</p>
        <p className="text-sm text-brand-muted">
          {wonDeal.companyName} · {wonDeal.repName}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p role="status" className="text-sm bg-brand-surface-tint text-brand-ink rounded-brand-control px-3 py-2">
          {warning} — saved anyway.
        </p>
      ) : null}

      {/* Values */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const num = (k: string) => {
            const v = String(fd.get(k) || "");
            return v ? toPiasters(v) : null;
          };
          void call(`/api/portal/admin/won-deals/${wonDeal.id}`, "PATCH", {
            estimatedValue: num("estimatedValue"),
            totalCommission: num("totalCommission"),
          });
        }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end"
      >
        <label className="block">
          <span className={labelCls}>Estimated value (EGP)</span>
          <input
            type="number"
            name="estimatedValue"
            min="0"
            step="0.01"
            defaultValue={wonDeal.estimatedValue != null ? toPounds(wonDeal.estimatedValue) : undefined}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Total commission (EGP)</span>
          <input
            type="number"
            name="totalCommission"
            min="0"
            step="0.01"
            defaultValue={wonDeal.totalCommission != null ? toPounds(wonDeal.totalCommission) : undefined}
            className={inputCls}
          />
        </label>
        <button type="submit" disabled={busy} className={btnPrimary}>
          Save values
        </button>
      </form>

      {/* Milestones */}
      <div className="space-y-2">
        <p className="text-brand-meta text-brand-muted">Milestones</p>

        {wonDeal.milestones.length > 0 && !defining ? (
          <>
            <ol className="space-y-1">
              {wonDeal.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={m.completed}
                    disabled={busy}
                    onChange={(e) =>
                      void call(`/api/portal/admin/milestones/${m.id}`, "PATCH", {
                        completed: e.target.checked,
                      })
                    }
                    aria-label={`Milestone ${m.index}`}
                  />
                  <span>Milestone {m.index}</span>
                  <span className="ms-auto">{formatEGP(m.value)}</span>
                </li>
              ))}
            </ol>
            {!wonDeal.milestones.some((m) => m.completed) ? (
              <button type="button" onClick={() => setDefining(true)} className={btnGhost}>
                Redefine milestones
              </button>
            ) : null}
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const values: number[] = [];
              for (let i = 1; i <= milestoneCount; i++) {
                values.push(toPiasters(String(fd.get(`value${i}`) || "0")));
              }
              void call(`/api/portal/admin/won-deals/${wonDeal.id}/milestones`, "POST", {
                values,
              }).then((ok) => {
                if (ok) setDefining(false);
              });
            }}
            className="space-y-2"
          >
            <label className="block max-w-40">
              <span className={labelCls}>Number of milestones</span>
              <input
                type="number"
                min={1}
                max={100}
                value={milestoneCount}
                onChange={(e) => setMilestoneCount(Math.max(1, Number(e.target.value) || 1))}
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array.from({ length: milestoneCount }, (_, i) => (
                <label key={i} className="block">
                  <span className={labelCls}>Milestone {i + 1} value (EGP)</span>
                  <input type="number" name={`value${i + 1}`} min="0" step="0.01" required className={inputCls} />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>
                Save milestones
              </button>
              {wonDeal.milestones.length > 0 ? (
                <button type="button" onClick={() => setDefining(false)} className={btnGhost}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
