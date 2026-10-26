"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/* Founder 2.3 (ADR-062) — "Add a checkbox next to every task in the To-Do
   List." A real native checkbox on the MilestoneCheckbox pattern (aria label,
   one request at a time, POST + router.refresh, inline error) — brand-neutral
   and STRING-FREE (ADR-042: every label arrives pre-translated as a prop, so
   no locale plumbing leaks into the shared graph). Checking posts done: true;
   in the Done section the same control posts done: false — the restore. The
   auto-completed rows render it disabled: reversing the CRM is a CRM action,
   not a To-Do action.

   The CRM body pass — the tick ANSWERS at once. While the request is in
   flight the box shows the state it was just set to (the row strikes its
   title through and quiets — crm.css `.todo-row`), so the press reads the
   moment it lands; the refresh then moves the row under Done (or back to
   Today). If the request fails, the box returns to the server's state and the
   inline error says the tick did not land — nothing is ever shown as done
   that the server did not record. The request itself is unchanged.

   The label wraps the box so a touch screen gets a 44px target (crm.css
   `.todo-check`); the accessible name is still the input's own aria-label. */
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
  /* the state the press asked for, shown while it is in flight — the request
     AND the refresh that brings the row's new place (a transition, so React
     says when the refreshed page has landed) */
  const [pending, setPending] = useState<boolean | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inFlight = busy || refreshing;
  return (
    <span className="todo-check-wrap inline-flex items-center gap-1.5">
      <label className="todo-check">
        <input
          type="checkbox"
          checked={inFlight && pending !== null ? pending : checked}
          /* while a tick is in flight the box keeps its full colour (a
             disabled box greys out, which read as "it did not take") and
             simply refuses a second press; it says so to a screen reader */
          disabled={disabled}
          aria-disabled={inFlight || undefined}
          aria-busy={inFlight || undefined}
          aria-label={ariaLabel}
          data-kind={kind}
          data-record-id={recordId}
          onChange={async (e) => {
            if (inFlight) return; // one request at a time — the box stays as shown
            const done = e.target.checked;
            setBusy(true);
            setPending(done);
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
                setPending(null); // the tick did not land: show the server's state
                return;
              }
              startRefresh(() => router.refresh());
            } catch {
              setError(errorText);
              setPending(null);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {error ? <span className="row-error text-xs text-brand-danger">{error}</span> : null}
    </span>
  );
}
