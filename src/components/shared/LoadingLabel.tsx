"use client";

import { useLocale } from "./LocaleProvider";
import { tFor } from "@/lib/i18n/core";
import { shell } from "@/lib/i18n/dict/auth";

/* The one sentence a route skeleton speaks (RouteSkeleton). A client island
   only so it can read the language from the root layout's LocaleProvider —
   a loading.tsx must render before anything is fetched, so it cannot read the
   cookie itself. */

export function LoadingLabel() {
  const t = tFor(useLocale());
  return (
    <p role="status" className="sr-only">
      {t(shell.loadingPage)}
    </p>
  );
}
