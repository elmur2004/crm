/* ADR-074 — the handful of strings that belong to MINDOO'S SHELL and to no
   other app. Everything else Mindoo renders reuses the dictionary the shared
   bodies already speak (dict/crm, dict/admin, dict/todo, dict/calendar), which
   is the point of sharing the bodies at all: Mindoo is the same product under
   another name, not a second vocabulary to keep in step.

   Brand names stay untranslated, per the house precedent in dict/accounting's
   `acctCompanies`. */

export const mindooShell = {
  home: { en: "Mindoo home", ar: "الصفحة الرئيسية لـ Mindoo" },
  /* the merged shell prints a per-role badge under the user's name; Mindoo has
     exactly one role, so the badge is the company itself rather than a rank
     that would be the same on every account in the building */
  roleLabel: { en: "Mindoo", ar: "Mindoo" },
} as const;
