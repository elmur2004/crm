"use client";

import { useId } from "react";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { handOver } from "@/lib/i18n/dict/owners";

/* Founder (2026-11-08) — "when I log a follow-up, I should be able to assign it
   to somebody so they have that follow-up in their follow-up column … I can
   like redirect the lead for them for follow-up."

   The optional "Hand this follow-up to" select every follow-up form carries for
   the COMPANY ADMIN — both companies, on the board's drop window and on the lead
   page. Default: keep the current owner (no key on the wire). Picking somebody
   hands the lead to them in the same transaction as the follow-up.

   The options arrive pre-translated from the server (services/assignees.ts) and
   ONLY for the admin: a caller that passes none renders nothing, and the server
   refuses an assignee from anybody else with 403 — the select is navigation,
   the route is the wall. Tokens-only styling (the form field classes). */

export interface AssigneeOption {
  id: string;
  label: string;
}

/** The wire name, shared by the field and the payload helper. */
export const ASSIGN_TO_FIELD = "assignTo";

export function AssignToField({ options }: { options?: AssigneeOption[] }) {
  const t = tFor(useLocale());
  const id = useId();
  const hintId = `${id}-hint`;
  if (!options || options.length === 0) return null;
  /* The label points AT the select (htmlFor) rather than wrapping it: a label
     that contains a select folds the selected option's text into the control's
     accessible name ("Hand this follow-up to Keep the current owner"). The hint
     DESCRIBES the select rather than naming it, tied by aria-describedby. */
  return (
    <div className="block" data-assign-to>
      <label htmlFor={id} className="field-label block mb-1.5">
        {t(handOver.label)}
      </label>
      <select
        id={id}
        name={ASSIGN_TO_FIELD}
        defaultValue=""
        className="field-input"
        aria-describedby={hintId}
      >
        <option value="">{t(handOver.keep)}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <p id={hintId} className="field-hint mt-1">
        {t(handOver.hint)}
      </p>
    </div>
  );
}

/** The chosen assignee, or undefined for "keep the current owner" — an absent
    key, so a form without the field sends exactly what it always sent. */
export function assignToFromForm(fd: FormData): string | undefined {
  const raw = fd.get(ASSIGN_TO_FIELD);
  return typeof raw === "string" && raw !== "" ? raw : undefined;
}
