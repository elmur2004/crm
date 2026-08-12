"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { common, registrations as d } from "@/lib/i18n/dict/admin";

/* Founder: the Registrations page is the approval cycle — approve or decline
   pending sign-ups. */

export function RegistrationActions({ userId }: { userId: string }) {
  const router = useRouter();
  const t = tFor(useLocale());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/b-systems/registrations/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t(common.somethingWentWrong));
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2 flex-wrap">
      {error ? <span className="text-brand-danger text-xs">{error}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void act("approve")}
        className="row-toggle row-toggle--restore"
      >
        {t(d.approve)}
      </button>
      <button type="button" disabled={busy} onClick={() => void act("reject")} className="row-toggle">
        {t(d.reject)}
      </button>
    </span>
  );
}
