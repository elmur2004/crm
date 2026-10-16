import { pendingAcctRedo, pendingAcctUndo } from "@/lib/services/accounting-undo";
import { requireAccountingPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import type { AcctCompany } from "@/lib/accounting/constants";
import { AcctUndoRedoButtons } from "./AcctUndoRedoButtons";

/* The accounting module's undo/redo control — AcctHead's slot, mirroring
   ADR-045's UndoControl for the CRM.

   SERVER-RENDERED, for UndoControl's reason: no polling. Every accounting
   mutation already ends in router.refresh() (see useAction in
   components/accounting/forms.tsx), which re-renders this page and therefore
   this control, so the pair appears the moment an undoable entry lands, flips
   the moment one is consumed, and goes away the moment both sides are empty.

   IT RENDERS NOTHING when neither side has anything. The pair is not permanent
   furniture — see the hide-vs-disable note in AcctUndoRedoButtons: once EITHER
   side is live both halves render, and the empty one is visibly unavailable
   rather than hidden, so the flip after a press is legible.

   WHY IT RESOLVES THE USER ITSELF instead of taking a `userId` prop the way
   UndoControl does. UndoControl is mounted ONCE, by the shell layout, which
   already holds the user. This control is mounted by AcctHead, which twelve
   pages render; threading an id through all twelve would mean twelve places a
   forgotten prop silently removes the control from one screen — the exact class
   of hole page-company-guards.integration.test exists to catch for the company
   guards. Asking the guard here costs one extra User read per accounting page
   render (the module is administrators only) and makes it impossible for a page
   to hand this control somebody else's identity. The guard is the same one the
   page above already passed, so it is a pass-through in practice. */

export async function AcctUndoRedo({ company }: { company: AcctCompany }) {
  const user = await requireAccountingPage();
  const [undo, redo] = await Promise.all([
    pendingAcctUndo(user.id, company),
    pendingAcctRedo(user.id, company),
  ]);
  if (!undo && !redo) return null;
  const locale = await getLocale();
  /* the label was finished in BOTH languages when the action happened, so the
     control always names exactly what it will reverse without re-deriving it
     from rows that may since have moved (ADR-045) */
  const pick = (offer: { label: string; labelAr: string } | null) =>
    offer ? (locale === "ar" ? offer.labelAr : offer.label) : null;
  return (
    <AcctUndoRedoButtons company={company} undoWhat={pick(undo)} redoWhat={pick(redo)} />
  );
}
