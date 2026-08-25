"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { assignableRoleLabels, common, usersAdmin as d } from "@/lib/i18n/dict/admin";

/* V2 §2.10 — admin user management widgets. */

const ASSIGNABLE_ROLES = [
  "bsystems_admin",
  "bsystems_sales",
  "bsystems_agent",
  "bsystems_partner",
  "bsystems_data_entry", // ADR-051 — add-only
  "byteforce_staff",
];

/* ADR-066 (founder: "block some admins from acsessing accounting or data
   vault") — the two module switches, shown beside the role boxes they NARROW.
   Rendered only when B-Systems admin is ticked, because that is the only state
   in which they mean anything: the server refuses a non-admin on the role long
   before it reads a flag, so a ticked box on a sales rep would be a lie.

   Self-revocation is refused by the SERVER (updateUser); the disabled boxes and
   the note below them are the courtesy that explains why. */
function ModuleAccessFieldset({
  t,
  accounting,
  vault,
  onChange,
  self,
}: {
  t: (m: { en: string; ar: string }) => string;
  accounting: boolean;
  vault: boolean;
  onChange: (next: { accounting: boolean; vault: boolean }) => void;
  /** editing your OWN account — the boxes lock (no self-lockout) */
  self?: boolean;
}) {
  return (
    <fieldset>
      <legend className={labelCls}>{t(d.modulesLegend)}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={accounting}
            disabled={self}
            onChange={(e) => onChange({ accounting: e.target.checked, vault })}
          />
          {t(d.moduleAccounting)}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={vault}
            disabled={self}
            onChange={(e) => onChange({ accounting, vault: e.target.checked })}
          />
          {t(d.moduleVault)}
        </label>
      </div>
      <span className="field-hint block mt-1">
        {self ? t(d.modulesSelfHint) : t(d.modulesHint)}
      </span>
    </fieldset>
  );
}

/* Founder V4 — full admin editor per user: identity, identifiers, roles, and
   the password (visible in the Password column once set). */
