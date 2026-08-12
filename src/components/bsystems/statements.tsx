"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { toPiasters, toPounds } from "@/lib/money";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { common, statements as d } from "@/lib/i18n/dict/admin";

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
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultPercent =
    row.milestoneValue > 0 ? (row.commissionValue / row.milestoneValue) * 100 : 0;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        {t(d.generate)}
      </button>
    );
  }
  return (
    <div className="modal-overlay">
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
            setError(data?.error ?? t(common.somethingWentWrong));
            return;
          }
          setOpen(false);
          router.refresh();
        }}
        className="modal"
      >
        <div className="modal-head">
          <p className="modal-title">
            {t(d.newStatement)} — {row.label}
          </p>
        </div>
        <div className="modal-body modal-body--grid">
          {error ? <p className="alert-error field--wide">{error}</p> : null}
          <label className="field field--wide">
            <span className={labelCls}>{t(d.fieldClient)}</span>
            <input type="text" name="clientName" required defaultValue={row.clientName} className={inputCls} />
          </label>
          <label className="field">
            <span className={labelCls}>{t(d.fieldMilestoneName)}</span>
            <input type="text" name="milestoneLabel" required defaultValue={row.label} className={inputCls} />
          </label>
          <label className="field">
            <span className={labelCls}>{t(d.fieldMilestoneValueEgp)}</span>
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
          <label className="field">
            <span className={labelCls}>{t(d.fieldPercentOfMilestone)}</span>
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
          <label className="field">
            <span className={labelCls}>{t(d.fieldAmountEgp)}</span>
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
          <label className="field">
            <span className={labelCls}>{t(d.fieldAdjustmentsEgp)}</span>
            <input type="number" name="adjustments" step="0.01" defaultValue={0} className={inputCls} />
          </label>
          <label className="field">
            <span className={labelCls}>{t(d.fieldExpectedPaymentDate)}</span>
            <input type="date" name="expectedDate" className={inputCls} />
          </label>
        </div>
        <div className="modal-foot">
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {t(d.createStatement)}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
              {t(common.cancel)}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Re-upload the proof on a paid statement — shown when the stored file is
    missing (lost in a redeploy) or the admin wants to swap it. */
export function ReplaceProofForm({
  statementId,
  label = "Replace proof",
}: {
  statementId: string;
  label?: string;
}) {
  const router = useRouter();
  const t = tFor(useLocale());
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn--sm">
        {label}
      </button>
    );
  }
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
          method: "PUT",
          body: fd,
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? t(common.uploadFailed));
          return;
        }
        setOpen(false);
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
        aria-label={t(d.newProofAria)}
        className="text-xs"
      />
      <button type="submit" disabled={busy} className="btn-primary btn--sm">
        {t(d.saveProof)}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn--sm">
        {t(common.cancel)}
      </button>
    </form>
  );
}

export function MarkPaidForm({ statementId }: { statementId: string }) {
  const router = useRouter();
  const t = tFor(useLocale());
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
          setError(data?.error ?? t(common.uploadFailed));
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
        aria-label={t(d.proofAria)}
        className="text-xs"
      />
      <button type="submit" disabled={busy} className="btn-primary btn--sm">
        {t(d.markPaid)}
      </button>
    </form>
  );
}
