"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch("/api/b-systems/notifications").catch(() => null);
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
    void fetch(`/api/b-systems/notifications/${n.id}`, { method: "PATCH" });
    setOpen(false);
    if (n.leadId) router.push(`/b-systems/crm/lead/${n.leadId}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative px-2 py-1.5 rounded-brand-control text-sm text-brand-link hover:bg-brand-surface-tint"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -top-1 -end-1 bg-brand-danger text-brand-on-danger text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute end-0 top-full mt-1 w-80 max-h-96 overflow-y-auto bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card z-50">
          {items.length === 0 ? (
            <p className="text-sm text-brand-muted p-4">No notifications yet.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void openItem(n)}
                className={`block w-full text-start p-3 border-b border-brand-border last:border-0 hover:bg-brand-surface-tint ${
                  n.readAt ? "opacity-60" : ""
                }`}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-brand-muted mt-0.5 whitespace-pre-wrap">{n.body}</p>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
