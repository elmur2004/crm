"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { leadTypeLabel } from "@/lib/i18n/dict/labels";
import { pCommon, pLead } from "@/lib/i18n/dict/partners";
import { signup } from "@/lib/i18n/dict/auth";

/* §7.4 / PP-5 — add a lead inside a partner's detail: §6.1 lead fields + optional
   assign-to-rep (A-6, default Unassigned). The server stamps the attribution. */

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";
const btnPrimary = "btn-primary";

export function PartnerAddLeadClient({
  partnerId,
  reps,
}: {
  partnerId: string;
  reps: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        {t(pLead.addLead)}
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/b-systems/partners/${partnerId}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salesRepId: String(fd.get("salesRepId") || "") || undefined,
            name: String(fd.get("name")),
            number: String(fd.get("number")),
            email: String(fd.get("email") || "") || undefined,
            type: String(fd.get("type")),
            description: String(fd.get("description") || "") || undefined,
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? t(pCommon.somethingWrong));
          return;
        }
        setOpen(false);
        router.refresh();
      }}
      className="card card-pad space-y-3 w-full"
    >
      <p className="u-h3">{t(pLead.newLeadTitle)}</p>
      {error ? <p className="alert-error">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(pCommon.name)}</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(pCommon.number)}</span>
          <input type="tel" name="number" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(signup.email)}</span>
          <input type="email" name="email" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(pLead.type)}</span>
          <select name="type" required className={inputCls}>
            {LEAD_TYPES.map((lt) => (
              <option key={lt} value={lt}>
                {leadTypeLabel(locale, lt)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>{t(pLead.assignToRep)}</span>
          <select name="salesRepId" className={inputCls}>
            <option value="">{t(pLead.unassignedPartnerLeads)}</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(pCommon.description)}</span>
        <textarea name="description" rows={2} className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(pLead.saveLead)}
      </button>
    </form>
  );
}
