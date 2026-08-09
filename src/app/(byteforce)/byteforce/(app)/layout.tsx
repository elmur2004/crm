import { AppNav } from "@/components/internal/AppNav";
import { requirePageRole } from "@/lib/auth/page-guards";

export default async function ByteForceAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole("/login", "byteforce_staff");
  return (
    <>
      <AppNav brand="byteforce" basePath="/byteforce" userName={user.name} />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
