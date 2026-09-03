import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { BsCrmBoardBody, type BsBoardParams } from "@/components/bsystems/pages/BsCrmBoardBody";

export const metadata = { title: "CRM — Mindoo" };

/* ADR-074 — THE Mindoo board, and it is the B-Systems board: same eight
   columns, same drag-and-drop, same role-aware form on drop, same engine.

   `role="admin"` is not a shortcut. Mindoo's single staff role IS the whole of
   its company's staff, and the light form set exists to keep EXTERNAL agents
   out of fields that are not theirs — Mindoo has no external agents, so there
   is nobody the light forms would be protecting anything from. The ENGINE role
   the panel actually gates Won on is `mindoo_staff`, derived from the brand
   inside BsBoard/BsEventPanel, never from this form shape (ADR-073 shipped that
   round trip the other way and the Won action silently vanished). */

export default async function MindooCrmPage({
  searchParams,
}: {
  searchParams: Promise<BsBoardParams>;
}) {
  const user = await requireMindooPage();
  return (
    <BsCrmBoardBody
      ctx={MINDOO_SURFACE}
      params={await searchParams}
      role="admin"
      userId={user.id}
    />
  );
}
