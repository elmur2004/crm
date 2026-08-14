import { pendingUndoFor } from "@/lib/services/undo";
import { getLocale } from "@/lib/i18n/server";
import { UndoButton } from "./UndoButton";

/* ADR-045 — the header slot. Server-rendered on purpose: no polling, and the
   shells re-render on every router.refresh() (which every mutation already
   does), so the control appears the moment an undoable action lands and
   disappears the moment it is consumed. It renders NOTHING when there is
   nothing to undo. */

export async function UndoControl({ userId }: { userId: string }) {
  const pending = await pendingUndoFor(userId);
  if (!pending) return null;
  const locale = await getLocale();
  return <UndoButton description={locale === "ar" ? pending.labelAr : pending.label} />;
}
