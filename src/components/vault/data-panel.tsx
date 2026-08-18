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
   ticked (the UI confirm step; the server wall is requireBsAdmin). */

export function VaultDataPanel() {
  const t = tFor(useLocale());
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

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
        className="space-y-3"
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
        <label className="field">
          <span className="field-label">{t(vault.importFile)}</span>
          <input name="export" type="file" accept="application/json,.json" required className="field-input" />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.currentTarget.checked)}
          />
          <span>{t(vault.importConfirm)}</span>
        </label>
        <button type="submit" className="btn-danger" disabled={busy || !confirmed}>
          {t(busy ? vault.importWorking : vault.importRun)}
        </button>
        {error ? <p className="alert-error">{error}</p> : null}
        {counts ? (
          <p className="u-muted">
            {t(vault.importDone)}{" "}
            <span className="u-mono u-ltr">
              {Object.entries(counts)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </span>
          </p>
        ) : null}
      </form>
    </section>
  );
}
