import { requireRole } from "@/lib/auth/guards";
import { BrandLogo } from "@/components/shared/BrandLogo";

/* Phase 0 shell — the §6.5 Home dashboard replaces this in Phase 1. */

export default async function ByteForceHome() {
  const user = await requireRole("byteforce_staff");
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <BrandLogo brand="byteforce" height={48} />
      <h1 className="font-brand-display text-brand-secondary text-2xl font-bold mt-6">
        ByteForce CRM
      </h1>
      <p className="text-brand-muted mt-2">
        Signed in as {user.name}. The dashboard arrives with Phase 1.
      </p>
    </main>
  );
}
