"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";

/* V2 §2.10 — admin user management widgets. */

const ASSIGNABLE_ROLES: Array<{ role: string; label: string }> = [
  { role: "bsystems_admin", label: "B-Systems admin" },
  { role: "bsystems_sales", label: "B-Systems internal sales" },
  { role: "bsystems_agent", label: "B-Systems agent" },
  { role: "bsystems_partner", label: "B-Systems partner" },
  { role: "byteforce_staff", label: "ByteForce staff" },
];

export function CreateUserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        Add user
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const roles = ASSIGNABLE_ROLES.map((r) => r.role).filter((r) => fd.get(`role-${r}`) === "on");
        setBusy(true);
        setError(null);
        const res = await fetch("/api/b-systems/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(fd.get("name")),
            email: String(fd.get("email") || "") || undefined,
            phone: String(fd.get("phone") || "") || undefined,
            password: String(fd.get("password")),
            roles,
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
      className="border border-brand-border rounded-brand-card p-4 space-y-3 bg-brand-surface-card w-full max-w-xl"
    >
      <p className="text-sm font-bold">New user</p>
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input type="email" name="email" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Phone</span>
          <input type="tel" name="phone" className={inputCls} placeholder="01xxxxxxxxx" />
        </label>
        <label className="block">
          <span className={labelCls}>Password (min 8)</span>
          <input type="password" name="password" required minLength={8} className={inputCls} />
        </label>
      </div>
      <fieldset>
        <legend className={labelCls}>Access</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {ASSIGNABLE_ROLES.map((r) => (
            <label key={r.role} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`role-${r.role}`} />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/b-systems/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !active }),
        });
        setBusy(false);
        router.refresh();
      }}
      className={
        active
          ? "border border-brand-danger text-brand-danger rounded-brand-control px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          : "border border-brand-border text-brand-ink rounded-brand-control px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      }
    >
      {active ? "Remove" : "Reactivate"}
    </button>
  );
}
