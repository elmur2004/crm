import { auth } from "@/lib/auth";
import { endImpersonation } from "@/lib/auth/actions";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { shell } from "@/lib/i18n/dict/auth";

/* Shown only while an admin is impersonating (session.impersonatorId set) —
   one click snaps back to the admin session (founder: back and forth, any time). */

export async function ImpersonationBar() {
  const session = await auth();
  if (!session?.user?.impersonatorId) return null;
  const t = tFor(await getLocale());
  return (
    <div className="bg-brand-accent text-brand-on-accent">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-brand-meta">
          {t(shell.impersonating).replace("{name}", session.user.name ?? "")}
        </span>
        <form action={endImpersonation}>
          <button
            type="submit"
            className="border border-current rounded-brand-control px-3 py-1 text-xs font-semibold"
          >
            {t(shell.backToAdmin)}
          </button>
        </form>
      </div>
    </div>
  );
}
