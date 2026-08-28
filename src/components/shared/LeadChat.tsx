"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { formatCairoShort } from "@/lib/datetime";
import { useLocale } from "@/components/shared/LocaleProvider";
import { chat } from "@/lib/i18n/dict/chat";

/* Founder: the mini chat inside every lead. Thread + composer with @mention
   autocomplete (type "@", pick with mouse or ↑/↓ + Enter). Mentions are
   resolved SERVER-side; this list only powers suggestions and highlighting. */

export interface ChatComment {
  id: string;
  authorUserId: string | null;
  authorLabel: string;
  body: string;
  mentions: Array<{ userId: string; name: string }>;
  createdAt: string; // ISO
}

export interface ChatMentionable {
  userId: string;
  name: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits the body so resolved @mentions render as chips (same word boundaries
    as the server's resolveMentions). */
function renderBody(body: string, mentions: Array<{ name: string }>) {
  if (mentions.length === 0) return body;
  const names = mentions
    .map((m) => m.name)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe);
  const re = new RegExp(`(?<=^|[^A-Za-z0-9@])@(?:${names.join("|")})(?![A-Za-z0-9])`, "gi");
  const parts: Array<{ text: string; mention: boolean }> = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    if (m.index! > last) parts.push({ text: body.slice(last, m.index), mention: false });
    parts.push({ text: m[0], mention: true });
    last = m.index! + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last), mention: false });
  return parts.map((p, i) =>
    p.mention ? (
      <span key={i} className="chat-mention">
        {p.text}
      </span>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  );
}

/** The "@" being typed at the caret: must start the text or follow whitespace
    (so emails like a@b.com never trigger), and the query runs @→caret. */
function activeMentionAt(text: string, caret: number): { at: number; query: string } | null {
  const head = text.slice(0, caret);
  const at = head.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(head[at - 1]!)) return null;
  const query = head.slice(at + 1);
  if (query.length > 40 || query.includes("\n")) return null;
  return { at, query };
}

export function LeadChat({
  postUrl,
  comments,
  mentionables,
  currentUserId,
}: {
  postUrl: string;
  comments: ChatComment[];
  mentionables: ChatMentionable[];
  currentUserId: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLUListElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{ at: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false); // Escape mutes until the next "@"

  /* newest message stays in view */
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const suggestions = useMemo(() => {
    if (!active || dismissed) return [];
    const q = active.query.toLowerCase();
    return mentionables.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [active, dismissed, mentionables]);

  function syncActive(el: HTMLTextAreaElement) {
    const found = activeMentionAt(el.value, el.selectionStart ?? el.value.length);
    setActive(found);
    if (!found) setDismissed(false);
    setHighlight(0);
  }

  function pick(m: ChatMentionable) {
    if (!active) return;
    const caret = areaRef.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, active.at)}@${m.name} ${text.slice(caret)}`;
    setText(next);
    setActive(null);
    setDismissed(false);
    areaRef.current?.focus();
  }

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t(chat.sendFailed));
      return;
    }
    setText("");
    setActive(null);
    router.refresh();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[highlight] ?? suggestions[0]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="card card--flush0">
      <div className="card-head">
        <h2 className="u-h3">{t(chat.title)}</h2>
      </div>
      <div className="card-pad space-y-3">
        {comments.length === 0 ? (
          <p className="empty">{t(chat.empty)}</p>
        ) : (
          <ul ref={threadRef} className="chat-thread">
            {comments.map((c) => (
              <li
                key={c.id}
                className={`chat-msg ${c.authorUserId === currentUserId ? "chat-msg--mine" : ""}`}
              >
                <p className="chat-meta">
                  <span className="chat-author">{c.authorLabel}</span>
                  <span className="chat-time">{formatCairoShort(new Date(c.createdAt), locale)}</span>
                </p>
                <p className="chat-body" dir="auto">{renderBody(c.body, c.mentions)}</p>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p role="alert" className="alert-error">
            {error}
          </p>
        ) : null}

        <div className="chat-composer">
          {suggestions.length > 0 ? (
            <ul className="chat-suggest" role="listbox" aria-label={t(chat.mentionListLabel)}>
              {suggestions.map((m, i) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    data-active={i === highlight ? "true" : undefined}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(m)}
                  >
                    @{m.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              syncActive(e.target);
            }}
            onClick={(e) => syncActive(e.currentTarget)}
            onKeyUp={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                syncActive(e.currentTarget);
            }}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={2000}
            dir="auto"
            placeholder={t(chat.composerPlaceholder)}
            aria-label={t(chat.composerLabel)}
            className="field-input chat-input"
          />
          <div className="chat-actions">
            <span className="u-muted">{t(chat.enterHint)}</span>
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => void submit()}
              className="btn-primary btn--sm"
            >
              {t(chat.send)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
