import Link from "next/link";
import { leadHref } from "@/lib/crm/surface";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { NeedsYou as NeedsYouData } from "@/lib/services/dashboard";
import { Panel } from "./Panel";
import type { DashCtx } from "./ctx";

/* W9 — what is waiting on the B-Systems admin (restores the approved "Needs
   the admin" card, dashboard spec A14). Two things only: deals an owner has
   flagged ready to close (only the admin moves a deal to Won), and sign-ups
   waiting for approval. Statements and milestones are already rows on the
   tasks card and are not repeated here. Never rendered under ByteForce — the
   service does not even query it there.

   The waiting sign-ups are a COUNT here: Registrations is in the Partners &
   Agents menu, so a "Review registrations" link would be a second way to it
   (one way to each page). The deals ready to close are records, and stay
   links. */

export function NeedsYou({ data, ctx }: { data: NeedsYouData; ctx: DashCtx }) {
  const { t, f } = ctx;
  const nothing = data.readyToClose.count === 0 && data.pendingRegistrations === 0;
  return (
    <Panel
      id="db-needs"
      className="db-w-needs"
      title={t(m.needsYou)}
      eyebrow={t(m.eyebrowNow)}
      data={{
        "data-metric": "needs_you",
        "data-ready": data.readyToClose.count,
        "data-registrations": data.pendingRegistrations,
      }}
    >
      {nothing ? (
        <p className="db-empty">{t(m.nothingWaiting)}</p>
      ) : (
        <div className="db-needs">
          {data.readyToClose.count > 0 ? (
            <section className="db-needs-group">
              <h3 className="db-needs-title">{f(m.readyToClose, { n: data.readyToClose.count })}</h3>
              <ul className="db-needs-list">
                {data.readyToClose.leads.map((lead) => (
                  <li key={lead.id}>
                    <Link href={leadHref("bsystems", lead.id)} prefetch={false} className="db-row-link">
                      {lead.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {data.pendingRegistrations > 0 ? (
            <section className="db-needs-group">
              <h3 className="db-needs-title">{f(m.registrationsWaiting, { n: data.pendingRegistrations })}</h3>
            </section>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
