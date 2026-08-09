"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { toPiasters, toPounds } from "@/lib/money";

/* V2 §7 — Statements client widgets: the Generate→editable→Create flow on a
   waiting milestone, and the admin's mark-paid proof-image upload. */

export interface WaitingRow {
  milestoneId: string;
  label: string;
  clientName: string;
  companyName: string | null;
  closerLabel: string;
  milestoneValue: number;
  commissionValue: number;
}

export function StatementGenerator({ row }: { row: WaitingRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultPercent =
    row.milestoneValue > 0 ? (row.commissionValue / row.milestoneValue) * 100 : 0;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        Generate
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-40 bg-brand-surface-dark/60 flex items-center justify-center p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const milestoneValue = toPiasters(String(fd.get("milestoneValue")));
          const percent = Number(fd.get("percent") || 0);
          setBusy(true);
          setError(null);
          const res = await fetch("/api/b-systems/statements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              milestoneId: row.milestoneId,
              clientName: String(fd.get("clientName")),
              milestoneLabel: String(fd.get("milestoneLabel")),
              milestoneValue,
              percentBp: Math.round(percent * 100),
              amount: toPiasters(String(fd.get("amount"))),
              adjustments: Math.round(Number(fd.get("adjustments") || 0) * 100),
              expectedDate: String(fd.get("expectedDate") || "") || undefined,
            }),
          });
          setBusy(false);
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            setError(data?.error ?? "Something went wrong");
            return;
          }
          setOpen(false);
          router.refresh();
        }}
        className="bg-brand-surface rounded-brand-card shadow-brand-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-3"
      >
        <p className="font-brand-display font-bold">New statement — {row.label}</p>
        {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className={labelCls}>Client</span>
            <input type="text" name="clientName" required defaultValue={row.clientName} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Milestone name</span>
            <input type="text" name="milestoneLabel" required defaultValue={row.label} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Milestone value (EGP)</span>
            <input
              type="number"
              name="milestoneValue"
              min="0"
              step="0.01"
              required
              defaultValue={toPounds(row.milestoneValue)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>% of milestone</span>
            <input
              type="number"
              name="percent"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={defaultPercent.toFixed(2)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Amount (EGP)</span>
            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              required
              defaultValue={toPounds(row.commissionValue)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Adjustments (EGP, ±)</span>
            <input type="number" name="adjustments" step="0.01" defaultValue={0} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Expected payment date</span>
            <input type="date" name="expectedDate" className={inputCls} />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>
            Create statement
          </button>
          <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function MarkPaidForm({ statementId }: { statementId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const proof = fileRef.current?.files?.[0];
        if (!proof) return;
        const fd = new FormData();
        fd.append("proof", proof);
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/b-systems/statements/${statementId}/paid`, {
          method: "POST",
          body: fd,
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Upload failed");
          return;
        }
        router.refresh();
      }}
      className="flex items-center gap-2 flex-wrap"
    >
      {error ? <p className="text-xs text-brand-danger w-full">{error}</p> : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        required
        aria-label="Payment proof image"
        className="text-xs"
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-brand-primary text-brand-on-primary rounded-brand-control px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        Mark paid
      </button>
    </form>
  );
}
