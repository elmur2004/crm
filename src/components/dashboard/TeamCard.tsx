import { formatEGP } from "@/lib/money";
import { ratePct } from "@/lib/dashboard/delta";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { TeamRow } from "@/lib/services/dashboard";
import { Panel } from "./Panel";
import { cssVars, type DashCtx } from "./ctx";

/* W12 — team performance in the period (restores the approved "reps side
   card", dashboard spec A14). Owner identity is the one every owner surface
   shows (todo.ts `ownerNameOf`): the owner account, else the internal rep
   card, else the referring partner company, else Unassigned — credited to each
   lead's CURRENT owner, and the footnote says so. Only owners with activity in
   the period or open leads now get a row.

   A real <table> in a wide card; below 560px of card width each owner becomes
   a block (name, bar, figures) through a container query — the page never
   scrolls sideways. The bar is the win rate on a 0–100% track; "—" when
   nothing was decided. */

export function TeamCard({ rows, ctx }: { rows: TeamRow[]; ctx: DashCtx }) {
  const { t, f } = ctx;
  const leader = rows.find((r) => r.wonValue > 0);
  return (
    <Panel
      id="db-team"
      className="db-w-team"
      title={t(m.team)}
      eyebrow={ctx.curDatesShort}
      data={{ "data-metric": "team", "data-value": rows.length }}
      summary={
        rows.length === 0
          ? f(m.teamEmpty, { dates: ctx.curDates })
          : leader
            ? f(m.teamSummary, { name: leader.name ?? t(m.unassigned), dates: ctx.curDates })
            : undefined
      }
    >
      {rows.length === 0 ? null : (
        <div className="db-team-wrap">
          <table className="db-team" role="table">
            <thead>
              <tr role="row">
                <th scope="col" role="columnheader">{t(m.colOwner)}</th>
                <th scope="col" role="columnheader">{t(m.colNew)}</th>
                <th scope="col" role="columnheader">{t(m.colWon)}</th>
                <th scope="col" role="columnheader">{t(m.colRate)}</th>
                <th scope="col" role="columnheader">{t(m.colOpen)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = ratePct({ won: r.wonCount, lost: r.lostCount });
                return (
                  <tr key={r.key} role="row" data-owner={r.name ?? ""}>
                    <th scope="row" role="rowheader" className="db-team-name">
                      {r.name ?? t(m.unassigned)}
                    </th>
                    <td role="cell" data-label={t(m.colNew)}>
                      <bdi>{r.newCount}</bdi>
                    </td>
                    <td role="cell" data-label={t(m.colWon)}>
                      <bdi>{r.wonCount}</bdi>
                      {r.wonValue > 0 ? (
                        <span className="db-team-money">
                          {" · "}
                          <bdi>{formatEGP(r.wonValue)}</bdi>
                        </span>
                      ) : null}
                    </td>
                    <td role="cell" data-label={t(m.colRate)} className="db-team-rate">
                      <span
                        className="db-team-track"
                        aria-hidden
                        style={cssVars({ "--v": pct === null ? 0 : pct / 100, "--i": Math.min(i, 5) })}
                      >
                        <span className="db-team-bar" />
                      </span>
                      <bdi>{pct === null ? "—" : `${pct}%`}</bdi>
                    </td>
                    <td role="cell" data-label={t(m.colOpen)}>
                      <bdi>{r.openCount}</bdi>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="db-caption">{t(m.teamFootnote)}</p>
    </Panel>
  );
}
