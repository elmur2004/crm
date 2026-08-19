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
      {/* ADR-056: the full-width query container the board measures itself
          against. `50cqw` is the content width EXCLUDING the scrollbar —
          the quantity `50vw` cannot express — so the full-bleed board is
          pixel-exact at every browser zoom. Drop this wrapper and the
          board silently falls back to the old vw arithmetic. */}
      <div className="shell-body">
        <main className="page max-w-7xl mx-auto w-full">{children}</main>
      </div>
      <UndoControl userId={user.id} />
    </>
  );
}
