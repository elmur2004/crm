"use client";

import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import { useLocale } from "./LocaleProvider";

/* Founder V5: the AR ↔ EN toggle, styled like the entity switcher. */

export function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale();
  async function switchTo(next: "en" | "ar") {
    if (next === locale) return;
    await setLocale(next);
    router.refresh();
  }
  return (
    <div className="switcher" role="group" aria-label="Language">
      <button
        type="button"
        className="switcher-seg"
        aria-current={locale === "en" ? "true" : undefined}
        onClick={() => void switchTo("en")}
      >
        EN
      </button>
      <button
        type="button"
        className="switcher-seg"
        aria-current={locale === "ar" ? "true" : undefined}
        onClick={() => void switchTo("ar")}
      >
        عربي
      </button>
    </div>
  );
}
