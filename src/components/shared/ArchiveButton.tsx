"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { archiveMsgs as m, common } from "@/lib/i18n/dict/crm";

/* Founder (ADR-043) — archive/unarchive from the lead detail. Archiving asks
   an inline confirm (the DeleteLeadButton pattern); unarchiving is one click.
   Both brands pass their own postUrl. */

export function ArchiveButton({
  postUrl,
  archived,
  confirmText,
}: {
  postUrl: string;
  archived: boolean;
  /** ADR-053: vault records reuse this button — their confirm copy must not
      say "lead". Defaults to the original lead wording. */
  confirmText?: string;
}) {
  const t = tFor(useLocale());
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: !archived }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t(m.archiveFailed));
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (archived) {
    return (
      <span className="inline-flex items-center gap-2">
        {error ? <span className="text-sm text-brand-danger">{error}</span> : null}
        <button type="button" disabled={busy} onClick={toggle} className="btn-ghost">
          {t(m.unarchive)}
        </button>
      </span>
    );
  }
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-ghost">
        {t(m.archive)}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="text-sm text-brand-muted">{confirmText ?? t(m.confirmArchive)}</span>
      {error ? <span className="text-sm text-brand-danger">{error}</span> : null}
      <button type="button" disabled={busy} onClick={toggle} className="btn-primary">
        {t(m.archive)}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="btn-ghost">
        {t(common.cancel)}
      </button>
    </span>
  );
}
