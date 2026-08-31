"use client";

import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { calendarPage as m } from "@/lib/i18n/dict/calendar";

/* ADR-071 — "Also blocks", on the Meeting Setting form.

   Founder: "whenever X is setting a meeting and Y has to be in this meeting, X
   will look at the calendar and see if Y has any other meetings." This is the
   half that puts Y there — without it the calendar can only ever know about the
   lead's OWNER, and the case he described is the one it cannot answer.

   Deliberately checkboxes rather than a multi-select: a native <select multiple>
   needs a ctrl-click to add a second name and silently drops the first without
   it, which on a form that only submits once is a mistake you find out about a
   week later, on the day of the meeting.

   Rendered ONLY when a roster is passed. Every existing call site omits it and
   is unchanged; the field is optional in the schema and absent on the wire. */

export interface MeetingPerson {
  id: string;
  name: string;
}

export function MeetingAlsoBlocks({
  people,
  selected,
}: {
  people: MeetingPerson[];
  /** ids to pre-tick — the current attendees when editing. */
  selected?: string[];
}) {
  const t = tFor(useLocale());
  if (people.length === 0) return null;
  const ticked = new Set(selected ?? []);
  return (
    <fieldset className="block">
      <legend className="field-label">{t(m.alsoBlocks)}</legend>
      <p className="field-hint" style={{ marginBottom: "6px" }}>
        {t(m.alsoBlocksHint)}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 14px",
          maxHeight: "9rem",
          overflowY: "auto",
        }}
      >
        {people.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="attendeeUserIds"
              value={p.id}
              defaultChecked={ticked.has(p.id)}
            />
            <span>{p.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
