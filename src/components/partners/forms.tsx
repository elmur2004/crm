"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* Partners pipeline client forms: add prospect, number 2/3 slots (PP-2 fires
   server-side on save), recording upload (§7.2). */

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";
const btnPrimary = "btn-primary";

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
      className="card card-pad space-y-3 w-full"
    >
      <p className="u-h3">New partner lead</p>
      {error ? <p className="alert-error">{error}</p> : null}
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

/* V2 §6 — add ALTERNATIVE numbers, any count, any time. From Didn't Answer the
   save auto-returns the card to Lead (server-side PP-2). */
export function AlternativeNumbersForm({
  prospectId,
  inDidntAnswer,
}: {
  prospectId: string;
  inDidntAnswer: boolean;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const numbers = fields.map((n) => n.trim()).filter(Boolean);
        if (numbers.length === 0) return;
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/b-systems/partners-pipeline/${prospectId}/numbers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numbers }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Something went wrong");
          return;
        }
        setFields([""]);
        router.refresh();
      }}
      className="space-y-2"
    >
      <p className="u-h3">Alternative numbers</p>
      {inDidntAnswer ? (
        <p className="field-hint">
          Saving new number(s) returns this card to Lead automatically. You can also add
          them later — nothing is required now.
        </p>
      ) : null}
      {error ? <p className="alert-error">{error}</p> : null}
      {fields.map((value, i) => (
        <input
          key={i}
          type="tel"
          value={value}
          aria-label={`New number ${i + 1}`}
          placeholder="New number"
          onChange={(e) => {
            const next = [...fields];
            next[i] = e.target.value;
            setFields(next);
          }}
          className={inputCls}
        />
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFields([...fields, ""])}
          className="btn-ghost"
        >
          Add another number
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          Save numbers
        </button>
      </div>
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
      {error ? <p className="alert-error">{error}</p> : null}
      <label className="dropzone">
        <span className="dropzone-icon" aria-hidden="true">↑</span>
        <span className="min-w-0 flex-1">
          <span className="dropzone-title block">Add cold-call recording (.mp3 / .mp4, ≤ 50 MB)</span>
          <input ref={fileRef} type="file" name="file" accept=".mp3,.mp4" required className="mt-1.5 block w-full text-sm" />
        </span>
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        Upload recording
      </button>
    </form>
  );
}
