/* ADR-065 — web push: is it configured, and with what?

   THE RULE THAT MATTERS MOST: with no keys set, this module answers "no" and
   every push path above it returns before it does any work at all. That is not
   an optimisation — it is the contract that lets this ship to a production host
   where nobody has set anything yet, and behave EXACTLY as it did yesterday.

   Read from `process.env` at CALL TIME, never captured at module load and never
   at BUILD time. A `NEXT_PUBLIC_` variable would be inlined into the client
   bundle when the container builds, which happens before the founder can set
   anything on the host — the key would be baked as empty for ever. Everything
   here is server-side; the PUBLIC half reaches the browser through
   `GET /api/push/public-key`, freshly read per request. */

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
  /** RFC 8292 `sub`: a mailto: or https: URL the push service can reach us at */
  subject: string;
};

/** Last-resort contact for the `sub` claim: the production origin. Not a
    secret, not a key — push services only ever use it to reach a human. */
const FALLBACK_SUBJECT = "https://crm.byteforceinc.com";

function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** RFC 8292 accepts only `mailto:` and `https:` here; anything else makes the
    push service reject EVERY send, so a malformed value falls back rather than
    silently breaking delivery. */
export function vapidSubject(): string {
  for (const candidate of [envValue("VAPID_SUBJECT"), envValue("AUTH_URL")]) {
    if (candidate.startsWith("mailto:") || candidate.startsWith("https://")) return candidate;
  }
  return FALLBACK_SUBJECT;
}

/** The configured keypair, or null — the single source of "is push on?". */
export function vapidKeys(): VapidKeys | null {
  const publicKey = envValue("VAPID_PUBLIC_KEY");
  const privateKey = envValue("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: vapidSubject() };
}

/** The feature flag, in one word. */
export function pushConfigured(): boolean {
  return vapidKeys() !== null;
}

/** The half a browser is allowed to see. Null = not configured, which the UI
    reads as "offer nothing" — the app then looks exactly as it does today. */
export function publicVapidKey(): string | null {
  return vapidKeys()?.publicKey ?? null;
}
