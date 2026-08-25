"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { bell } from "@/lib/i18n/dict/admin";

/* V2 §10 — the admin nav bell: polls /api/b-systems/notifications (ADR-009's
   polling pattern), shows unread count, click-through opens the lead. */

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  leadId: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 15_000;

export function NotificationsBell({
  apiBase = "/api/b-systems",
  leadPathBase = "/b-systems/crm/lead",
}: {
  apiBase?: string;
  leadPathBase?: string;
} = {}) {
  const router = useRouter();
  const t = tFor(useLocale());
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch(`${apiBase}/notifications`).catch(() => null);
      if (!res?.ok) return;
      const data = (await res.json()) as NotificationItem[];
      if (alive) setItems(data);
    }
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const unread = items.filter((n) => !n.readAt).length;

  async function openItem(n: NotificationItem) {
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
    void fetch(`${apiBase}/notifications/${n.id}`, { method: "PATCH" });
    setOpen(false);
    if (n.leadId) router.push(`${leadPathBase}/${n.leadId}`);
  }

  return (
    <div ref={boxRef} className="bell-wrap">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${t(bell.notificationsAria)}${
          unread ? t(bell.unreadSuffix).replace("{n}", String(unread)) : ""
        }`}
        className="bell"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? <span className="bell-count">{unread}</span> : null}
      </button>
      {open ? (
        <div className="bell-menu">
          {items.length === 0 ? (
            <p className="empty m-3">{t(bell.empty)}</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void openItem(n)}
                className="bell-item"
                /* the cue the CSS keys on — and the one an e2e can assert
                   without reading a colour */
                data-unread={n.readAt ? "false" : "true"}
              >
                <span className="bell-item-head">
                  {n.readAt ? null : (
                    /* role=img, not a bare <span>: ARIA 1.2 forbids a name on
                       role=generic, so a bare span's aria-label is dropped by
                       conforming assistive tech (ADR-064's finding). */
                    <span
                      className="bell-dot"
                      role="img"
                      aria-label={t(bell.unread)}
                      title={t(bell.unread)}
                    />
                  )}
                  <span className="bell-item-title">{n.title}</span>
                </span>
                <span className="feed-text text-brand-muted mt-0.5 whitespace-pre-wrap block">
                  {n.body}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
