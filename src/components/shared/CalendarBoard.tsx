"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { calendarPage as m } from "@/lib/i18n/dict/calendar";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";

/* ============================================================================
   ADR-071 — the calendar GRID.

   A month of cells, a day panel under it, and one modal for the viewer's own
   entries. Deliberately plain: the founder asked for "a sample calendar UI,
   good looking, creatively sound, but not that crazy" and, above that, "it has
   to be functional with the buttons and everything" — so every control here
   does something real.

   TWO THINGS THIS COMPONENT DOES NOT DO, and both are load-bearing:

   1. It never decides what may be seen. Every entry arrives with its `detail`
      already fixed by services/calendar.ts, and a "busy" entry simply has no
      title, no href and no note to render. The view cannot leak what it was
      never handed.

   2. The month is a URL, not state. Prev / Today / Next are LINKS carrying
      `?company=&y=&m=`, so a month is bookmarkable and forwardable — the same
      property ADR-067 gave the company switch — and the server re-queries
      rather than this component holding a second copy of the calendar.

   Only the SELECTED DAY and the person FILTER are client state: both are ways
   of looking at data already on the page, and a round trip for either would
   make the grid feel broken.

   The month cells are buttons and the chips inside them are inert SPANS. That
   is an accessibility rule, not a styling one — an anchor inside a button is
   invalid HTML and lands keyboard users in a control they cannot escape — so
   every link and every action lives in the day panel below, which is also the
   only place with room to say what a thing is.
   ========================================================================== */

export interface CalendarPersonView {
  id: string;
  name: string;
}

/** The values the edit form round-trips — Cairo-local, the SPEC §6.2 split
    shape every other form in this product submits. Present only on the
    viewer's OWN entries; nothing else is editable. */
export interface CalendarEventForm {
  title: string;
  note: string;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  shared: boolean;
}

export interface CalendarEntryView {
  kind: "meeting" | "personal";
  id: string;
  detail: "full" | "busy";
  title: string | null;
  href: string | null;
  note: string | null;
  mode: string | null;
  outcome: string | null;
  /** "2:30 PM" or the all-day label — already rendered in the reader's locale. */
  timeLabel: string;
  /** "2:30 PM – 3:30 PM" for the day panel. */
  rangeLabel: string;
  /** every Cairo date this entry occupies, clipped to the visible grid. */
  dates: string[];
  people: CalendarPersonView[];
  mine: boolean;
  form: CalendarEventForm | null;
}

export interface CalendarDayView {
  date: string;
  inMonth: boolean;
  /** the day number, in the reader's numerals. */
  label: string;
  weekend: boolean;
}

export interface CalendarBoardProps {
  monthLabel: string;
  /** "2026-08" — identifies WHICH month is on screen. See the reset below. */
  monthKey: string;
  days: CalendarDayView[];
  weekdays: string[];
  todayDate: string;
  /** today, when it is on this grid — else the first day of the shown month. */
  initialSelected: string;
  entries: CalendarEntryView[];
  people: CalendarPersonView[];
  selfId: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  /** the day-panel heading for each date, pre-rendered per locale. */
  dayLabels: Record<string, string>;
}

const MAX_CHIPS = 3;

