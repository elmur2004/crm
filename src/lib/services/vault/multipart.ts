/* ADR-053 Phase 5 — multipart helpers for the vault routes. FormData gives
   strings-or-Files; these normalise to what the Zod schemas expect (empty
   string = absent, so optional fields stay optional). */

export function fieldStr(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s === "" ? undefined : s;
}

export function fieldFile(form: FormData, name = "file"): File | null {
  const v = form.get(name);
  return v instanceof File && v.size > 0 ? v : null;
}

export function fieldFiles(form: FormData, name = "files"): File[] {
  return form.getAll(name).filter((v): v is File => v instanceof File && v.size > 0);
}

/** Links arrive as a JSON string array [{url,label}] — parsed here, validated
    by the Zod schema at the route. */
export function fieldJson(form: FormData, name: string): unknown {
  const raw = fieldStr(form, name);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
