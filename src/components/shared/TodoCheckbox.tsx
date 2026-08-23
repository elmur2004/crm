"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Founder 2.3 (ADR-062) — "Add a checkbox next to every task in the To-Do
   List." A real native checkbox on the MilestoneCheckbox pattern (aria label,
   disabled-while-busy, POST + router.refresh, inline error) — brand-neutral
   and STRING-FREE (ADR-042: every label arrives pre-translated as a prop, so
   no locale plumbing leaks into the shared graph). Checking posts done: true;
   in the Done section the same control posts done: false — the restore. The
   auto-completed rows render it disabled: reversing the CRM is a CRM action,
   not a To-Do action. */
export function TodoCheckbox({
  apiBase,
  kind,
  recordId,
  checked,
  disabled,
  ariaLabel,
  errorText,
}: {
  apiBase: string; // "/api/b-systems" | "/api/byteforce" — the page's own namespace
  kind: string;
  recordId: string;
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  errorText: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || busy}
        aria-label={ariaLabel}
        data-kind={kind}
        data-record-id={recordId}
        onChange={async (e) => {
          const done = e.target.checked;
          setBusy(true);
          setError(null);
          /* Review: a REJECTED fetch (offline, server restart mid-request) is
             not a non-ok response — without this catch it escapes the handler
             and leaves `busy` true, killing the row's checkbox until a reload.
             `finally` re-enables the control so the founder can just click
             again; the pre-translated message says the tick did not land. */
          try {
            const res = await fetch(`${apiBase}/todo/done`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, recordId, done }),
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as { error?: string } | null;
              setError(data?.error ?? errorText);
              return;
            }
            router.refresh();
          } catch {
            setError(errorText);
          } finally {
            setBusy(false);
          }
        }}
      />
      {error ? <span className="text-xs text-brand-danger">{error}</span> : null}
    </span>
  );
}
