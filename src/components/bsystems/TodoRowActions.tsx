import { tFor, type Locale } from "@/lib/i18n/core";
import { ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { ownerFilters } from "@/lib/i18n/dict/crm";
import type { TodoItem } from "@/lib/services/todo";
import { AssignLeadButton, TakeLeadButton, type AssignableOwner } from "./leadActions";

/* Founder — "I can assign these to do as an admin or just take it myself":
   the B-Systems admin's To-Do row controls. They live HERE, not in
   components/shared/TodoBody, so the brand-neutral list never pulls the
   B-Systems lead-action client module into the ByteForce To-Do route's graph —
   the page hands them to TodoBody as a render prop instead. The real wall is
   still server-side: requireBsAdmin on /api/b-systems/leads/[id]/assign. */
export interface TodoAssign {
  owners: AssignableOwner[];
  selfUserId: string;
  locale: Locale;
}

/* The owner chip the rest of the app shows: bucket first, then the name —
   owner account, else internal rep, else the referring partner company
   (todoFor resolves that order). "Unassigned" is reserved for what ADR-051
   defines it as: the internal bucket with no rep and no account. */
export function todoOwnerLabel(locale: Locale, item: TodoItem): string {
  if (!item.ownerType) return item.ownerName ?? tFor(locale)(ownerFilters.unassigned);
  const bucket = ownerTypeLabel(locale, item.ownerType);
  if (item.ownerName) return `${bucket} · ${item.ownerName}`;
  return item.ownerType === "internal" ? tFor(locale)(ownerFilters.unassigned) : bucket;
}

export function TodoRowActions({ item, assign }: { item: TodoItem; assign: TodoAssign }) {
  /* Prospect, statement and milestone rows are admin-owned subsystems with
     nobody to hand them to — they carry no leadId, so they stay bare lines. */
  if (!item.leadId) return null;
  return (
    <span className="ms-auto inline-flex items-center gap-2">
      <span className="text-xs text-brand-muted">{todoOwnerLabel(assign.locale, item)}</span>
      <AssignLeadButton
        leadId={item.leadId}
        owners={assign.owners}
        currentOwnerUserId={item.ownerUserId ?? null}
        small
      />
      {item.ownerUserId === assign.selfUserId ? null : (
        <TakeLeadButton leadId={item.leadId} selfUserId={assign.selfUserId} />
      )}
    </span>
  );
}