export function CalendarBoard(props: CalendarBoardProps) {
  const t = tFor(useLocale());
  const router = useRouter();
  const [selected, setSelected] = useState(props.initialSelected);
  const [person, setPerson] = useState("");

  /* Paging to another month is a SERVER navigation with the same component, so
     React keeps this state and `useState`'s initial value is never re-applied:
     the selected day would stay on a date that is no longer drawn, and the day
     panel under a freshly-loaded September would read "Nothing on this day"
     over August's date. Reset it as the month changes — React's documented
     adjust-state-during-render pattern, which re-renders before painting, so
     nothing wrong is ever shown.

     Deliberately NOT a `key` on this component, which would also work: a key
     remounts, throwing away the person filter too, and "show me Y's month, and
     the next one" is exactly what somebody checking availability does. */
  const [seenMonth, setSeenMonth] = useState(props.monthKey);
  if (props.monthKey !== seenMonth) {
    setSeenMonth(props.monthKey);
    setSelected(props.initialSelected);
  }
  /* null = closed. `{ entry: null }` = adding, `{ entry }` = editing. */
  const [editing, setEditing] = useState<{ entry: CalendarEntryView | null } | null>(null);

  /* The filter asks "whose time is this?", so it matches against the OCCUPANTS
     — not the author. A meeting X booked that blocks Y belongs on Y's filter,
     which is the entire point of the picker that put Y there. */
  const visible = useMemo(
    () => (person ? props.entries.filter((e) => e.people.some((p) => p.id === person)) : props.entries),
    [props.entries, person],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntryView[]>();
    for (const entry of visible) {
      for (const date of entry.dates) {
        const list = map.get(date);
        if (list) list.push(entry);
        else map.set(date, [entry]);
      }
    }
    return map;
  }, [visible]);

  const dayEntries = byDate.get(selected) ?? [];

  const outcomeLabel = (outcome: string | null) =>
    outcome === "attended"
      ? t(m.outcomeAttended)
      : outcome === "cancelled"
        ? t(m.outcomeCancelled)
        : outcome === "delayed"
          ? t(m.outcomeDelayed)
          : null;

  return (
    <>
      <div className="card card--flush0">
        <div className="cal-bar">
          <span className="cal-month">{props.monthLabel}</span>

          <span className="cal-nav">
            <Link href={props.prevHref} className="cal-step" aria-label={t(m.prevMonth)}>
              <span className="cal-step-glyph" aria-hidden="true">
                ‹
              </span>
            </Link>
            <Link href={props.todayHref} className="btn-ghost btn--sm">
              {t(m.today)}
            </Link>
            <Link href={props.nextHref} className="cal-step" aria-label={t(m.nextMonth)}>
              <span className="cal-step-glyph" aria-hidden="true">
                ›
              </span>
            </Link>
          </span>

          <label className="sr-only" htmlFor="cal-person">
            {t(m.filterPerson)}
          </label>
          <select
            id="cal-person"
            className={inputCls}
            style={{ width: "auto", minWidth: "12rem" }}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="">{t(m.everyone)}</option>
            {props.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === props.selfId ? `${p.name} — ${t(m.onlyMine)}` : p.name}
              </option>
            ))}
          </select>

          <button type="button" className={`${btnPrimary} btn--sm`} onClick={() => setEditing({ entry: null })}>
            {t(m.addEntry)}
          </button>
        </div>

        <div className="cal-grid" role="grid">
          {props.weekdays.map((label, i) => (
            <div key={label + i} className="cal-dow" role="columnheader" data-weekend={i >= 5}>
              {label}
            </div>
          ))}

          {props.days.map((day) => {
            const list = byDate.get(day.date) ?? [];
            const shown = list.slice(0, MAX_CHIPS);
            const hidden = list.length - shown.length;
            return (
              <button
                key={day.date}
                type="button"
                className="cal-cell"
                data-in-month={day.inMonth}
                data-today={day.date === props.todayDate}
                data-weekend={day.weekend}
                aria-pressed={day.date === selected}
                onClick={() => setSelected(day.date)}
              >
                <span className="cal-dayhead">
                  <span className="cal-daynum">{day.label}</span>
                  {list.length > 0 ? <span className="cal-daycount">{list.length}</span> : null}
                </span>

                {shown.map((entry) => (
                  <span
                    key={`${entry.kind}-${entry.id}`}
                    className="cal-chip"
                    /* a BUSY chip is "busy", not "a busy meeting": the DOM must
                       not distinguish somebody's client call from their dentist
                       either, or the contract holds on screen and leaks in the
                       inspector */
                    data-kind={entry.detail === "busy" ? "busy" : entry.kind}
                    data-detail={entry.detail}
                    data-outcome={entry.outcome ?? undefined}
                  >
                    <span className="cal-chip-time">{entry.timeLabel}</span>
                    <span className="cal-chip-text">
                      {/* a busy block names the PERSON and nothing else — it is
                          the answer to "is Y free?", and it is the whole answer */}
                      {entry.detail === "busy"
                        ? `${t(m.busy)} · ${entry.people[0]?.name ?? ""}`
                        : entry.title}
                    </span>
                  </span>
                ))}
                {hidden > 0 ? (
                  <span className="cal-more">{t(m.moreCount).replace("{n}", String(hidden))}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="cal-legend">
          <span className="cal-legend-key">
            <span className="cal-swatch" data-kind="meeting" />
            {t(m.kindMeeting)}
          </span>
          <span className="cal-legend-key">
            <span className="cal-swatch" data-kind="personal" />
            {t(m.kindPersonal)}
          </span>
          <span className="cal-legend-key">
            <span className="cal-swatch" data-kind="busy" />
            {t(m.busyHint)}
          </span>
        </div>
      </div>

      <div className="card card--flush">
        <div className="card-head">
          <h2 className="u-h3">{props.dayLabels[selected] ?? selected}</h2>
          <button
            type="button"
            className={`${btnGhost} btn--sm`}
            onClick={() => setEditing({ entry: null })}
          >
            {t(m.addEntry)}
          </button>
        </div>

        {dayEntries.length === 0 ? (
          <div className="empty card-pad">{t(m.nothingOn)}</div>
        ) : (
          <div className="cal-day">
            {dayEntries.map((entry) => (
              <div key={`${entry.kind}-${entry.id}`} className="cal-row">
                <span className="cal-row-time">{entry.rangeLabel}</span>
                <span className="cal-row-main">
                  <span className="cal-row-title" data-detail={entry.detail}>
                    {entry.detail === "busy" ? t(m.busy) : entry.title}
                  </span>
                  <span className="cal-row-meta">
                    {/* the kind is withheld on a busy row for the same reason
                        the title is: "Y is in a client meeting" and "Y has a
                        personal appointment" are two different facts, and the
                        busy contract promises neither — only that the hour is
                        taken, and by whom */}
                    {entry.detail === "busy" ? null : (
                      <span className="chip-outline">
                        {t(entry.kind === "meeting" ? m.kindMeeting : m.kindPersonal)}
                      </span>
                    )}
                    {entry.mode ? (
                      <span className="chip-outline">
                        {t(entry.mode === "online" ? m.online : m.offline)}
                      </span>
                    ) : null}
                    {outcomeLabel(entry.outcome) ? (
                      <span className="chip-outline">{outcomeLabel(entry.outcome)}</span>
                    ) : null}
                    <span className="cal-people">
                      {entry.people.map((p) => (
                        <span key={p.id} className="cal-person">
                          {p.name}
                        </span>
                      ))}
                    </span>
                  </span>
                  {entry.note ? <span className="cal-row-note">{entry.note}</span> : null}
                </span>

                <span className="cal-row-actions">
                  {entry.href ? (
                    <Link href={entry.href} className={`${btnGhost} btn--sm`}>
                      {t(m.openLead)}
                    </Link>
                  ) : null}
                  {entry.mine && entry.form ? (
                    <>
                      <button
                        type="button"
                        className={`${btnGhost} btn--sm`}
                        onClick={() => setEditing({ entry })}
                      >
                        {t(m.editEntry)}
                      </button>
                      <DeleteEntryButton id={entry.id} onDone={() => router.refresh()} />
                    </>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing ? (
        <EventDialog
          entry={editing.entry}
          defaultDate={selected}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ delete */

function DeleteEntryButton({ id, onDone }: { id: string; onDone: () => void }) {
  const t = tFor(useLocale());
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-danger btn--sm"
      disabled={busy}
      onClick={async () => {
        if (!confirm(t(m.removeConfirm))) return;
        setBusy(true);
        const res = await fetch(`/api/calendar/events/${id}`, { method: "DELETE" });
        setBusy(false);
        if (res.ok) onDone();
        else alert(t(m.saveFailed));
      }}
    >
      {t(m.remove)}
    </button>
  );
}

/* -------------------------------------------------------------- the dialog */

function EventDialog({
  entry,
  defaultDate,
  onClose,
  onSaved,
}: {
  entry: CalendarEntryView | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = tFor(useLocale());
  const initial: CalendarEventForm = entry?.form ?? {
    title: "",
    note: "",
    date: defaultDate,
    time: "09:00",
    endDate: defaultDate,
    endTime: "10:00",
    allDay: false,
    shared: false,
  };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CalendarEventForm>(key: K, value: CalendarEventForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* ---- the END FOLLOWS THE START ------------------------------------------

     Moving the start alone used to leave the end where it was, so pushing a
     09:00–10:00 entry to 11:30 produced an entry ending an hour and a half
     before it began — which the server correctly refused, leaving somebody
     staring at "It has to end after it starts" for a mistake the form had made
     on their behalf. Changing the start now carries the end with it, keeping
     the duration the person had already chosen, which is what every calendar
     they have ever used does.

     The arithmetic is on the WALL CLOCK — `Date.UTC` used purely as
     minutes-since-epoch on the typed digits, never as an instant. The Cairo
     conversion happens once, server-side, in `eventWindow`; doing it here as
     well would be a second timezone opinion in a component. */
  const wallMinutes = (date: string, time: string) => {
    const [y, mo, d] = date.split("-").map(Number);
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    return Date.UTC(y!, mo! - 1, d!, hh!, mm!) / 60_000;
  };
  const fromWallMinutes = (mins: number) => {
    const at = new Date(mins * 60_000);
    const p2 = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${at.getUTCFullYear()}-${p2(at.getUTCMonth() + 1)}-${p2(at.getUTCDate())}`,
      time: `${p2(at.getUTCHours())}:${p2(at.getUTCMinutes())}`,
    };
  };
  const moveStart = (patch: Partial<CalendarEventForm>) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      /* the duration the person already chose, floored at a quarter of an hour
         so an entry that was somehow inverted comes back valid rather than
         staying inverted for ever */
      const held = Math.max(
        15,
        wallMinutes(f.endDate || f.date, f.endTime) - wallMinutes(f.date, f.time),
      );
      const moved = fromWallMinutes(wallMinutes(next.date, next.time) + held);
      return { ...next, endDate: moved.date, endTime: moved.time };
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title: form.title,
      note: form.note || undefined,
      date: form.date,
      /* an all-day entry posts NO clock — the service spans whole Cairo days,
         which is what keeps it correct across a DST jump */
      time: form.allDay ? undefined : form.time,
      endDate: form.endDate || form.date,
      endTime: form.allDay ? undefined : form.endTime,
      allDay: form.allDay,
      shared: form.shared,
    };
    const res = await fetch(
      entry ? `/api/calendar/events/${entry.id}` : "/api/calendar/events",
      {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setBusy(false);
    if (res.ok) {
      onSaved();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? t(m.saveFailed));
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t(m.addEntry)}>
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">{t(m.formEyebrow)}</div>
            <h2 className="modal-title">{t(entry ? m.editEntry : m.addEntry)}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t(m.cancel)}>
            ×
          </button>
        </div>

        <div className="modal-body modal-body--grid">
          <div className="field field--wide">
            <label className={labelCls} htmlFor="cal-title">
              {t(m.fieldTitle)}
            </label>
            <input
              id="cal-title"
              className={inputCls}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t(m.fieldTitlePlaceholder)}
              maxLength={200}
              required
              autoFocus
            />
          </div>

          <div className="field field--wide">
            <label className="u-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => set("allDay", e.target.checked)}
              />
              {t(m.fieldAllDay)}
            </label>
          </div>

          <div className="field">
            <label className={labelCls} htmlFor="cal-date">
              {t(m.fieldDate)}
            </label>
            <input
              id="cal-date"
              type="date"
              className={inputCls}
              value={form.date}
              onChange={(e) => moveStart({ date: e.target.value })}
              required
            />
          </div>

          {form.allDay ? null : (
            <div className="field">
              <label className={labelCls} htmlFor="cal-time">
                {t(m.fieldTime)}
              </label>
              <input
                id="cal-time"
                type="time"
                className={inputCls}
                value={form.time}
                onChange={(e) => moveStart({ time: e.target.value })}
                required
              />
            </div>
          )}

          <div className="field">
            <label className={labelCls} htmlFor="cal-end-date">
              {t(m.fieldEndDate)}
            </label>
            <input
              id="cal-end-date"
              type="date"
              className={inputCls}
              value={form.endDate}
              min={form.date}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </div>

          {form.allDay ? null : (
            <div className="field">
              <label className={labelCls} htmlFor="cal-end-time">
                {t(m.fieldEndTime)}
              </label>
              <input
                id="cal-end-time"
                type="time"
                className={inputCls}
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          )}

          <div className="field field--wide">
            <label className={labelCls} htmlFor="cal-note">
              {t(m.fieldNote)}
            </label>
            <textarea
              id="cal-note"
              className={inputCls}
              rows={2}
              maxLength={2000}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>

          <div className="field field--wide">
            <label className="u-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={form.shared}
                onChange={(e) => set("shared", e.target.checked)}
              />
              {t(m.fieldShared)}
            </label>
            <span className="field-hint">{t(m.sharedHint)}</span>
          </div>

          {error ? (
            <p className="field--wide" style={{ color: "var(--color-danger-ink)", margin: 0 }}>
              {error}
            </p>
          ) : null}
        </div>

        <div className="modal-foot">
          <button type="button" className={btnGhost} onClick={onClose}>
            {t(m.cancel)}
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {t(busy ? m.saving : m.save)}
          </button>
        </div>
      </form>
    </div>
  );
}
