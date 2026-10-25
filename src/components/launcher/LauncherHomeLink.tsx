import Link from "next/link";
import { tFor, type Locale } from "@/lib/i18n/core";
import { launcher } from "@/lib/i18n/dict/launcher";
import { LAUNCHER_PATH } from "@/lib/launcher/apps";

/* The header HOME ICON — "a home icon in the header brings you back to it from
   anywhere" (the founder's choice of how the launcher fits in).

   Mounted as the first child of each app shell's header — the merged CRM,
   Accounting and the Data Vault (ADR-090).

   No new CSS: it wears `.bell`, the header's existing 36px icon button, so it
   inherits every scope's hover treatment (the indigo header's translucent
   on-chrome wash, the light headers' primary tint) and the header's own
   colour through `currentColor`. The glyph is the universal app-grid — nine
   rounded squares — drawn inline, aria-hidden; the accessible name is the
   same "All apps" the Reports screen's back link says, and `title` shows it
   on hover. Nothing in it is directional, so RTL needs no mirroring. */

export function LauncherHomeLink({ locale }: { locale: Locale }) {
  const label = tFor(locale)(launcher.allApps);
  return (
    <Link
      href={LAUNCHER_PATH}
      prefetch={false}
      className="bell lx-home"
      aria-label={label}
      title={label}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="5" height="5" rx="1.3" />
        <rect x="9.5" y="3" width="5" height="5" rx="1.3" />
        <rect x="16" y="3" width="5" height="5" rx="1.3" />
        <rect x="3" y="9.5" width="5" height="5" rx="1.3" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1.3" />
        <rect x="16" y="9.5" width="5" height="5" rx="1.3" />
        <rect x="3" y="16" width="5" height="5" rx="1.3" />
        <rect x="9.5" y="16" width="5" height="5" rx="1.3" />
        <rect x="16" y="16" width="5" height="5" rx="1.3" />
      </svg>
    </Link>
  );
}
