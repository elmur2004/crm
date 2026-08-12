"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { toPiasters, toPounds } from "@/lib/money";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { leadTypeLabel } from "@/lib/i18n/dict/labels";
import { common, formsDict } from "@/lib/i18n/dict/internal";

/* Client-side forms for the internal CRMs (Apps A & B) — POST to the brand's API
   namespace, refresh on success. Tokens-only styling. */

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";
const btnPrimary = "btn-primary";

function useSubmit() {
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(url: string, method: string, body: unknown, onDone?: () => void) {
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
      setError(data?.error ?? tFor(locale)(common.somethingWentWrong));
      return false;
    }
    onDone?.();
    router.refresh();
    return true;
  }
  return { busy, error, submit };
}

export function AddRepForm({ apiBase }: { apiBase: string }) {
  const { busy, error, submit } = useSubmit();
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        {t(formsDict.addSalesRep)}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void submit(`${apiBase}/reps`, "POST", { name: String(fd.get("name")) }, () =>
          setOpen(false),
        );
      }}
      className="flex items-end gap-2"
    >
      <label className="block">
        <span className={labelCls}>{t(formsDict.repName)}</span>
        <input type="text" name="name" required className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(formsDict.add)}
      </button>
      {error ? <p className="alert-error">{error}</p> : null}
    </form>
  );
}

export function AddLeadForm({ apiBase, salesRepId }: { apiBase: string; salesRepId?: string }) {
  const { busy, error, submit } = useSubmit();
  const locale = useLocale();
  const t = tFor(locale);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        {t(formsDict.addLead)}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void submit(
          `${apiBase}/leads`,
          "POST",
          {
            salesRepId,
            name: String(fd.get("name")),
            number: String(fd.get("number")),
            email: String(fd.get("email") || "") || undefined,
            type: String(fd.get("type")),
            description: String(fd.get("description") || "") || undefined,
          },
          () => setOpen(false),
        );
      }}
      className="card card-pad space-y-3"
    >
      <p className="u-h3">{t(formsDict.newLead)}</p>
      {error ? <p className="alert-error">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(formsDict.name)}</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(formsDict.number)}</span>
          <input type="tel" name="number" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(formsDict.email)}</span>
          <input type="email" name="email" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t(formsDict.type)}</span>
          <select name="type" required className={inputCls}>
            {LEAD_TYPES.map((lt) => (
              <option key={lt} value={lt}>
                {leadTypeLabel(locale, lt)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t(formsDict.description)}</span>
        <textarea name="description" rows={2} className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(formsDict.saveLead)}
      </button>
    </form>
  );
}

export function ClientEditForm({
  apiBase,
  client,
}: {
  apiBase: string;
  client: {
    id: string;
    service: string | null;
    estimatedValue: number | null;
    collected: number | null;
    toBeCollected: number | null;
    dueDate: Date | null;
    retainer: boolean;
    technicalOwner: string | null;
  };
}) {
  const { busy, error, submit } = useSubmit();
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-brand-link underline underline-offset-2"
      >
        {t(formsDict.edit)}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const num = (k: string) => {
          const v = String(fd.get(k) || "");
          return v ? toPiasters(v) : null;
        };
        void submit(
          `${apiBase}/clients/${client.id}`,
          "PATCH",
          {
            service: String(fd.get("service") || "") || null,
            estimatedValue: num("estimatedValue"),
            collected: num("collected"),
            toBeCollected: num("toBeCollected"),
            dueDate: String(fd.get("dueDate") || "") || null,
            retainer: fd.get("retainer") === "on",
            technicalOwner: String(fd.get("technicalOwner") || "") || null,
          },
          () => setOpen(false),
        );
      }}
      className="mt-2 space-y-2"
    >
      {error ? <p className="alert-error">{error}</p> : null}
      <label className="block">
        <span className={labelCls}>{t(common.service)}</span>
        <input type="text" name="service" defaultValue={client.service ?? ""} className={inputCls} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className={labelCls}>{t(formsDict.estimated)}</span>
          <input
            type="number"
            name="estimatedValue"
            min="0"
            step="0.01"
            defaultValue={client.estimatedValue != null ? toPounds(client.estimatedValue) : undefined}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t(formsDict.collected)}</span>
          <input
            type="number"
            name="collected"
            min="0"
            step="0.01"
            defaultValue={client.collected != null ? toPounds(client.collected) : undefined}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t(formsDict.toBeCollected)}</span>
          <input
            type="number"
            name="toBeCollected"
            min="0"
            step="0.01"
            defaultValue={client.toBeCollected != null ? toPounds(client.toBeCollected) : undefined}
            className={inputCls}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>{t(formsDict.collectionDueDate)}</span>
          <input
            type="date"
            name="dueDate"
            defaultValue={client.dueDate ? client.dueDate.toISOString().slice(0, 10) : undefined}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t(common.technicalOwner)}</span>
          <input
            type="text"
            name="technicalOwner"
            defaultValue={client.technicalOwner ?? ""}
            className={inputCls}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="retainer" defaultChecked={client.retainer} /> {t(formsDict.retainer)}
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {t(common.save)}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost"
        >
          {t(common.cancel)}
        </button>
      </div>
    </form>
  );
}
