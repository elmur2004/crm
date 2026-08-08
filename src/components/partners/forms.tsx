"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* Partners pipeline client forms: add prospect, number 2/3 slots (PP-2 fires
   server-side on save), recording upload (§7.2). */

const inputCls =
  "w-full border border-brand-border rounded-brand-control px-3 py-2 bg-brand-surface-card text-sm";
const labelCls = "block text-sm font-medium mb-1";
const btnPrimary =
  "bg-brand-primary text-brand-on-primary rounded-brand-control px-4 py-2 text-sm font-medium disabled:opacity-50";

export function AddProspectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        Add partner lead
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch("/api/b-systems/partners-pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(fd.get("name")),
            companyName: String(fd.get("companyName")),
            role: String(fd.get("role") || "") || undefined,
            email: String(fd.get("email") || "") || undefined,
            number: String(fd.get("number")),
            businessActivity: String(fd.get("businessActivity")),
            description: String(fd.get("description") || "") || undefined,
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Something went wrong");
          return;
        }
        setOpen(false);
        router.refresh();
      }}
      className="border border-brand-border rounded-brand-card p-4 space-y-3 bg-brand-surface-card w-full"
    >
      <p className="text-sm font-bold">New partner lead</p>
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Company name</span>
          <input type="text" name="companyName" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Role</span>
          <input type="text" name="role" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Number</span>
          <input type="tel" name="number" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input type="email" name="email" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Business activity</span>
          <input type="text" name="businessActivity" required className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Description</span>
        <textarea name="description" rows={2} className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        Save partner lead
      </button>
    </form>
  );
}

/* PP-1/PP-2 — the extra number slots, revealed in Didn't Answer. Saving a new
   non-empty number auto-returns the card to Lead (server-side). */
export function NumberSlots({
  prospectId,
  number2,
  number3,
  revealed,
}: {
  prospectId: string;
  number2: string | null;
  number3: string | null;
  revealed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!revealed && !number2 && !number3) return null;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/b-systems/partners-pipeline/${prospectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number2: String(fd.get("number2") || ""),
            number3: String(fd.get("number3") || ""),
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Something went wrong");
          return;
        }
        router.refresh();
      }}
      className="space-y-2"
    >
      <p className="text-sm font-bold">Extra numbers</p>
      {revealed ? (
        <p className="text-xs text-brand-muted">
          Saving a new number returns this card to Lead automatically.
        </p>
      ) : null}
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Number 2</span>
          <input type="tel" name="number2" defaultValue={number2 ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Number 3</span>
          <input type="tel" name="number3" defaultValue={number3 ?? ""} className={inputCls} />
        </label>
      </div>
      <button type="submit" disabled={busy} className={btnPrimary}>
        Save numbers
      </button>
    </form>
  );
}

export function RecordingUpload({ prospectId }: { prospectId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const file = fileRef.current?.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/b-systems/partners-pipeline/${prospectId}/recordings`, {
          method: "POST",
          body: fd,
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Upload failed");
          return;
        }
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }}
      className="space-y-2"
    >
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <label className="block">
        <span className={labelCls}>Add cold-call recording (.mp3 / .mp4, ≤ 50 MB)</span>
        <input ref={fileRef} type="file" name="file" accept=".mp3,.mp4" required className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        Upload recording
      </button>
    </form>
  );
}
