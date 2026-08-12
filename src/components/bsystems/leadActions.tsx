"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { leadTypeLabel } from "@/lib/i18n/dict/labels";
import { common, leadDetail, leadForm } from "@/lib/i18n/dict/crm";

/* V2 §2.2 — admin lead actions: edit any field, copy the lead's data, delete. */

export interface EditableLead {
  id: string;
  name: string;
  number: string;
  email: string | null;
  type: string;
  description: string | null;
  position: string | null;
  companyName: string | null;
  industry: string | null;
  requirements: string | null;
}

export function CopyLeadButton({ lead }: { lead: EditableLead }) {
  const t = tFor(useLocale());
  const [copied, setCopied] = useState(false);
  const text = [
    `${t(leadDetail.fieldName)} ${lead.name}`,
    `${t(leadDetail.fieldNumber)} ${lead.number}`,
    lead.email ? `${t(leadDetail.fieldEmail)} ${lead.email}` : null,
    lead.position ? `${t(leadDetail.fieldPosition)} ${lead.position}` : null,
    lead.companyName ? `${t(leadDetail.fieldCompany)} ${lead.companyName}` : null,
    lead.industry ? `${t(leadDetail.fieldIndustry)} ${lead.industry}` : null,
    lead.requirements ? `${t(leadDetail.fieldRequirements)} ${lead.requirements}` : null,
    lead.description ? `${t(leadDetail.fieldNotes)} ${lead.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={btnGhost}
    >
      {copied ? t(leadForm.copied) : t(leadForm.copyData)}
    </button>
  );
}

export function DeleteLeadButton({ leadId, redirectTo = "/b-systems/crm" }: { leadId: string; redirectTo?: string }) {
  const t = tFor(useLocale());
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn-danger"
      >
        {t(leadForm.deleteLead)}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-sm text-brand-danger">{error}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/b-systems/leads/${leadId}`, { method: "DELETE" });
          setBusy(false);
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            setError(data?.error ?? t(leadForm.deleteFailed));
            return;
          }
          router.push(redirectTo);
          router.refresh();
        }}
        className="btn-danger btn-danger--solid disabled:opacity-50"
      >
        {t(leadForm.confirmDelete)}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={btnGhost}>
        {t(leadForm.keepIt)}
      </button>
    </span>
  );
}

/* V2 — every role adds leads from the board; the API buckets by role
   (admin→admin bucket, agent/partner→their own, sales→internal). */
export function BsAddLeadForm() {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        {t(leadForm.addLead)}
      </button>
    );
  }
  return (
    <div className="modal-overlay">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          const res = await fetch("/api/b-systems/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: String(fd.get("name")),
              number: String(fd.get("number")),
              email: String(fd.get("email") || "") || undefined,
              type: String(fd.get("type")),
              position: String(fd.get("position") || "") || undefined,
              companyName: String(fd.get("companyName") || "") || undefined,
              industry: String(fd.get("industry") || "") || undefined,
              requirements: String(fd.get("requirements") || "") || undefined,
              description: String(fd.get("description") || "") || undefined,
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
        className="modal w-full max-w-lg"
      >
        <div className="modal-head">
          <p className="modal-title">{t(leadForm.newLead)}</p>
        </div>
        <div className="modal-body modal-body--grid">
          {error ? <p className="text-sm text-brand-danger field--wide">{error}</p> : null}
          <label className="block">
            <span className={labelCls}>{t(common.name)}</span>
            <input type="text" name="name" required className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(common.number)}</span>
            <input type="tel" name="number" required className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(common.email)}</span>
            <input type="email" name="email" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(common.type)}</span>
            <select name="type" className={inputCls}>
              {LEAD_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {leadTypeLabel(locale, lt)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>{t(common.position)}</span>
            <input type="text" name="position" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(common.companyName)}</span>
            <input type="text" name="companyName" required className={inputCls} />
          </label>
          <label className="block field--wide">
            <span className={labelCls}>{t(common.industry)}</span>
            <input type="text" name="industry" className={inputCls} />
          </label>
          <label className="block field--wide">
            <span className={labelCls}>{t(common.requirements)}</span>
            <textarea name="requirements" rows={2} className={inputCls} />
          </label>
          <label className="block field--wide">
            <span className={labelCls}>{t(common.notes)}</span>
            <textarea name="description" rows={2} className={inputCls} />
          </label>
        </div>
        <div className="modal-foot">
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {t(leadForm.saveLead)}
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

export function EditLeadForm({ lead }: { lead: EditableLead }) {
  const locale = useLocale();
  const t = tFor(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnGhost}>
        {t(leadForm.editLead)}
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
        const res = await fetch(`/api/b-systems/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(fd.get("name")),
            number: String(fd.get("number")),
            email: String(fd.get("email") || "") || undefined,
            type: String(fd.get("type")),
            position: String(fd.get("position") || "") || undefined,
            companyName: String(fd.get("companyName") || "") || undefined,
            industry: String(fd.get("industry") || "") || undefined,
            requirements: String(fd.get("requirements") || "") || undefined,
            description: String(fd.get("description") || "") || undefined,
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
      className="card card-pad space-y-3 w-full"
    >
      <p className="u-h3">{t(leadForm.editLead)}</p>
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(common.name)}</span>
          <input type="text" name="name" required defaultValue={lead.name} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(common.number)}</span>
          <input type="tel" name="number" required defaultValue={lead.number} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(common.email)}</span>
          <input type="email" name="email" defaultValue={lead.email ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(common.type)}</span>
          <select name="type" defaultValue={lead.type} className={inputCls}>
            {LEAD_TYPES.map((lt) => (
              <option key={lt} value={lt}>
                {leadTypeLabel(locale, lt)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>{t(common.position)}</span>
          <input type="text" name="position" defaultValue={lead.position ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(common.company)}</span>
          <input type="text" name="companyName" required defaultValue={lead.companyName ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(common.industry)}</span>
          <input type="text" name="industry" defaultValue={lead.industry ?? ""} className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(common.requirements)}</span>
        <textarea name="requirements" rows={2} defaultValue={lead.requirements ?? ""} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(common.notes)}</span>
        <textarea name="description" rows={2} defaultValue={lead.description ?? ""} className={inputCls} />
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
