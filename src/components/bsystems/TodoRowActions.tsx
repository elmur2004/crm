import { tFor, type Locale } from "@/lib/i18n/core";
import { ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { ownerFilters } from "@/lib/i18n/dict/crm";
import { common as bfCommon } from "@/lib/i18n/dict/internal";
import type { TodoItem } from "@/lib/services/todo";
import { AssignLeadButton, TakeLeadButton, type AssignableOwner } from "./leadActions";

/* Founder — "I can assign these to do as an admin or just take it myself":
   the company admin's To-Do row controls (B-Systems, and ByteForce since the
   founder's "Both companies now", 2026-11-08). They live HERE, not in
   components/shared/TodoBody, so the brand-neutral list never pulls the
   B-Systems lead-action client module into the ByteForce To-Do route's graph —
   the page hands them to TodoBody as a render prop instead. The real wall is
   still server-side: requireBsAdmin / requireCompanyAdmin("byteforce") on the
   two assign routes. */
export interface TodoAssign {
  owners: AssignableOwner[];
  selfUserId: string;
  locale: Locale;
  /** the To-Do's company namespace — /api/b-systems or /api/byteforce. Both
      assign routes are COMPANY-ADMIN walls (founder 2026-11-08: "Both
      companies now"); the page only builds this for that admin. */
  apiBase: string;
  company: "bsystems" | "byteforce";
}

/* The owner chip on the admin's row. Founder (2026-11-08, "assigned leads
   only"): an owner is an ACCOUNT, so a lead with no owner account reads
   "Unassigned" whatever legacy rep card or referring partner it carries — it is
   exactly the row only the admin can see, and the one he has to hand out.
   B-Systems keeps its bucket in front of the name; ByteForce has no buckets. */
export function todoOwnerLabel(
  locale: Locale,
  item: TodoItem,
  company: "bsystems" | "byteforce" = "bsystems",
): string {
  /* each company's own word for it — ByteForce's screens say dict/internal's */
  const unassigned = tFor(locale)(
    company === "byteforce" ? bfCommon.unassigned : ownerFilters.unassigned,
  );
  if (!item.ownerUserId) return unassigned;
  if (company === "byteforce" || !item.ownerType) return item.ownerName ?? unassigned;
  const bucket = ownerTypeLabel(locale, item.ownerType);
  return item.ownerName ? `${bucket} · ${item.ownerName}` : bucket;
}

export function TodoRowActions({ item, assign }: { item: TodoItem; assign: TodoAssign }) {
  /* Prospect, statement and milestone rows are admin-owned subsystems with
     nobody to hand them to — they carry no leadId, so they stay bare lines. */
  if (!item.leadId) return null;
  return (
    <span className="ms-auto inline-flex items-center gap-2">
      <span className="text-xs text-brand-muted">
        {todoOwnerLabel(assign.locale, item, assign.company)}
      </span>
      <AssignLeadButton
        /* the To-Do's OWN company: B-Systems' roster and route, or ByteForce's
           (staff accounts, /api/byteforce/leads/[id]/assign) */
        apiBase={assign.apiBase}
        leadId={item.leadId}
        owners={assign.owners}
        currentOwnerUserId={item.ownerUserId ?? null}
        variant={assign.company}
        small
      />
      {item.ownerUserId === assign.selfUserId ? null : (
        <TakeLeadButton
          apiBase={assign.apiBase}
          leadId={item.leadId}
          selfUserId={assign.selfUserId}
        />
      )}
    </span>
  );
}
