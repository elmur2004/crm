import { requireRole } from "@/lib/auth/guards";
import { BrandLogo } from "@/components/shared/BrandLogo";

/* Phase 0 shell — the §6.5 Home dashboard (B-Systems clone) replaces this in Phase 2. */

export default async function BSystemsHome() {
  const user = await requireRole("bsystems_staff");
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <BrandLogo brand="bsystems" variant="mark" height={48} />
      <h1 className="font-brand-display text-2xl font-bold mt-6">B-Systems CRM</h1>
      <p className="text-brand-meta text-brand-muted mt-1">Systems before software</p>
      <p className="text-brand-muted mt-4">
        Signed in as {user.name}. The dashboard arrives with Phase 2.
      </p>
    </main>
  );
}
