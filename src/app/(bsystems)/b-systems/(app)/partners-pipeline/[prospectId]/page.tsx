import { ProspectDetailBody } from "@/components/partners/pages";
import { requireBsAdminPage } from "@/lib/auth/page-guards";

export const metadata = { title: "Partner prospect — B-Systems CRM" };

export default async function Page({ params }: { params: Promise<{ prospectId: string }> }) {
  await requireBsAdminPage();
  const { prospectId } = await params;
  return <ProspectDetailBody prospectId={prospectId} />;
}
