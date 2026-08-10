"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputCls, labelCls } from "./groupForms";

/* §8.4 — profile edits: basics, CV replacement, password change (A-10). Phone is
   shown but not editable (A-10 carve-out — pending ADR). */

export function ProfileEditForm({
  profile,
}: {
  profile: { firstName: string; lastName: string; address: string; speciality: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        Edit profile
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
        const res = await fetch("/api/b-systems/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: String(fd.get("firstName")),
            lastName: String(fd.get("lastName")),
            address: String(fd.get("address")),
            speciality: String(fd.get("speciality")),
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
      className="card card-pad space-y-3"
    >
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>First name</span>
          <input type="text" name="firstName" required defaultValue={profile.firstName} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Last name</span>
          <input type="text" name="lastName" required defaultValue={profile.lastName} className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Address</span>
        <input type="text" name="address" required defaultValue={profile.address} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Speciality</span>
        <input type="text" name="speciality" required defaultValue={profile.speciality} className={inputCls} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CvReplaceForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const cv = fileRef.current?.files?.[0];
        if (!cv) return;
        const fd = new FormData();
        fd.append("cv", cv);
        setBusy(true);
        setError(null);
        const res = await fetch("/api/b-systems/profile/cv", { method: "POST", body: fd });
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
      <label className="dropzone">
        <span className="dropzone-icon" aria-hidden="true">
          ↑
        </span>
        <span className="min-w-0 flex-1">
          <span className="dropzone-title block">Replace CV (.pdf / .doc / .docx, ≤ 10 MB)</span>
          <input ref={fileRef} type="file" name="cv" accept=".pdf,.doc,.docx" required className="field-input mt-2" />
        </span>
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        Upload new CV
      </button>
    </form>
  );
}

export function PasswordChangeForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setBusy(true);
        setError(null);
        setDone(false);
        const res = await fetch("/api/b-systems/profile/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: String(fd.get("currentPassword")),
            newPassword: String(fd.get("newPassword")),
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Something went wrong");
          return;
        }
        form.reset();
        setDone(true);
      }}
      className="space-y-2"
    >
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      {done ? <p className="text-sm text-brand-success">Password updated.</p> : null}
      <label className="block">
        <span className={labelCls}>Current password</span>
        {/* founder: visible as typed — the admin fills this when managing accounts */}
        <input type="text" name="currentPassword" required autoComplete="off" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>New password (min 8 characters)</span>
        <input type="password" name="newPassword" required minLength={8} autoComplete="new-password" className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        Change password
      </button>
    </form>
  );
}
