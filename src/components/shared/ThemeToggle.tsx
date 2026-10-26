"use client";

import { tFor, type Msg } from "@/lib/i18n/core";
import { shell } from "@/lib/i18n/dict/auth";
import { THEMES, type Theme } from "@/lib/theme/core";
import { useLocale } from "./LocaleProvider";
import { useTheme } from "./ThemeProvider";
import { SwitchIndicator } from "./SwitchIndicator";

/* Dark mode's control — Light · Dark — a SIBLING of LanguageToggle:
   the same .switcher / .switcher-seg idiom, mounted beside it everywhere it is
   mounted, so it inherits every brand scope's header and burger-sheet styling
   (including the sheet's 44px thumb targets) instead of growing its own.

   · Real names in both languages. Each segment's accessible name is its TEXT;
     `compact` (the desktop header, where the user cluster is already the
     tightest strip on screen) only hides that text visually — it is still the
     name, and `title` shows it on hover. Nowhere is it icon-only.
   · aria-pressed on all three: they are toggle buttons, so a screen reader
     announces which one is on as the user moves across the group.
   · Native <button>s: Tab / Enter / Space, no custom key handling to get wrong.
   · Icons are inline SVG in currentColor (no emoji, no icon font) and
     aria-hidden; nothing here is directional, so RTL needs no mirroring and
     the segments reorder with the document's direction on their own.
   · TWO segments. Founder (amending ADR-087): "remove the system theme
     option" — the third, follow-the-OS segment is gone (src/lib/theme/core.ts).
     Its dictionary key, shell.themeSystem, stays (never delete a key) and
     nothing renders it.
   · The active segment's pill SLIDES between the two (SwitchIndicator, a
     progressive client island: without it the segment paints its own pill). */

const LABELS: Record<Theme, Msg> = {
  light: shell.themeLight,
  dark: shell.themeDark,
};

function ThemeIcon({ theme }: { theme: Theme }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className="theme-icon"
    >
      {theme === "light" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      ) : (
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      )}
    </svg>
  );
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const t = tFor(useLocale());
  const { theme, choose } = useTheme();
  return (
    <div
      className="switcher theme-toggle"
      role="group"
      aria-label={t(shell.themeGroup)}
      data-compact={compact ? "" : undefined}
    >
      {THEMES.map((value) => {
        const label = t(LABELS[value]);
        return (
          <button
            key={value}
            type="button"
            className="switcher-seg"
            aria-pressed={theme === value}
            title={compact ? label : undefined}
            onClick={() => choose(value)}
          >
            <ThemeIcon theme={value} />
            <span className={compact ? "sr-only" : "theme-label"}>{label}</span>
          </button>
        );
      })}
      {/* the sliding active pill (glass.css / motion.css) — aria-hidden */}
      <SwitchIndicator />
    </div>
  );
}
