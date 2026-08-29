/* ADR-065 — the push service worker for the installed B-Systems app.
   Founder: "I installed the website as an app on my phone I want it to shoot me
   actual notifications."

   IT DOES EXACTLY ONE THING: receive a push and show it, and open the right
   screen when it is tapped. It caches NOTHING and intercepts NO fetch — there
   is no `fetch` handler in this file on purpose. A caching service worker is
   how a deploy gets stranded behind a stale bundle, and this app deploys from
   main several times a day.

   It lives in `public/` so it is served from `/sw.js`, the ORIGIN ROOT, which
   is what gives it scope over every route without a Service-Worker-Allowed
   header. `src/proxy.ts` matches only /byteforce, /b-systems, /portal,
   /accounting and /vault, so neither this file nor the manifest is ever gated
   behind a sign-in redirect.

   It is registered ONLY when somebody presses "turn on notifications" (see
   PushToggle) — so on a host with no VAPID keys no service worker is ever
   installed at all, and the app is byte for byte what it was before.

   Plain ES2017 JavaScript: this file is served verbatim, never compiled. */

/* A new version takes over immediately rather than waiting for every tab to
   close — otherwise a fixed service worker could sit "waiting" for days on the
   founder's always-open phone app. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** base64url (what VAPID public keys are) → the Uint8Array subscribe() wants. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = self.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ receive */

self.addEventListener("push", (event) => {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = {};
  }
  /* A push with no readable payload still has to show SOMETHING: the browser
     terminates a worker that takes a userVisibleOnly push and shows no
     notification, and repeat offenders lose the subscription. */
  var title = data.title || "B-Systems";
  var options = {
    body: data.body || "",
    icon: "/brand/b-systems/app-icon-192.png",
    badge: "/brand/b-systems/app-icon-192.png",
    /* the notification's own id — a push service that redelivers replaces the
       card instead of showing the same news twice */
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* -------------------------------------------------------------------- open */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      var target = new URL(url, self.location.origin);
      var windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      /* FOCUS an app window that is already open rather than piling up a new
         one every time — on the installed home-screen app there is only ever
         meant to be one. */
      for (var i = 0; i < windows.length; i += 1) {
        var client = windows[i];
        var here = new URL(client.url);
        if (here.origin !== target.origin) continue;
        /* ADR-067 + ACCESS AUDIT, Run 081 — PATH **AND QUERY**. Before the
           merge every deep link had its own pathname (/byteforce, /b-systems,
           /b-systems/registrations, ...), so comparing pathnames was enough.
           The merge moved the COMPANY into the query string, and three
           notification targets now collide on the single pathname
           "/b-systems" — a ByteForce mention deep-links to
           "/b-systems?company=byteforce". With a pathname-only test the worker
           would FOCUS a window already sitting on "/b-systems?company=bsystems"
           and never navigate, landing him on the other company from the one the
           notification told him about. This file was untouched by the merge, so
           nothing re-examined it when the URL shape changed underneath it. */
        if (here.pathname + here.search !== target.pathname + target.search &&
            typeof client.navigate === "function") {
          try {
            var navigated = await client.navigate(target.href);
            if (navigated && typeof navigated.focus === "function") {
              await navigated.focus();
              return;
            }
          } catch (err) {
            /* navigate() is refused in some standalone contexts — focusing the
               window the founder already has open still beats opening a second */
          }
        }
        if (typeof client.focus === "function") {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

/* ------------------------------------------------------- keep the device on */

/* The browser may rotate a subscription on its own (key rotation, a long idle,
   a browser update). Without this the phone goes quiet and nobody finds out. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        var old = event.oldSubscription;
        if (old && old.endpoint) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: old.endpoint }),
          }).catch(function () {});
        }
        /* the public key is read at RUNTIME here too — the worker has no build
           -time environment of its own */
        var res = await fetch("/api/push/public-key");
        if (!res.ok) return;
        var body = await res.json();
        if (!body || !body.key) return;
        var fresh =
          event.newSubscription ||
          (await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(body.key),
          }));
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(fresh.toJSON()),
        });
      } catch (err) {
        /* best effort — the next time the person opens the app, the toggle
           re-registers the device */
      }
    })(),
  );
});
