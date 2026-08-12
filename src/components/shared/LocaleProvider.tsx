"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/lib/i18n/core";

/* Client components read the locale from context (server components use
   getLocale() directly). The provider is mounted once per root layout. */

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
