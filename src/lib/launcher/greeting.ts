import { formatMsg, type Msg } from "@/lib/i18n/core";
import { utcToCairo } from "@/lib/datetime";
import { launcher } from "@/lib/i18n/dict/launcher";

/* The launcher's greeting — "Good morning, Elmur".

   THE HOUR IS CAIRO'S, read through utcToCairo: the one wall-clock reader the
   product has (ADR-068 keeps every rendered clock in lib/datetime.ts, and this
   file renders none — it only asks which part of the day it is). A server in
   another timezone, or a founder reading at 23:30 UTC, must still be greeted
   for the evening it is in Cairo.

   Bands: 05:00–11:59 morning, 12:00–16:59 afternoon, otherwise evening. Arabic
   says "مساء الخير" for both of the later bands, as Arabic does. */

export type DayPart = "morning" | "afternoon" | "evening";

export function cairoDayPart(now: Date): DayPart {
  const hour = Number(utcToCairo(now).time.slice(0, 2));
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

/** The name a greeting uses: the first word of the account's name ("Sara
    Hassan" → "Sara"; "Elmur" stays "Elmur"). Never empty — a blank name falls
    back to no name at all rather than "Good morning, ". */
export function greetingName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function greetingFor(now: Date, fullName: string): Msg {
  const part = cairoDayPart(now);
  const template =
    part === "morning"
      ? launcher.greetingMorning
      : part === "afternoon"
        ? launcher.greetingAfternoon
        : launcher.greetingEvening;
  const name = greetingName(fullName);
  if (!name) {
    /* "Good morning" alone, in both languages: cut the template at its comma */
    return {
      en: template.en.replace(/,\s*\{name\}$/, ""),
      ar: template.ar.replace(/،\s*\{name\}$/, ""),
    };
  }
  return formatMsg(template, { name });
}
