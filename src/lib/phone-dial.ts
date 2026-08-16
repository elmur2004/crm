/* Founder: "when using the system from the phone there should be a button to
   call the lead instantly so it dials the lead."

   A tel: URI is what hands the number to the phone's dialer. RFC 3966 allows
   visual separators, but real-world Android/iOS handlers are happier with a
   bare number, and a stray space or a "(0)" can silently break the hand-off —
   so the href is sanitised down to an optional leading "+" and digits, while
   the number stays displayed exactly as the team typed it.

   This is DIFFERENT from auth/phone.ts's normalizePhone, which produces the
   login identifier a stored account is matched by. A lead's number is free
   text (landlines, extensions, foreign numbers) and must never be rewritten. */

/** The dialable form of a number: leading "+" (if any) plus digits. */
export function telDigits(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("00")) return `+${digits.slice(2)}`;
  return plus ? `+${digits}` : digits;
}

/** `tel:` href, or null when the number holds no digits at all. */
export function telHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = telDigits(raw);
  return digits ? `tel:${digits}` : null;
}
