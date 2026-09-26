"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { CURRENCY } from "@/lib/money";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { common, proposalEdit as d } from "@/lib/i18n/dict/crm";

/* ADR-078 — the edit button on a proposal inside the lead.

   Founder: "put an edit button in the proposal inside the lead." Until now a
   proposal was write-once, so correcting a mistyped value meant adding a SECOND
   proposal — which is a re-quote, not a correction: it moves the lead's latest
   value and everything derived from it, to fix a typo.

   THE CURRENCY IS IN THE LABEL, and it stays there. ADR-077 needed it because
   two currencies existed and this one form edited both; ADR-080 removed the
   second one, and the label survives on its own merit — an amount field that
   names its unit is the difference between correcting a figure and re-entering
   it in the wrong scale. */

export function ProposalEditForm({
  proposalId,
  apiBase,
  service,
  estimatedValue,
}: {
  proposalId: string;
  /** this surface's namespace — the company is derived from the ROUTE */
  apiBase: string;
  service: string;
  estimatedValue: number | null;
}) {
  const t = tFor(useLocale());
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn--sm">
        {t(d.edit)}
      </button>
    );
  }

  return (
    <form
      className="space-y-2 mt-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch(`${apiBase}/proposals/${proposalId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service: String(fd.get("service") ?? ""),
            estimatedValue: String(fd.get("estimatedValue") ?? ""),
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
    >
      {error ? <p className="alert-error">{error}</p> : null}
      <label className="block">
        <span className={labelCls}>{t(d.fieldService)}</span>
        <input type="text" name="service" required defaultValue={service} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>
          {t(d.fieldValue)} ({CURRENCY})
        </span>
        <input
          type="number"
          name="estimatedValue"
          min="0"
          step="0.01"
          required
          defaultValue={estimatedValue != null ? estimatedValue / 100 : ""}
          className={inputCls}
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {t(common.save)}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          {t(common.cancel)}
        </button>
      </div>
    </form>
  );
}
