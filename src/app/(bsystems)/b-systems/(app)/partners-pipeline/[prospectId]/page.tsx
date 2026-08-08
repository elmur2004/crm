import { ProspectDetailBody } from "@/components/partners/pages";

export const metadata = { title: "Partner prospect — B-Systems CRM" };

export default async function Page({ params }: { params: Promise<{ prospectId: string }> }) {
  const { prospectId } = await params;
  return <ProspectDetailBody prospectId={prospectId} />;
}
