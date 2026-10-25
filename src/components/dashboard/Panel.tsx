import type { ReactNode } from "react";

/* Every Home chart is a <figure> (dashboard spec §4): a figcaption with the
   title and a mono eyebrow naming its TIME SCOPE (TODAY, NOW, or the period),
   a one-sentence visible summary — the insight — and, where it is a chart, a
   zero-JavaScript "View as table" with the exact values. A card the range does
   not scope says so in its eyebrow, so no number can be mistaken for the
   period. */

export function Panel({
  id,
  title,
  eyebrow,
  action,
  summary,
  className = "",
  table,
  children,
  data,
}: {
  id: string;
  title: string;
  eyebrow: string;
  action?: ReactNode;
  summary?: ReactNode;
  className?: string;
  table?: ReactNode;
  children?: ReactNode;
  data?: Record<`data-${string}`, string | number>;
}) {
  return (
    <figure className={`db-card db-panel ${className}`} aria-labelledby={`${id}-title`} id={id} {...data}>
      <figcaption className="db-panel-head">
        <span className="db-panel-titles">
          <h2 className="db-panel-title" id={`${id}-title`}>
            {title}
          </h2>
          <span className="db-eyebrow">{eyebrow}</span>
        </span>
        {action ? <span className="db-panel-action">{action}</span> : null}
      </figcaption>
      {summary ? <p className="db-summary">{summary}</p> : null}
      {children}
      {table}
    </figure>
  );
}
