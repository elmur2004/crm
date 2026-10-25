"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setTheme } from "@/lib/theme/actions";
import { DEFAULT_THEME, type Theme } from "@/lib/theme/core";

/* The client half of the theme — the LocaleProvider shape, plus a chooser.

   The server already stamped <html data-theme> from the cookie, so this
   provider never has to PAINT anything on load: the value it is handed is the
   value already on the element. It exists for two reasons:

   · the toggles render their pressed segment on the server from it, so the
     control is right in the first byte, like the theme itself;
   · the shells mount TWO toggles (header + burger sheet); holding the choice
     here means both flip together, instantly, instead of each waiting for the
     server round trip on its own.

   Mounted once per app root layout, inside LocaleProvider. */

type ThemeContextValue = { theme: Theme; choose: (next: Theme) => void };

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  choose: () => undefined,
});

export function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Theme>(theme);
  /* Follow the server when it re-renders with a different cookie value (after
     router.refresh, or another tab's choice arriving on navigation). The
     adjust-state-during-render pattern, not an effect: an effect would render
     one frame of the stale value first. */
  const [fromServer, setFromServer] = useState<Theme>(theme);
  if (fromServer !== theme) {
    setFromServer(theme);
    setCurrent(theme);
  }

  const choose = useCallback(
    (next: Theme) => {
      if (next === current) return;
      const previous = current;
      /* INSTANT: the attribute the CSS keys on changes on the click itself.
         React never fights this write — the server's next render carries the
         same value (the cookie the action below sets), so reconciliation
         finds nothing to change. */
      document.documentElement.setAttribute("data-theme", next);
      setCurrent(next);
      void (async () => {
        try {
          await setTheme(next);
          router.refresh();
        } catch {
          /* the cookie did not land: put the page back, or it would show a
             theme the next request will not render */
          document.documentElement.setAttribute("data-theme", previous);
          setCurrent(previous);
        }
      })();
    },
    [current, router],
  );

  const value = useMemo(() => ({ theme: current, choose }), [current, choose]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
