import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";

/* ADR-053 / ADR-054 — the shared vault page chrome: eyebrow/title/sub. The
   section nav lives in the module's app-shell header now (VaultModuleNav) —
   the module is a switcher peer, so its sections sit where every app's
   sections sit. Company is a per-list FILTER, not a view switcher, so the
   head carries no controls. Composed from existing design-system classes. */

export function VaultHead({
  locale,
  title,
  sub,
}: {
  locale: Locale;
  title: Msg;
  sub?: Msg;
}) {
  const t = tFor(locale);
  return (
    <div className="page-head">
      <div>
        <p className="u-eyebrow">{t(vault.eyebrow)}</p>
        <h1 className="u-h1">{t(title)}</h1>
        {sub ? <p className="u-sub">{t(sub)}</p> : null}
      </div>
    </div>
  );
}
