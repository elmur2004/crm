import type { ReactNode } from "react";

/* "View as table" — the exact values behind a chart, in a native
   <details>/<summary>: no JavaScript, keyboard-operable, and the same for a
   sighted reader who wants the numbers and a screen-reader user who cannot
   see the bars. The table scrolls INSIDE its card if it ever has to, so it
   can never widen the page. */

export function ChartTable({
  label,
  head,
  rows,
  caption,
}: {
  label: string;
  head: string[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <details className="db-table">
      <summary className="db-table-summary">{label}</summary>
      <div className="db-table-scroll">
        <table className="db-table-grid">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={c}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
