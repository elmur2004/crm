import type { Brand } from "@/lib/pipeline-engine/constants";

/* ADR-065 — what a phone actually receives, and where tapping it goes.

   PRIVACY RULE: a push carries the notification's OWN title and body and
   nothing else. Those are the exact two strings `listNotifications` already
   hands that same recipient through the bell, so the push respects the same
   wall the in-app row does — by carrying no more than it. Nothing is looked up
   and added here: no lead field, no money, no counterparty detail. The only
   thing computed is a URL, and it is a route, not data.

   Everything in this file is PURE, so the wall and the deep link are unit-
   testable without a database, a browser or a push service. */

export type NotificationForPush = {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  body: string;
  leadId: string | null;
};

export type PushPayload = {
  title: string;
  body: string;
  /** an in-app path; the service worker resolves it against our own origin */
  url: string;
  /** the device collapses repeats of the same tag — one row, one card, so a
      push service that redelivers cannot show the founder the same news twice */
  tag: string;
};

/** Where tapping this notification should land.

    A Notification row does not record which APP it belongs to (the two bells
    solve that with a `leadPathBase` prop), so the brand comes from the LEAD
    when there is one. Without a lead the type is exact enough:
      · `mention` with a null leadId is a BYTEFORCE lead by construction —
        comments.ts nulls the id only for that brand, precisely so a dual-role
        user's other bell cannot deep-link into the wrong app;
      · `registration` is the admin broadcast about a new agent, whose screen is
        Registrations;
      · everything else that reaches here is a B-Systems admin broadcast whose
        lead has since been deleted — its app landing is the honest answer. */
export function deepLinkFor(
  n: Pick<NotificationForPush, "type" | "leadId">,
  leadBrand: Brand | null,
): string {
  /* ADR-067 — the merged shell. New pushes carry the merged address with the
     company spelled out; pushes ALREADY DELIVERED still carry /byteforce/...
     and reach the same screen through the redirect map in lib/crm/legacy-routes
     (which is why that map is permanent furniture, not a transition). */
  if (n.leadId && leadBrand === "bsystems") {
    return `/b-systems/crm/lead/${n.leadId}?company=bsystems`;
  }
  if (n.leadId && leadBrand === "byteforce") {
    return `/b-systems/leads/lead/${n.leadId}?company=byteforce`;
  }
  if (n.leadId === null && n.type === "mention") return "/b-systems?company=byteforce";
  if (n.type === "registration") return "/b-systems/registrations";
  return "/b-systems";
}

export function buildPushPayload(n: NotificationForPush, leadBrand: Brand | null): PushPayload {
  return {
    title: n.title,
    body: n.body,
    url: deepLinkFor(n, leadBrand),
    tag: n.id,
  };
}
