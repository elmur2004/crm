"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { common } from "@/lib/i18n/dict/crm";
import { entryPage as d } from "@/lib/i18n/dict/entry";

/* ADR-051 — "correct what I just typed". Deliberately NOT a lead editor: it
   offers the four fields a typo actually lands in, and it only ever appears on
   a row the server has already agreed is still correctable (the same rule is
   re-checked server-side on every PATCH — this is convenience, not the gate). */

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";

export function CorrectEntryButtons({
  kind,
  id,
  withCompany = true,
  defaults,
}: {
  kind: "lead" | "prospect";
  id: string;
  /** an agent card carries no company name, so the field is not offered */
  withCompany?: boolean;
  defaults: {
    name: string;
    number: string;
    email: string | null;
    companyName: string | null;
  };
}) {
  const router = useRouter();
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn--sm">
        {t(d.correct)}
      </button>
    );
  }

  const url =
    kind === "lead" ? `/api/b-systems/leads/${id}` : `/api/b-systems/partners-pipeline/${id}`;

  return (
    <div className="modal-overlay">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: String(fd.get("name")),
              number: String(fd.get("number")),
              email: String(fd.get("email") || "") || undefined,
              ...(withCompany
                ? { companyName: String(fd.get("companyName") || "") || undefined }
                : {}),
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
          <p className="modal-title">{t(d.correct)}</p>
        </div>
        <div className="modal-body space-y-3">
          {error ? <p role="alert" className="alert-error">{error}</p> : null}
          <label className="block">
            <span className={labelCls}>{t(common.name)}</span>
            <input type="text" name="name" required defaultValue={defaults.name} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(common.number)}</span>
            <input type="tel" dir="ltr" name="number" required defaultValue={defaults.number} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(common.email)}</span>
            <input type="email" dir="ltr" name="email" defaultValue={defaults.email ?? ""} className={inputCls} />
          </label>
          {withCompany ? (
            <label className="block">
              <span className={labelCls}>{t(common.companyName)}</span>
              <input
                type="text"
                name="companyName"
                defaultValue={defaults.companyName ?? ""}
                className={inputCls}
              />
            </label>
          ) : null}
        </div>
        <div className="modal-foot">
          <span className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {t(common.cancel)}
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {t(common.save)}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}
