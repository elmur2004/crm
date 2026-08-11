"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessActivityField, businessActivityFrom } from "./forms";

/* Founder V4 — admin edit + delete for pipeline cards and directory partners. */

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";

function useAction() {
  const router = useRouter();
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
      setError(data?.error ?? "Something went wrong");
      return;
    }
    onOk?.();
    router.refresh();
  }
  return { busy, error, run, router };
}

export interface ProspectEditable {
  id: string;
  name: string;
  companyName: string;
  role: string | null;
  email: string | null;
  number: string;
  businessActivity: string;
  description: string | null;
}

export function EditProspectButton({ prospect }: { prospect: ProspectEditable }) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn--sm">
        Edit
      </button>
    );
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">Partnership CRM · Edit</p>
            <p className="modal-title">{prospect.companyName}</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
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
              {
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Name</span>
                <input type="text" name="name" required defaultValue={prospect.name} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Company name</span>
                <input type="text" name="companyName" required defaultValue={prospect.companyName} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Role</span>
                <input type="text" name="role" defaultValue={prospect.role ?? ""} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Number</span>
                <input type="tel" name="number" required defaultValue={prospect.number} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Email</span>
                <input type="email" name="email" defaultValue={prospect.email ?? ""} className={inputCls} />
              </label>
              <BusinessActivityField defaultValue={prospect.businessActivity} />
            </div>
            <label className="block">
              <span className={labelCls}>Description</span>
              <textarea name="description" rows={2} defaultValue={prospect.description ?? ""} className={inputCls} />
            </label>
          </div>
          <div className="modal-foot">
            <span className="modal-foot-note">Changes apply immediately.</span>
            <span className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary">
                Save
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
        Yes, delete
      </button>
      <button type="button" className="btn-ghost btn--sm" onClick={() => setConfirming(false)}>
        Keep it
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
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn--sm">
        Edit
      </button>
    );
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">Partners · Edit</p>
            <p className="modal-title">{partner.companyName}</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
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
                <span className={labelCls}>Company name</span>
                <input type="text" name="companyName" required defaultValue={partner.companyName} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Key person name</span>
                <input type="text" name="keyPersonName" required defaultValue={partner.keyPersonName} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Key person role</span>
                <input type="text" name="keyPersonRole" required defaultValue={partner.keyPersonRole} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Number</span>
                <input type="tel" name="number" required defaultValue={partner.number} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Email</span>
                <input type="email" name="email" defaultValue={partner.email ?? ""} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Importance</span>
                <select name="importance" required defaultValue={partner.importance} className={inputCls}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <BusinessActivityField defaultValue={partner.businessActivity} />
            </div>
            <label className="block">
              <span className={labelCls}>Address</span>
              <input type="text" name="address" required defaultValue={partner.address} className={inputCls} />
            </label>
          </div>
          <div className="modal-foot">
            <span className="modal-foot-note">Changes apply immediately.</span>
            <span className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary">
                Save
              </button>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
