"use client";

import { useCallback, useEffect, useState } from "react";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { push as msg } from "@/lib/i18n/dict/admin";

/* ADR-065 — founder: "I installed the website as an app on my phone I want it
   to shoot me actual notifications."

   The control that asks his phone for permission, at the foot of the bell,
   which is the one place every role that HAS notifications can reach on a
   phone without navigating (there is no per-account settings page for an
   admin — /b-systems/profile exists for agents and partners only).

   IT RENDERS NOTHING AT ALL unless the server hands back a public VAPID key.
   With no keys configured — which is what production is until the founder sets
   them — this component paints nothing, registers no service worker and makes
   no further request. That is the whole point: the app looks and behaves
   exactly as it did before this feature existed.

   THREE HONEST STATES, plus the two platform truths:
     off      — "Turn on phone notifications"
     on       — "Phone notifications are on" + Turn off
     blocked  — the browser refuses; only settings can undo it, and it says so
     install  — iOS delivers web push ONLY to a home-screen install; say so
                rather than offering a button that cannot work
     (unsupported anywhere else: render nothing, like the unconfigured case) */

type State = "loading" | "hidden" | "install" | "off" | "on" | "blocked" | "busy";

/** base64url (a VAPID public key) → the bytes `subscribe()` wants.

    Typed as ArrayBuffer, not Uint8Array: `applicationServerKey` is a
    `BufferSource`, which since the ES2024 lib types means an ArrayBufferView
    over a plain ArrayBuffer specifically — a bare `Uint8Array<ArrayBufferLike>`
    no longer satisfies it. The underlying buffer is exactly the same bytes. */
function urlBase64ToBytes(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return buffer;
}

/** Is this existing subscription bound to the key the SERVER is using now?

    A `PushSubscription` is welded to the `applicationServerKey` it was created
    with. If the pair on the host is ever rotated, an old subscription keeps
    looking perfectly healthy to the browser while every send against it is
    refused — the phone goes silent and the control cheerfully says "on", which
    is exactly the lying UI this feature is not allowed to have. Compare, and
    re-subscribe when they differ.

    The failure mode is deliberately benign: if this cannot read the key it
    answers "no", and the caller then does what a first-time enable does. */
function boundToKey(sub: PushSubscription, key: string): boolean {
  const raw = sub.options?.applicationServerKey;
  if (!raw) return false;
  const bytes = new Uint8Array(raw as ArrayBuffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const asUrlSafe = window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return asUrlSafe === key.replace(/=+$/, "");
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  /* iPadOS reports itself as a Macintosh; the touch points give it away */
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function PushToggle() {
  const t = tFor(useLocale());
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      /* THE FLAG, asked at runtime. A failure here is treated exactly like
         "not configured" — nothing renders, nothing breaks. */
      const res = await fetch("/api/push/public-key").catch(() => null);
      const body = res?.ok ? ((await res.json().catch(() => null)) as { key?: string } | null) : null;
      const serverKey = body?.key ?? null;
      if (!alive) return;
      if (!serverKey) return setState("hidden");
      setKey(serverKey);

      if (!pushSupported()) {
        /* iOS Safari exposes PushManager only inside a home-screen install, so
           "unsupported on an iPhone in a tab" is really "not installed yet" */
        return setState(isIOS() && !isStandalone() ? "install" : "hidden");
      }
      if (Notification.permission === "denied") return setState("blocked");

      const reg = await navigator.serviceWorker.getRegistration("/").catch(() => null);
      const existing = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
      if (!alive) return;
      /* "on" means REACHABLE, not merely subscribed: a subscription welded to a
         key the server has since rotated away from can never be delivered to,
         so it reads as off and one press repairs it. */
      const usable = existing !== null && boundToKey(existing, serverKey);
      setState(usable && Notification.permission === "granted" ? "on" : "off");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!key) return;
    setNote(null);
    setState("busy");
    try {
      /* FIRST, in the click's own task: iOS refuses a permission request that
         is not attributable to a user gesture, and every await after this point
         is one the browser has already accepted responsibility for. */
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") {
        setNote(t(msg.dismissed));
        setState("off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !boundToKey(sub, key)) {
        /* welded to a key the server no longer uses — drop it and start again,
           otherwise this device is silently unreachable for ever */
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(key),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("on");
    } catch {
      setNote(t(msg.failed));
      setState(Notification.permission === "denied" ? "blocked" : "off");
    }
  }, [key, t]);

  const disable = useCallback(async () => {
    setNote(null);
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState("off");
    } catch {
      setNote(t(msg.failed));
      setState("off");
    }
  }, [t]);

  if (state === "loading" || state === "hidden") return null;

  return (
    <div className="bell-foot" data-push-state={state}>
      {state === "install" ? (
        <p className="bell-foot-note">{t(msg.needsInstall)}</p>
      ) : state === "blocked" ? (
        <p className="bell-foot-note">{t(msg.blocked)}</p>
      ) : state === "on" ? (
        <>
          <span className="bell-foot-state">
            <span className="bell-foot-tick" aria-hidden />
            {t(msg.on)}
          </span>
          <button type="button" className="btn-ghost btn--sm" onClick={() => void disable()}>
            {t(msg.turnOff)}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn-primary btn--sm"
          onClick={() => void enable()}
          disabled={state === "busy"}
        >
          {state === "busy" ? t(msg.enabling) : t(msg.enable)}
        </button>
      )}
      {note ? <p className="bell-foot-note">{note}</p> : null}
    </div>
  );
}
