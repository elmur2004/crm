import { AppNav } from "@/components/internal/AppNav";
import { requirePageRole } from "@/lib/auth/page-guards";

export default async function ByteForceAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole("/login", "byteforce_staff");
  return (
    <>
      <AppNav basePath="/byteforce" userName={user.name} roles={user.roles} />
      <main className="page max-w-7xl mx-auto w-full">{children}</main>
    </>
  );
}
