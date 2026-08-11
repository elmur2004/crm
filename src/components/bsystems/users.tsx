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

/* Founder V4 — full admin editor per user: identity, identifiers, roles, and
   the password (visible in the Password column once set). */
export function EditUserButton({
  user,
  isBootstrapAdmin,
}: {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    roles: string[];
  };
  /** the pinned admin — its password is controlled by ADMIN_PASSWORD */
  isBootstrapAdmin?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>(user.roles);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setRoles(user.roles);
          setOpen(true);
        }}
        className="btn-ghost btn--sm"
      >
        Edit
      </button>
    );
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">Users · Edit</p>
            <p className="modal-title">{user.name}</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const password = String(fd.get("password") || "");
            setBusy(true);
            setError(null);
            const res = await fetch(`/api/b-systems/users/${user.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: String(fd.get("name")),
                email: String(fd.get("email") || "") || undefined,
                phone: String(fd.get("phone") || "") || undefined,
                ...(password ? { password } : {}),
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
          className="contents"
        >
          <div className="modal-body space-y-3">
            {error ? <p className="alert-error">{error}</p> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Name</span>
                <input type="text" name="name" required defaultValue={user.name} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Email</span>
                <input type="email" name="email" defaultValue={user.email ?? ""} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Phone</span>
                <input type="tel" name="phone" defaultValue={user.phone ?? ""} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>New password</span>
                {isBootstrapAdmin ? (
                  <span className="field-hint block mt-1">
                    The admin password is pinned — change it via the ADMIN_PASSWORD environment
                    variable.
                  </span>
                ) : (
                  <>
                    <input
                      type="text"
                      name="password"
                      minLength={8}
                      autoComplete="off"
                      placeholder="Leave empty to keep the current one"
                      className={inputCls}
                    />
                    <span className="field-hint">Visible in the Password column once set.</span>
                  </>
                )}
              </label>
            </div>
            <fieldset>
              <legend className={labelCls}>Access</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {ASSIGNABLE_ROLES.map((r) => (
                  <label key={r.role} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={roles.includes(r.role)}
                      onChange={(e) =>
                        setRoles((prev) =>
                          e.target.checked ? [...prev, r.role] : prev.filter((x) => x !== r.role),
                        )
                      }
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="modal-foot">
            <span className="modal-foot-note">Changes apply immediately.</span>
            <span className="flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={busy || roles.length === 0} className={btnPrimary}>
                Save user
              </button>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

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
      className="card card-pad space-y-3 w-full max-w-xl"
    >
      <p className="u-h3">New user</p>
      {error ? <p className="alert-error">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="field">
          <span className={labelCls}>Name</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="field">
          <span className={labelCls}>Email</span>
          <input type="email" name="email" className={inputCls} />
        </label>
        <label className="field">
          <span className={labelCls}>Phone</span>
          <input type="tel" name="phone" className={inputCls} placeholder="01xxxxxxxxx" />
        </label>
        <label className="field">
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
          ? "row-toggle disabled:opacity-50"
          : "row-toggle row-toggle--restore disabled:opacity-50"
      }
    >
      {active ? "Remove" : "Reactivate"}
    </button>
  );
}
