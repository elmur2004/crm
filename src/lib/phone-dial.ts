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

/* Founder: "add a WhatsApp (message on WhatsApp) button on every lead next to
   the call button." wa.me refuses local numbers — the path must be COUNTRY
   CODE + subscriber digits, no "+", no leading zero. The team types Egyptian
   mobiles the local way ("01001234567"), so that shape gets Egypt's 20
   prefixed; an explicit +/00 country code is honoured as typed; any other
   0-leading number (landlines have no WhatsApp; a foreign trunk prefix is
   unguessable) yields NO link rather than a wrong one. Same philosophy as
   telDigits above: the displayed number is never rewritten — only the href. */
export function waDigits(raw: string): string | null {
  const tel = telDigits(raw);
  if (!tel) return null;
  if (tel.startsWith("+")) return tel.slice(1); // explicit country code
  if (/^01\d{8,9}$/.test(tel)) return `2${tel}`; // Egyptian mobile, local shape
  if (tel.startsWith("0")) return null; // 0-leading, not an EG mobile: ambiguous
  return tel; // already bare country-code digits ("201…", "9665…")
}

/** `https://wa.me/` href, or null when no confident country-coded form exists. */
export function waHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = waDigits(raw);
  return digits ? `https://wa.me/${digits}` : null;
}
