import { afterEach, describe, expect, it } from "vitest";
import { pushConfigured, publicVapidKey, vapidKeys, vapidSubject } from "./config";
import { buildPushPayload, deepLinkFor, type NotificationForPush } from "./payload";

/* ADR-065 — the two halves that need no database, no browser and no push
   service: the FEATURE FLAG (which is what makes the whole thing safe to ship
   before the founder sets anything) and the PAYLOAD (which is what a phone
   receives, and therefore where a privacy mistake would live). */

const KEYS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "AUTH_URL"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function setEnv(values: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
  for (const k of KEYS) {
    const v = values[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k]!;
  }
});

describe("the push feature flag (ADR-065 decision D)", () => {
  it("is OFF with nothing configured — which is what production is on the first deploy", () => {
    setEnv({});
    expect(vapidKeys()).toBeNull();
    expect(pushConfigured()).toBe(false);
    expect(publicVapidKey()).toBeNull();
  });

  it("is OFF with only half a pair, and OFF for blank or whitespace values", () => {
    setEnv({ VAPID_PUBLIC_KEY: "pub" });
    expect(pushConfigured()).toBe(false);
    setEnv({ VAPID_PRIVATE_KEY: "priv" });
    expect(pushConfigured()).toBe(false);
    setEnv({ VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "" });
    expect(pushConfigured()).toBe(false);
    setEnv({ VAPID_PUBLIC_KEY: "   ", VAPID_PRIVATE_KEY: "priv" });
    expect(pushConfigured()).toBe(false);
  });

  it("comes ON the moment BOTH keys are set — read at call time, never captured", () => {
    setEnv({});
    expect(pushConfigured()).toBe(false);
    /* the same module instance, no reload: this is the property that lets the
       founder set two variables on the host and restart, with no rebuild */
    process.env.VAPID_PUBLIC_KEY = " pub ";
    process.env.VAPID_PRIVATE_KEY = "priv";
    expect(pushConfigured()).toBe(true);
    expect(publicVapidKey()).toBe("pub"); // trimmed — a pasted key often has one
  });

  it("keeps the RFC 8292 subject legal, whatever the host was given", () => {
    setEnv({ VAPID_SUBJECT: "mailto:someone@example.com" });
    expect(vapidSubject()).toBe("mailto:someone@example.com");
    setEnv({ VAPID_SUBJECT: "https://crm.example.com" });
    expect(vapidSubject()).toBe("https://crm.example.com");
    /* only mailto: and https: are accepted by a push service — anything else
       would make EVERY send fail, so it falls back instead */
    setEnv({ VAPID_SUBJECT: "crm.example.com", AUTH_URL: "https://crm.byteforceinc.com" });
    expect(vapidSubject()).toBe("https://crm.byteforceinc.com");
    setEnv({ VAPID_SUBJECT: "not a url", AUTH_URL: "http://insecure.example" });
    expect(vapidSubject()).toBe("https://crm.byteforceinc.com");
    setEnv({});
    expect(vapidSubject().startsWith("https://")).toBe(true);
  });
});

const base: NotificationForPush = {
  id: "n1",
  userId: "u1",
  type: "assigned",
  title: "Assigned to you: Nile Foods",
  body: "Elmur made you the owner of \"Nile Foods\".",
  leadId: "lead-1",
};

describe("where tapping a push lands (ADR-065 decision F)", () => {
  it("deep-links a lead in ITS OWN app", () => {
    expect(deepLinkFor({ type: "assigned", leadId: "lead-1" }, "bsystems")).toBe(
      "/b-systems/crm/lead/lead-1",
    );
    expect(deepLinkFor({ type: "mention", leadId: "lead-1" }, "byteforce")).toBe(
      "/byteforce/leads/lead/lead-1",
    );
  });

  it("sends a link-less ByteForce mention to the ByteForce app, not the other one", () => {
    /* comments.ts nulls `leadId` for a byteforce lead ON PURPOSE, so that a
       dual-role user's other bell cannot deep-link into the wrong app. The push
       has to honour the same intent rather than default to B-Systems. */
    expect(deepLinkFor({ type: "mention", leadId: null }, null)).toBe("/byteforce");
  });

  it("sends a registration to Registrations and any other lead-less broadcast to the app", () => {
    expect(deepLinkFor({ type: "registration", leadId: null }, null)).toBe(
      "/b-systems/registrations",
    );
    expect(deepLinkFor({ type: "ready_to_close", leadId: null }, null)).toBe("/b-systems");
    expect(deepLinkFor({ type: "meeting_request", leadId: null }, null)).toBe("/b-systems");
    expect(deepLinkFor({ type: "needs_owner", leadId: null }, null)).toBe("/b-systems");
  });

  it("falls back to an app landing when the lead has since been deleted", () => {
    /* leadId set but no brand resolved = the row is gone; never build a link to
       a lead that will 404 */
    expect(deepLinkFor({ type: "ready_to_close", leadId: "gone" }, null)).toBe("/b-systems");
  });

  it("only ever produces a relative in-app path — never an absolute URL", () => {
    for (const type of ["assigned", "mention", "registration", "ready_to_close"]) {
      for (const brand of ["bsystems", "byteforce", null] as const) {
        for (const leadId of ["lead-1", null]) {
          const url = deepLinkFor({ type, leadId }, brand);
          expect(url.startsWith("/")).toBe(true);
          expect(url).not.toMatch(/^https?:|^\/\//);
        }
      }
    }
  });
});

describe("what a push actually carries (ADR-065 decision F — the privacy rule)", () => {
  it("carries the notification's OWN title and body and NOTHING else", () => {
    const payload = buildPushPayload(base, "bsystems");
    /* exactly four keys: anything added here would be data the bell never
       showed this person, which is the whole failure mode the rule prevents */
    expect(Object.keys(payload).sort()).toEqual(["body", "tag", "title", "url"]);
    expect(payload.title).toBe(base.title);
    expect(payload.body).toBe(base.body);
    expect(payload.url).toBe("/b-systems/crm/lead/lead-1");
  });

  it("tags on the notification id, so a redelivered push replaces rather than repeats", () => {
    expect(buildPushPayload(base, "bsystems").tag).toBe("n1");
    expect(buildPushPayload({ ...base, id: "n2" }, "bsystems").tag).toBe("n2");
  });

  it("never leaks the recipient's user id into the payload", () => {
    const json = JSON.stringify(buildPushPayload(base, "bsystems"));
    expect(json).not.toContain("u1");
  });
});
