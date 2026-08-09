import { PartnersDirectoryBody } from "@/components/partners/pages";
import { requireBsAdminPage } from "@/lib/auth/page-guards";

export const metadata = { title: "Partners — B-Systems CRM" };

export default async function Page() {
  await requireBsAdminPage();
  return <PartnersDirectoryBody />;
}
