import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { NeedsYou as NeedsYouData } from "@/lib/services/dashboard";
import { Panel } from "./Panel";
import type { DashCtx } from "./ctx";

/* W9 — what is waiting on the B-Systems admin (restores the approved "Needs
   the admin" card, dashboard spec A14): the sign-ups waiting for approval.
   Statements and milestones are already rows on the tasks card and are not
   repeated here. Never rendered under ByteForce — the service does not even
   query it there.

   ADR-107 — the deals an owner had flagged "ready to close" used to sit here
   too; the flag is gone (founder: "remove the whole mark ready to close
   thing").

   The waiting sign-ups are a COUNT here: Registrations is in the Partners &
   Agents menu, so a "Review registrations" link would be a second way to it
   (one way to each page). */

export function NeedsYou({ data, ctx }: { data: NeedsYouData; ctx: DashCtx }) {
  const { t, f } = ctx;
  return (
    <Panel
      id="db-needs"
      className="db-w-needs"
      title={t(m.needsYou)}
      eyebrow={t(m.eyebrowNow)}
      data={{
        "data-metric": "needs_you",
        "data-registrations": data.pendingRegistrations,
      }}
    >
      {data.pendingRegistrations === 0 ? (
        <p className="db-empty">{t(m.nothingWaiting)}</p>
      ) : (
        <div className="db-needs">
          <section className="db-needs-group">
            <h3 className="db-needs-title">{f(m.registrationsWaiting, { n: data.pendingRegistrations })}</h3>
          </section>
        </div>
      )}
    </Panel>
  );
}
