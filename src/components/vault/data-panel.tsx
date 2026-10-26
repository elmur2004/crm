"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { vault } from "@/lib/i18n/dict/vault";

/* ADR-054, founder directive B — the vault module's own Import and Export.
   Export downloads the module-scoped backup (rows + files, base64) straight
   from the admin-only GET; Import REPLACES the vault's data with an uploaded
   export — destructive, so the button stays disabled until the confirm box is
   ticked (the UI confirm step; the server wall is requireBsAdmin).

   The glass pass draws the import as its three steps on one rail (.mod-steps,
   modules.css — the accounting import's own): the file, the confirmation,
   the import. The same controls; the rail is drawing. */

export function VaultDataPanel() {
  const t = tFor(useLocale());
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [hasFile, setHasFile] = useState(false);
  /* where the flow stands — drives the rail only */
  const fileStep = hasFile ? "done" : "current";
  const confirmStep = confirmed || counts ? "done" : hasFile ? "current" : "todo";
  const runStep = counts ? "done" : confirmed ? "current" : "todo";

  return (
    <section className="card card-pad space-y-4">
      <h2 className="u-h3">{t(vault.dataTitle)}</h2>
      <div className="flex flex-wrap gap-3 items-center">
        <a href="/api/vault/export" className="btn-ghost" download>
          {t(vault.exportButton)}
        </a>
        <span className="u-muted">{t(vault.exportHint)}</span>
      </div>

      <form
        className="space-y-4 mod-steps"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          setCounts(null);
          const res = await fetch("/api/vault/import", { method: "POST", body: fd });
          setBusy(false);
          const data = (await res.json().catch(() => null)) as
            | ({ counts?: Record<string, number> } & { error?: string })
            | null;
          if (!res.ok || !data?.counts) {
            setError(data?.error ?? t(vault.somethingWentWrong));
            return;
          }
          setCounts(data.counts);
          setConfirmed(false);
          router.refresh();
        }}
      >
        <p className="alert-error">{t(vault.importReplaceWarning)}</p>
        <div className="mod-step" data-state={fileStep}>
          <label className="field">
            <span className="field-label">{t(vault.importFile)}</span>
            <input
              name="export"
              type="file"
              accept="application/json,.json"
              required
              className="field-input"
              onChange={(e) => setHasFile(Boolean(e.currentTarget.files?.length))}
            />
          </label>
        </div>
        <div className="mod-step" data-state={confirmStep}>
          <label className="flex items-center gap-2 mod-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.currentTarget.checked)}
            />
            <span>{t(vault.importConfirm)}</span>
          </label>
        </div>
        <div className="mod-step space-y-3" data-state={runStep}>
          <button type="submit" className="btn-danger" disabled={busy || !confirmed}>
            {t(busy ? vault.importWorking : vault.importRun)}
          </button>
          {error ? <p className="alert-error">{error}</p> : null}
          {counts ? (
            <div className="mod-result">
              <p className="u-muted">
                {t(vault.importDone)}{" "}
                <span className="u-mono u-ltr">
                  {Object.entries(counts)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </span>
              </p>
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}
