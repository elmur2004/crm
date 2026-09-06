"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { formatMoney } from "@/lib/money";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { common } from "@/lib/i18n/dict/crm";
import { subService as d } from "@/lib/i18n/dict/crm";

/* ADR-077 — THE ONE CONTROL THAT WRITES on a foreign lead's page.

   ADR-075/076 built that page as "nothing writes — not disabled versions of the
   controls, ABSENT", and that rule is what makes a read-only window honest. The
   founder then asked for exactly one exception: "the admin and the admin only
   is allowed to customize the proposal that is appearing in the ByteForce CRM."

   So this is the exception, and it is deliberately shaped to stay one:

   · it edits NOTHING of Mindoo's. The service and the riyal figure the prospect
     was quoted are shown beside it and are not fields — this form owns two
     columns that exist only for ByteForce's half of the deal.
   · it posts to ONE endpoint that admits one role.
   · it is rendered only where the server has already decided the reader is the
     platform administrator, so there is no "is the button disabled" state to
     get wrong.

   Two currencies on one screen, which is the point of the whole feature: the
   client is quoted in riyals and ByteForce is owed in pounds. Both go through
   formatMoney with their OWN brand — never converted, never summed. */

export function SubServiceForm({
  leadId,
  apiBase,
  hasProposal,
  mindooService,
  mindooValue,
  current,
}: {
  leadId: string;
  /* ADR-078 — this surface's namespace. The panel lives in TWO places now (the
     founder, asked where he expected it: "both places") — Mindoo's own lead
     detail while the proposal is being sent, and the purple card in the
     ByteForce CRM afterwards. Each posts to its own company's route, because
     the brand is derived from the route and never from input. */
  apiBase: string;
  /* ADR-077 — a sub-service ANNOTATES a proposal, so a lead that has not been
     quoted yet has nothing to annotate. Told explicitly rather than inferred
     from a null value, because "quoted at nothing" and "not quoted" are
     different facts — and offering a button whose endpoint would answer "this
     lead has no proposal yet" is the always-fails control this project has
     already shipped once (ADR-073) and keeps taking back out. */
  hasProposal: boolean;
  /** what the prospect was quoted, and in what — shown, never editable here */
  mindooService: string | null;
  mindooValue: number | null;
  current: { service: string; value: number } | null;
}) {
  const t = tFor(useLocale());
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PUT" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(`${apiBase}/company-leads/${leadId}/sub-service`, {
      method,
      ...(body
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t(common.somethingWentWrong));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="card card--flush0">
      <div className="card-head">
        <h2 className="u-h3">{t(d.heading)}</h2>
      </div>
      <div className="card-pad space-y-3 text-sm">
        {/* MINDOO'S half — the number and the service the prospect actually
            got, in Mindoo's own currency. Read-only by construction. */}
        <div className="money-tile">
          <p className="money-label">{t(d.quotedToClient)}</p>
          <p className="money-value">{formatMoney(mindooValue, "mindoo")}</p>
          {mindooService ? <p className="record-time">{mindooService}</p> : null}
        </div>

        {error ? <p className="alert-error">{error}</p> : null}

        {!hasProposal ? (
          <p className="u-muted">{t(d.noProposal)}</p>
        ) : !open ? (
          <>
            {current ? (
              <div className="ms-row">
                <span className="ms-label">{current.service}</span>
                <span className="ms-note ms-auto text-end">
                  {formatMoney(current.value, "byteforce")}
                </span>
              </div>
            ) : (
              <p className="u-muted">{t(d.none)}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
                {current ? t(d.edit) : t(d.add)}
              </button>
              {current ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send("DELETE")}
                  className={btnGhost}
                >
                  {t(d.remove)}
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await send("PUT", {
                service: String(fd.get("service") ?? ""),
                value: String(fd.get("value") ?? ""),
              });
            }}
          >
            <label className="block">
              <span className={labelCls}>{t(d.fieldService)}</span>
              <input
                type="text"
                name="service"
                required
                defaultValue={current?.service ?? ""}
                className={inputCls}
              />
            </label>
            <label className="block">
              {/* the currency is IN THE LABEL, because this is the one field on
                  the platform where typing into the wrong currency is a real
                  mistake a person could make */}
              <span className={labelCls}>{t(d.fieldValue)}</span>
              <input
                type="number"
                name="value"
                min="0"
                step="0.01"
                required
                defaultValue={current ? current.value / 100 : ""}
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
        )}
        <p className="panel-hint">{t(d.hint)}</p>
      </div>
    </div>
  );
}
