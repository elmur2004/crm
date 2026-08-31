"use client";

import { useState } from "react";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { POSTPONE_REASONS, type PostponeReason } from "@/lib/pipeline-engine/constants";
import { postponeReasonMsgs } from "@/lib/i18n/dict/labels";
import { postponeMsgs as m } from "@/lib/i18n/dict/postpone";
import { inputCls, labelCls } from "@/components/portal/groupForms";

/* ============================================================================
   ADR-072 — the popup the founder described before he described the column.

   "When we move the lead there, the pop up will be: is he not answering at all,
   or is he no show in the meeting, or is he not interested right now at all?
   These will be the three options, and there will be the option 'other'
   written by the user."

   ONE component for BOTH internal CRMs (ByteForce and B-Systems), because his
   three options are the same three on either board and a second copy is a
   second place for them to drift. It is imported by both form modules, which is
   the same shape MeetingAlsoBlocks took in ADR-071.

   RADIOS, not a select: four options is under the threshold where a dropdown
   earns its collapse, and a radio group shows all four without a click — which
   matters on the one form whose entire purpose is choosing between them.

   The free-text box appears ONLY under "Other" and is REQUIRED there (the Zod
   refine says the same thing server-side). Under the three named reasons the
   same box is offered as an optional note: a no-show is fully described by its
   name, and forcing a sentence there is how "asd" ends up in the record.
   ========================================================================== */

export function PostponeFields() {
  const t = tFor(useLocale());
  const [reason, setReason] = useState<PostponeReason>("not_answering");
  const isOther = reason === "other";

  return (
    <>
      <fieldset className="block">
        <legend className={labelCls}>{t(m.question)}</legend>
        <p className="field-hint" style={{ marginBottom: "8px" }}>
          {t(m.hint)}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {POSTPONE_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                required
              />
              <span>{t(postponeReasonMsgs[r]!)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={labelCls}>{t(isOther ? m.otherLabel : m.noteLabel)}</span>
        <textarea
          name="note"
          rows={2}
          maxLength={1000}
          className={inputCls}
          /* required only under Other — the browser and the server agree,
             and neither is trusted to be the only one that checks */
          required={isOther}
          placeholder={isOther ? t(m.otherPlaceholder) : ""}
        />
      </label>
    </>
  );
}

/** FormData → the group payload. Shared by both boards' builders so the wire
    shape is decided once. An empty note is sent as `undefined`, never `""`. */
export function postponePayload(fd: FormData) {
  const note = String(fd.get("note") || "").trim();
  return {
    group: "postpone" as const,
    data: {
      reason: String(fd.get("reason")) as PostponeReason,
      note: note || undefined,
    },
  };
}
