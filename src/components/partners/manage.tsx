"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AgentProspectFields,
  BusinessActivityField,
  PartnerProspectFields,
  agentNameFrom,
  businessActivityFrom,
} from "./forms";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import {
  importanceOptionLabel,
  pCommon,
  pForms,
  pManage,
  prospectKindLabel,
} from "@/lib/i18n/dict/partners";
import { fields as authFields, signup } from "@/lib/i18n/dict/auth";

/* Founder V4 — admin edit + delete for pipeline cards and directory partners. */

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";

function useAction() {
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(url: string, method: string, body?: unknown, onOk?: () => void) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? tFor(locale)(pCommon.somethingWrong));
      return;
    }
    onOk?.();
    router.refresh();
  }
  return { busy, error, run, router };
}

export interface ProspectEditable {
  id: string;
  /** partner | agent — fixed at creation, so the modal shows THAT field set */
  kind: string;
  name: string;
  companyName: string | null;
  role: string | null;
  email: string | null;
  number: string;
  businessActivity: string | null;
  address: string | null;
  speciality: string | null;
  description: string | null;
}

export function EditProspectButton({ prospect }: { prospect: ProspectEditable }) {
  const { busy, error, run } = useAction();
  const locale = useLocale();
  const t = tFor(locale);
  const [open, setOpen] = useState(false);
  const agent = prospect.kind === "agent";
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn--sm">
        {t(pCommon.edit)}
      </button>
    );
  }
  const [first = "", ...rest] = prospect.name.trim().split(/\s+/);
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">{t(pManage.prospectEyebrow)}</p>
            <p className="modal-title">{prospect.companyName ?? prospect.name}</p>
          </div>
          <button type="button" className="modal-close" aria-label={t(pCommon.close)} onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run(
              `/api/b-systems/partners-pipeline/${prospect.id}`,
              "PATCH",
              agent
                ? {
                    /* the kind is NOT in the payload: it is immutable, and the
                       server ignores the other kind's columns anyway */
                    name: agentNameFrom(fd),
                    email: String(fd.get("email") || "") || undefined,
                    number: String(fd.get("number")),
                    address: String(fd.get("address")),
                    speciality: String(fd.get("speciality")),
                    description: String(fd.get("description") || "") || undefined,
                  }
                : {
                    name: String(fd.get("name")),
                    companyName: String(fd.get("companyName")),
                    role: String(fd.get("role") || "") || undefined,
                    email: String(fd.get("email") || "") || undefined,
                    number: String(fd.get("number")),
                    businessActivity: businessActivityFrom(fd),
                    description: String(fd.get("description") || "") || undefined,
                  },
              () => setOpen(false),
            );
          }}
          className="contents"
        >
          <div className="modal-body space-y-3">
            {error ? <p className="alert-error">{error}</p> : null}
            <p>
              <span className="badge badge--entity">{prospectKindLabel(locale, prospect.kind)}</span>
            </p>
            <p className="field-hint">{t(pForms.kindLockedPipelines)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agent ? (
                <AgentProspectFields
                  withCv={false}
                  defaults={{
                    firstName: first,
                    lastName: rest.join(" "),
                    number: prospect.number,
                    email: prospect.email,
                    address: prospect.address,
                    speciality: prospect.speciality,
                  }}
                />
              ) : (
                <PartnerProspectFields defaults={prospect} />
              )}
            </div>
            <label className="block">
              <span className={labelCls}>{t(pCommon.description)}</span>
              <textarea name="description" rows={2} defaultValue={prospect.description ?? ""} className={inputCls} />
            </label>
          </div>
          <div className="modal-foot">
            <span className="modal-foot-note">{t(pCommon.changesApply)}</span>
            <span className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                {t(pCommon.cancel)}
              </button>
              <button type="submit" disabled={busy} className="btn-primary">
                {t(pCommon.save)}
              </button>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DeleteEntityButton({
  url,
  label,
  warning,
  redirectTo,
}: {
  url: string;
  label: string;
  warning: string;
  redirectTo: string;
}) {
  const { busy, error, run, router } = useAction();
  const locale = useLocale();
  const t = tFor(locale);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-danger btn--sm">
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {error ? <span className="text-brand-danger text-xs">{error}</span> : null}
      <span className="u-muted">{warning}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(url, "DELETE", undefined, () => router.push(redirectTo))}
        className="btn-danger btn-danger--solid btn--sm"
      >
        {t(pManage.yesDelete)}
      </button>
      <button type="button" className="btn-ghost btn--sm" onClick={() => setConfirming(false)}>
        {t(pManage.keepIt)}
      </button>
    </span>
  );
}

export interface PartnerEditable {
  id: string;
  companyName: string;
  keyPersonName: string;
  keyPersonRole: string;
  address: string;
  number: string;
  email: string | null;
  businessActivity: string;
  importance: string;
}

export function EditPartnerButton({ partner }: { partner: PartnerEditable }) {
  const { busy, error, run } = useAction();
  const locale = useLocale();
  const t = tFor(locale);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn--sm">
        {t(pCommon.edit)}
      </button>
    );
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">{t(pManage.partnerEyebrow)}</p>
            <p className="modal-title">{partner.companyName}</p>
          </div>
          <button type="button" className="modal-close" aria-label={t(pCommon.close)} onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run(
              `/api/b-systems/partners/${partner.id}`,
              "PATCH",
              {
                companyName: String(fd.get("companyName")),
                keyPersonName: String(fd.get("keyPersonName")),
                keyPersonRole: String(fd.get("keyPersonRole")),
                address: String(fd.get("address")),
                number: String(fd.get("number")),
                email: String(fd.get("email") || "") || undefined,
                businessActivity: businessActivityFrom(fd),
                importance: String(fd.get("importance")),
              },
              () => setOpen(false),
            );
          }}
          className="contents"
        >
          <div className="modal-body space-y-3">
            {error ? <p className="alert-error">{error}</p> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>{t(pCommon.companyName)}</span>
                <input type="text" name="companyName" required defaultValue={partner.companyName} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>{t(pCommon.keyPersonName)}</span>
                <input type="text" name="keyPersonName" required defaultValue={partner.keyPersonName} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>{t(pCommon.keyPersonRole)}</span>
                <input type="text" name="keyPersonRole" required defaultValue={partner.keyPersonRole} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>{t(pCommon.number)}</span>
                <input type="tel" name="number" required defaultValue={partner.number} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>{t(signup.email)}</span>
                <input type="email" name="email" defaultValue={partner.email ?? ""} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>{t(pCommon.importance)}</span>
                <select name="importance" required defaultValue={partner.importance} className={inputCls}>
                  <option value="high">{importanceOptionLabel(locale, "high")}</option>
                  <option value="medium">{importanceOptionLabel(locale, "medium")}</option>
                  <option value="low">{importanceOptionLabel(locale, "low")}</option>
                </select>
              </label>
              <BusinessActivityField defaultValue={partner.businessActivity} />
            </div>
            <label className="block">
              <span className={labelCls}>{t(authFields.address)}</span>
              <input type="text" name="address" required defaultValue={partner.address} className={inputCls} />
            </label>
          </div>
          <div className="modal-foot">
            <span className="modal-foot-note">{t(pCommon.changesApply)}</span>
            <span className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                {t(pCommon.cancel)}
              </button>
              <button type="submit" disabled={busy} className="btn-primary">
                {t(pCommon.save)}
              </button>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