export function EditUserButton({
  user,
  isBootstrapAdmin,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    roles: string[];
    /* ADR-066 */
    canAccessAccounting: boolean;
    canAccessVault: boolean;
  };
  /** the pinned admin — its password is controlled by ADMIN_PASSWORD */
  isBootstrapAdmin?: boolean;
  /** ADR-066 — the signed-in admin editing HIMSELF: the module boxes lock */
  isSelf?: boolean;
}) {
  const router = useRouter();
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [modules, setModules] = useState({
    accounting: user.canAccessAccounting,
    vault: user.canAccessVault,
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setRoles(user.roles);
          setModules({ accounting: user.canAccessAccounting, vault: user.canAccessVault });
          setOpen(true);
        }}
        className="btn-ghost btn--sm"
      >
        {t(d.edit)}
      </button>
    );
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">{t(d.modalEyebrowEdit)}</p>
            <p className="modal-title">{user.name}</p>
          </div>
          <button type="button" className="modal-close" aria-label={t(d.closeAria)} onClick={() => setOpen(false)}>
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
                /* ADR-066 — only ever sent for an admin: the flags narrow that
                   role and mean nothing without it, so an edit that removes the
                   role leaves the stored flags exactly where they were. */
                ...(roles.includes("bsystems_admin")
                  ? {
                      canAccessAccounting: modules.accounting,
                      canAccessVault: modules.vault,
                    }
                  : {}),
              }),
            });
            setBusy(false);
            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as { error?: string } | null;
              setError(data?.error ?? t(common.somethingWentWrong));
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
                <span className={labelCls}>{t(d.fieldName)}</span>
                <input type="text" name="name" required defaultValue={user.name} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>{t(d.fieldEmail)}</span>
                <input type="email" name="email" defaultValue={user.email ?? ""} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>{t(d.fieldPhone)}</span>
                <input type="tel" name="phone" defaultValue={user.phone ?? ""} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>{t(d.fieldNewPassword)}</span>
                {isBootstrapAdmin ? (
                  <span className="field-hint block mt-1">{t(d.pinnedPasswordHint)}</span>
                ) : (
                  <>
                    <input
                      type="text"
                      name="password"
                      minLength={8}
                      autoComplete="off"
                      placeholder={t(d.keepCurrentPlaceholder)}
                      className={inputCls}
                    />
                    <span className="field-hint">{t(d.visibleOnceSetHint)}</span>
                  </>
                )}
              </label>
            </div>
            <fieldset>
              <legend className={labelCls}>{t(d.accessLegend)}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {ASSIGNABLE_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={roles.includes(r)}
                      onChange={(e) =>
                        setRoles((prev) =>
                          e.target.checked ? [...prev, r] : prev.filter((x) => x !== r),
                        )
                      }
                    />
                    {t(assignableRoleLabels[r])}
                  </label>
                ))}
              </div>
            </fieldset>
            {roles.includes("bsystems_admin") ? (
              <ModuleAccessFieldset
                t={t}
                accounting={modules.accounting}
                vault={modules.vault}
                onChange={setModules}
                self={isSelf}
              />
            ) : null}
          </div>
          <div className="modal-foot">
            <span className="modal-foot-note">{t(d.changesApply)}</span>
            <span className="flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
                {t(common.cancel)}
              </button>
              <button type="submit" disabled={busy || roles.length === 0} className={btnPrimary}>
                {t(d.saveUser)}
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
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* ADR-066 — a brand-new admin is born with BOTH modules, like every account
     that already exists; the boxes appear the moment the admin role is ticked. */
  const [isAdmin, setIsAdmin] = useState(false);
  const [modules, setModules] = useState({ accounting: true, vault: true });
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        {t(d.addUser)}
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const roles = ASSIGNABLE_ROLES.filter((r) => fd.get(`role-${r}`) === "on");
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
            ...(roles.includes("bsystems_admin")
              ? { canAccessAccounting: modules.accounting, canAccessVault: modules.vault }
              : {}),
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? t(common.somethingWentWrong));
          return;
        }
        setOpen(false);
        router.refresh();
      }}
      className="card card-pad space-y-3 w-full max-w-xl"
    >
      <p className="u-h3">{t(d.newUser)}</p>
      {error ? <p className="alert-error">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="field">
          <span className={labelCls}>{t(d.fieldName)}</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="field">
          <span className={labelCls}>{t(d.fieldEmail)}</span>
          <input type="email" name="email" className={inputCls} />
        </label>
        <label className="field">
          <span className={labelCls}>{t(d.fieldPhone)}</span>
          <input type="tel" name="phone" className={inputCls} placeholder="01xxxxxxxxx" />
        </label>
        <label className="field">
          <span className={labelCls}>{t(d.fieldPasswordMin8)}</span>
          <input type="password" name="password" required minLength={8} className={inputCls} />
        </label>
      </div>
      <fieldset>
        <legend className={labelCls}>{t(d.accessLegend)}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {ASSIGNABLE_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`role-${r}`}
                onChange={
                  r === "bsystems_admin" ? (e) => setIsAdmin(e.target.checked) : undefined
                }
              />
              {t(assignableRoleLabels[r])}
            </label>
          ))}
        </div>
      </fieldset>
      {isAdmin ? (
        <ModuleAccessFieldset
          t={t}
          accounting={modules.accounting}
          vault={modules.vault}
          onChange={setModules}
        />
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {t(d.create)}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          {t(common.cancel)}
        </button>
      </div>
    </form>
  );
}

/* Founder (ADR-049) — "completely delete a user, not just deactivate it".
   Distinct from Remove/Reactivate beside it, so a permanent deletion can never
   be mistaken for the reversible one: it takes TWO deliberate steps and the
   second one names the person out loud. The server owns the real guards. */
export function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const t = tFor(useLocale());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-danger btn--sm">
        {t(d.deleteUser)}
      </button>
    );
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">{t(d.deleteEyebrow)}</p>
            <p className="modal-title">{name}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label={t(d.closeAria)}
            onClick={() => setConfirming(false)}
          >
            ✕
          </button>
        </div>
        <div className="modal-body space-y-3">
          {error ? (
            <p role="alert" className="alert-error">
              {error}
            </p>
          ) : null}
          <p className="text-sm">{t(d.deleteQuestion).replace("{name}", name)}</p>
          <p className="u-muted">{t(d.deleteKeeps)}</p>
          <p className="u-muted">{t(d.deleteRemoves)}</p>
          <p className="u-muted">{t(d.deleteNotUndoable)}</p>
        </div>
        <div className="modal-foot">
          <span className="modal-foot-note">{t(d.deleteDeactivateInstead)}</span>
          <span className="flex gap-2">
            <button type="button" className={btnGhost} onClick={() => setConfirming(false)}>
              {t(common.cancel)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const res = await fetch(`/api/b-systems/users/${userId}`, { method: "DELETE" });
                setBusy(false);
                if (!res.ok) {
                  const data = (await res.json().catch(() => null)) as { error?: string } | null;
                  setError(data?.error ?? t(common.somethingWentWrong));
                  return;
                }
                setConfirming(false);
                router.refresh();
              }}
              className="btn-danger btn-danger--solid disabled:opacity-50"
            >
              {t(d.deleteConfirm).replace("{name}", name)}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

export function ActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const router = useRouter();
  const t = tFor(useLocale());
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
      {active ? t(d.remove) : t(d.reactivate)}
    </button>
  );
}
