import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { BsWonLeadsBody } from "@/components/bsystems/pages/BsWonLeadsBody";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { wonLeads } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(wonLeads.metaList) };
}

/* ADR-074 — Mindoo has Won Leads because Mindoo wins the B-Systems way: the
   deal opens a milestone tab and writes a Won Deal (ByteForce's win writes a
   Client instead, which is why ByteForce has no such screen at all).

   `mindoo_staff` reads the ADMINISTRATOR's view — every won deal as a card —
   because it is the whole of its company's staff and there is no narrower
   audience to show it. */

export default async function MindooWonLeadsPage() {
  const user = await requireMindooPage();
  return <BsWonLeadsBody ctx={MINDOO_SURFACE} role="mindoo_staff" userId={user.id} />;
}
