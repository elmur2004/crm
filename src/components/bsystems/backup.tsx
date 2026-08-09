"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* Founder directive — one-click full backup and restore, admin Home.
   Export downloads everything (data + uploads) as one JSON file; Import
   REPLACES the whole system with a backup, even onto a wiped database. */

export function BackupControls() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runImport() {
    if (!pending) return;
    const fd = new FormData();
    fd.append("backup", pending);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/b-systems/backup", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Import failed — nothing was changed");
      return;
    }
    setPending(null);
    if (fileRef.current) fileRef.current.value = "";
    setDone(true);
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2 flex-wrap">
      {error ? (
        <span role="alert" className="alert-error">
          {error}
        </span>
      ) : null}
      {done ? (
        <span role="status" className="info-banner mb-0 py-2">
          Backup restored.
        </span>
      ) : null}
      <a href="/api/b-systems/backup" className="btn-ghost btn--sm" download>
        Export data
      </a>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        aria-label="Backup file"
        className="hidden"
        onChange={(e) => {
          setDone(false);
          setPending(e.target.files?.[0] ?? null);
        }}
      />
      {pending ? (
        <span className="flex items-center gap-2 flex-wrap">
          <span className="u-muted">
            Restore “{pending.name}”? This replaces ALL current data.
          </span>
          <button type="button" disabled={busy} onClick={runImport} className="btn-danger btn-danger--solid btn--sm">
            Yes, restore backup
          </button>
          <button
            type="button"
            className="btn-ghost btn--sm"
            onClick={() => {
              setPending(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="btn-ghost btn--sm" onClick={() => fileRef.current?.click()}>
          Import data
        </button>
      )}
    </span>
  );
}
