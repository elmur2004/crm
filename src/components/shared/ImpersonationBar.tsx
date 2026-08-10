import { auth } from "@/lib/auth";
import { endImpersonation } from "@/lib/auth/actions";

/* Shown only while an admin is impersonating (session.impersonatorId set) —
   one click snaps back to the admin session (founder: back and forth, any time). */

export async function ImpersonationBar() {
  const session = await auth();
  if (!session?.user?.impersonatorId) return null;
  return (
    <div className="bg-brand-accent text-brand-on-accent">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-brand-meta">
          Impersonating {session.user.name} — you are seeing exactly what they see
        </span>
        <form action={endImpersonation}>
          <button
            type="submit"
            className="border border-current rounded-brand-control px-3 py-1 text-xs font-semibold"
          >
            Back to admin
          </button>
        </form>
      </div>
    </div>
  );
}
