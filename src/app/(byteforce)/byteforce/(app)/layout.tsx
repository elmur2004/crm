import { AppNav } from "@/components/internal/AppNav";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { UndoControl } from "@/components/shared/UndoControl";
import { requirePageRole } from "@/lib/auth/page-guards";

export default async function ByteForceAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole("/login", "byteforce_staff");
  return (
    <>
      <ImpersonationBar />
      <AppNav basePath="/byteforce" userName={user.name} roles={user.roles} />
      <main className="page max-w-7xl mx-auto w-full">{children}</main>
      <UndoControl userId={user.id} />
    </>
  );
}
