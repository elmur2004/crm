/* ADR-008: phone is the portal login identifier — normalized before storage and
   lookup so "010 1234-5678" and "01012345678" are the same account. */

export function normalizePhone(raw: string): string {
  let p = raw.trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  return p;
}

export function isValidPhone(raw: string): boolean {
  const p = normalizePhone(raw);
  return /^\+?\d{7,15}$/.test(p);
}

/** Portal login form takes one identifier: an email (admins, ADR-016) or a phone. */
export function identifierKind(identifier: string): "email" | "phone" {
  return identifier.includes("@") ? "email" : "phone";
}
