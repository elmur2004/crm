"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary } from "@/components/portal/groupForms";
import { useLocale } from "@/components/shared/LocaleProvider";
import { formatMsg, tFor } from "@/lib/i18n/core";
import { common } from "@/lib/i18n/dict/crm";
import { massAssign as m } from "@/lib/i18n/dict/users-app";

/* ADR-105 — the ticking half of "Assign leads" (MassAssignBody draws the
   filters and resolves every label on the server, so the rows arrive as plain
   strings). One press hands every ticked lead to the person; the list then
   re-renders without them, and the floating Undo pill offers the whole batch
   back. */

export interface MassAssignRow {
  id: string;
  name: string;
  companyName: string | null;
  number: string;
  /** "B-Systems" / "ByteForce" */
  crm: string;
  stage: string;
  owner: string;
  added: string;
}

export function MassAssignForm({
  targetId,
  targetName,
  rows,
  countLine,
}: {
  targetId: string;
  targetName: string;
  rows: MassAssignRow[];
  countLine: string;
}) {
  const t = tFor(useLocale());
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const head = useRef<HTMLInputElement>(null);

  /* only what is on screen counts — a filter change or a refresh drops the rest */
  const chosen = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const all = rows.length > 0 && chosen.length === rows.length;
  const some = chosen.length > 0 && !all;
  useEffect(() => {
    if (head.current) head.current.indeterminate = some;
  }, [some]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setDone(null);
    const res = await fetch(`/api/users/${targetId}/assign-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: chosen }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string; assigned?: number } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? t(common.somethingWentWrong));
      router.refresh();
      return;
    }
    const n = data?.assigned ?? 0;
    setDone(
      n === 1
        ? t(formatMsg(m.doneOne, { name: targetName }))
        : t(formatMsg(m.doneMany, { n: String(n), name: targetName })),
    );
    setSelected(new Set());
    router.refresh();
  }

  const label =
    chosen.length === 0
      ? t(formatMsg(m.submitNone, { name: targetName }))
      : chosen.length === 1
        ? t(formatMsg(m.submitOne, { name: targetName }))
        : t(formatMsg(m.submitMany, { n: String(chosen.length), name: targetName }));

  return (
    <div className="card card--flush0 lx-assign-card">
      <div className="lx-assign-bar">
        <p className="lx-assign-count">
          <span>{countLine}</span>
          {chosen.length > 0 ? (
            <span className="lx-assign-chosen">{t(formatMsg(m.selected, { n: String(chosen.length) }))}</span>
          ) : null}
        </p>
        <button
          type="button"
          className={btnPrimary}
          disabled={busy || chosen.length === 0}
          onClick={() => void submit()}
        >
          {busy ? t(m.working) : label}
        </button>
      </div>
      {error ? (
        <p role="alert" className="alert-error lx-assign-note">
          {error}
        </p>
      ) : null}
      {done ? (
        <div className="lx-assign-note">
          <p role="status" className="text-sm text-brand-success">
            {done}
          </p>
          <p className="u-muted">{t(m.undoHint)}</p>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <div className="card-pad">
          <p className="empty">{t(m.empty)}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table table--wrap">
            <thead>
              <tr>
                <th className="lx-assign-check">
                  {/* the label is the tap target (44px on touch); the box keeps its own name */}
                  <label className="lx-assign-hit">
                    <input
                      ref={head}
                      type="checkbox"
                      checked={all}
                      aria-label={t(m.selectAll)}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                      }
                    />
                  </label>
                </th>
                <th>{t(m.thLead)}</th>
                <th>{t(common.number)}</th>
                <th>{t(m.crm)}</th>
                <th>{t(m.stage)}</th>
                <th>{t(m.owner)}</th>
                <th>{t(m.thAdded)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = selected.has(r.id);
                const box = `mass-assign-${r.id}`;
                return (
                  <tr key={r.id} data-selected={on ? "" : undefined}>
                    <td className="lx-assign-check">
                      <label className="lx-assign-hit">
                        <input
                          id={box}
                          type="checkbox"
                          checked={on}
                          aria-label={t(formatMsg(m.selectRow, { name: r.name }))}
                          onChange={(e) => toggle(r.id, e.target.checked)}
                        />
                      </label>
                    </td>
                    <td>
                      {/* the name ticks the row too — a bigger target than the box */}
                      <label htmlFor={box} className="td-title lx-assign-name">
                        {r.name}
                      </label>
                      {r.companyName ? (
                        <span className="block text-xs text-brand-muted">{r.companyName}</span>
                      ) : null}
                    </td>
                    <td className="td-mono">{r.number}</td>
                    <td>
                      <span className="badge badge--entity">{r.crm}</span>
                    </td>
                    <td>
                      <span className="chip-outline">{r.stage}</span>
                    </td>
                    <td>{r.owner}</td>
                    <td className="td-nowrap">{r.added}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
