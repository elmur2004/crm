import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/* ============================================================================
   ACCESS AUDIT, Run 081 — THE TAPPED NOTIFICATION LANDS ON THE COMPANY IT
   TALKED ABOUT.

   ADR-067 moved the company into the QUERY STRING. `public/sw.js` was untouched
   by that batch and decided whether to navigate an already-open window by
   comparing PATHNAME only — which was sufficient while every deep link had its
   own path, and stopped being sufficient the moment `deepLinkFor` started
   emitting `/b-systems?company=byteforce` and `/b-systems` for different news.

   The worker is plain ES2017 served verbatim, never compiled, so it has no
   import surface to test through: this loads the real file and drives its real
   `notificationclick` handler against a fake `self`. Nothing is duplicated
   here — if the shipped file changes, so does what this runs.
   ========================================================================== */

const SW = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGIN = "https://crm.example";

type Handler = (event: unknown) => void;

function loadWorker(clients: unknown[]) {
  const handlers: Record<string, Handler> = {};
  const self = {
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    skipWaiting: () => {},
    location: { origin: ORIGIN },
    registration: { showNotification: vi.fn() },
    clients: {
      claim: async () => {},
      matchAll: async () => clients,
      openWindow: vi.fn(async () => {}),
    },
    atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("self", SW)(self);
  return { handlers, self };
}

async function tap(handlers: Record<string, Handler>, url: string) {
  let waited: unknown = null;
  handlers.notificationclick!({
    notification: { close: () => {}, data: { url } },
    waitUntil: (p: unknown) => {
      waited = p;
    },
  });
  await waited;
}

function openWindowAt(url: string) {
  return {
    url,
    navigate: vi.fn(async () => ({ focus: vi.fn(async () => {}) })),
    focus: vi.fn(async () => {}),
  };
}

describe("public/sw.js — tapping a notification", () => {
  it("NAVIGATES when the open window differs only by ?company= (ADR-067)", async () => {
    /* the phone is sitting on the B-Systems home; a BYTEFORCE mention arrives */
    const client = openWindowAt(`${ORIGIN}/b-systems?company=bsystems`);
    const { handlers } = loadWorker([client]);

    await tap(handlers, "/b-systems?company=byteforce");

    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/b-systems?company=byteforce`);
    /* the bug was here: same pathname, so the worker focused the window it
       already had and he read B-Systems while the push named ByteForce */
    expect(client.focus).not.toHaveBeenCalled();
  });

  it("still just FOCUSES a window already on the very address", async () => {
    const client = openWindowAt(`${ORIGIN}/b-systems?company=byteforce`);
    const { handlers } = loadWorker([client]);

    await tap(handlers, "/b-systems?company=byteforce");

    expect(client.navigate).not.toHaveBeenCalled();
    expect(client.focus).toHaveBeenCalled();
  });

  it("opens a window when none is on this origin", async () => {
    const { handlers, self } = loadWorker([]);
    await tap(handlers, "/b-systems/registrations");
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/b-systems/registrations`);
  });
});
