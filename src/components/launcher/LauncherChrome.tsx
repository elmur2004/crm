import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { logout } from "@/lib/auth/actions";
import { tFor, type Locale } from "@/lib/i18n/core";
import { launcher } from "@/lib/i18n/dict/launcher";
import { LAUNCHER_PATH } from "@/lib/launcher/apps";

/* The launcher's own top bar — the PLATFORM's, not any one app's, so it wears
   both companies' real marks (unaltered: the ByteForce lockup takes the
   design system's light plate in dark mode, the B-Systems mark needs none) and
   carries only what a home screen needs: language, theme, who you are, and the
   way out. The app headers keep their own chrome; this is not one of them.

   Its own `.lx-bar` rather than `.app-header`: the app header hides Log out
   below 820px because the burger sheet carries it there, and this page has no
   burger — reusing the class would leave a phone with no way to sign out. */

export function LauncherChrome({ locale, userName }: { locale: Locale; userName: string }) {
  const t = tFor(locale);
  return (
    <>
      <ImpersonationBar />
      <header className="lx-bar">
        <Link href={LAUNCHER_PATH} prefetch={false} className="lx-brand" aria-label={t(launcher.allApps)}>
          <BrandLogo brand="byteforce" height={28} />
          <span className="lx-brand-sep" aria-hidden="true" />
          <BrandLogo brand="bsystems" variant="mark" height={32} />
        </Link>
        <div className="lx-tools">
          <LanguageToggle />
          <ThemeToggle compact />
          <span className="lx-user">{userName}</span>
          <form action={logout.bind(null, "/login")}>
            <button type="submit" className="lx-logout">
              {t(launcher.logOut)}
            </button>
          </form>
        </div>
      </header>
    </>
  );
}
