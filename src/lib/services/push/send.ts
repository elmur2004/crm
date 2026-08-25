import type { VapidKeys } from "./config";

/* ADR-065 — the one place that talks to a push service.

   WHY A LIBRARY AND NOT HAND-ROLLED CRYPTO: a web push is not an HTTP POST. The
   payload must be encrypted per RFC 8291 (ECDH on P-256 → HKDF → AES-128-GCM,
   aes128gcm content encoding) and the request signed per RFC 8292 (an ES256
   JWT). All of that is expressible with Node's WebCrypto, and all of it fails
   SILENTLY when it is subtly wrong: the push service returns 201 and the phone
   simply never buzzes. Nothing in CI can catch that, because CI has no push
   service and no phone. `web-push` is the reference implementation of both RFCs
   and is what the Next.js PWA guide itself uses. It is imported DYNAMICALLY and
   only from inside a configured send, so it can never be traced into a client
   bundle, and a missing module degrades to "no push" instead of a boot failure.

   THE TEST SEAM: everything above this file drives `pushSender()`, so the whole
   delivery path — recipients, the wall, multi-device fan-out, pruning — is
   testable with a fake that records calls, and no test ever needs a network. */

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** The push service says this endpoint no longer exists (404/410). The caller
    prunes the row; every other failure is a hiccup and the row stays. */
export class PushSubscriptionGone extends Error {
  constructor(public readonly statusCode: number) {
    super(`Push subscription gone (${statusCode})`);
    this.name = "PushSubscriptionGone";
  }
}

export type PushSender = (
  target: PushTarget,
  payloadJson: string,
  vapid: VapidKeys,
) => Promise<void>;

/** How long a push service should hold the message for a phone that is off. A
    day: news older than that is stale, and the bell has it anyway. */
const TTL_SECONDS = 60 * 60 * 24;

const realSender: PushSender = async (target, payloadJson, vapid) => {
  /* `web-push` is CommonJS. Under Node's ESM interop the whole module.exports
     lands on `.default`; some bundlers hand back the namespace itself instead.
     This path cannot be exercised in CI (there is no push service and no
     phone), so it accepts BOTH shapes rather than betting on one. */
  const mod = await import("web-push");
  const webpush = (mod as unknown as { default?: typeof mod }).default ?? mod;
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      payloadJson,
      {
        vapidDetails: {
          subject: vapid.subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
        TTL: TTL_SECONDS,
      },
    );
  } catch (err) {
    const status = (err as { statusCode?: number } | null)?.statusCode;
    if (status === 404 || status === 410) throw new PushSubscriptionGone(status);
    throw err;
  }
};

let override: PushSender | null = null;

/** TEST SEAM — pass a fake to record sends, pass null to restore the real one.
    Never called by application code. */
export function setPushSenderForTests(fn: PushSender | null): void {
  override = fn;
}

export function pushSender(): PushSender {
  return override ?? realSender;
}
