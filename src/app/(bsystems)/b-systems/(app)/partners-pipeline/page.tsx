import { PartnersPipelineBody } from "@/components/partners/pages";
import { requireBsAdminPage } from "@/lib/auth/page-guards";

export const metadata = { title: "Partnership CRM — B-Systems CRM" };

export default async function Page() {
  await requireBsAdminPage();
  return <PartnersPipelineBody />;
}
