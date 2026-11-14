"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { useLocale } from "@/components/shared/LocaleProvider";
import { tFor } from "@/lib/i18n/core";
import { fields, profile as profileMsgs } from "@/lib/i18n/dict/auth";
import { usersAdmin } from "@/lib/i18n/dict/admin";
import { usersApp as m } from "@/lib/i18n/dict/users-app";

/* ADR-103 — My account: a person's own details, password and (an agent's) CV.
   The forms are always open, filled with what is saved: this is a page you
   come to in order to change something, so a separate "Edit" click would ask
   for nothing. The server (services/my-account.ts) is the rule; the disabled
   fields and the hints below only say in advance what it would refuse. */

export interface MyDetails {
  kind: "agent" | "partner" | "person";
  name: string;
  email: string | null;
  phone: string | null;
  /** the pinned bootstrap admin — his email is the healer's key */
  pinned: boolean;
  agent: { firstName: string; lastName: string; address: string; speciality: string } | null;
}

async function errorOf(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

export function MyDetailsForm({ details }: { details: MyDetails }) {
  const router = useRouter();
  const t = tFor(useLocale());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agent = details.kind === "agent" ? details.agent : null;

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const value = (key: string) => String(fd.get(key) ?? "");
        /* only the fields this person HAS — the server refuses the others */
        const body: Record<string, string> = { phone: value("phone") };
        if (!details.pinned) body.email = value("email");
        if (details.kind === "person") body.name = value("name");
        if (agent) {
          body.firstName = value("firstName");
          body.lastName = value("lastName");
          body.address = value("address");
          body.speciality = value("speciality");
        }
        setBusy(true);
        setError(null);
        setDone(false);
        const res = await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        setBusy(false);
        if (!res.ok) {
          setError(await errorOf(res, t(fields.somethingWentWrong)));
          return;
        }
        setDone(true);
        router.refresh();
      }}
    >
      {error ? (
        <p role="alert" className="alert-error">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-sm text-brand-success">
          {t(m.saved)}
        </p>
      ) : null}
      {agent ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>{t(fields.firstName)}</span>
            <input type="text" name="firstName" required maxLength={100} defaultValue={agent.firstName} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(fields.lastName)}</span>
            <input type="text" name="lastName" required maxLength={100} defaultValue={agent.lastName} className={inputCls} />
          </label>
        </div>
      ) : (
        <label className="block">
          <span className={labelCls}>{t(usersAdmin.fieldName)}</span>
          <input
            type="text"
            name="name"
            required
            maxLength={200}
            defaultValue={details.name}
            /* a partner account carries its company's name — the admin's */
            disabled={details.kind === "partner"}
            className={inputCls}
          />
          {details.kind === "partner" ? (
            <span className="field-hint block mt-1">{t(m.partnerNameHint)}</span>
          ) : null}
        </label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t(usersAdmin.fieldEmail)}</span>
          <input
            type="email"
            name="email"
            maxLength={200}
            defaultValue={details.email ?? ""}
            disabled={details.pinned}
            autoComplete="email"
            className={inputCls}
          />
          {details.pinned ? <span className="field-hint block mt-1">{t(m.pinnedEmailHint)}</span> : null}
        </label>
        <label className="block">
          <span className={labelCls}>{t(usersAdmin.fieldPhone)}</span>
          <input
            type="tel"
            name="phone"
            maxLength={40}
            defaultValue={details.phone ?? ""}
            required={details.kind === "agent"}
            autoComplete="tel"
            className={inputCls}
          />
          {details.kind === "agent" ? (
            <span className="field-hint block mt-1">{t(m.agentPhoneHint)}</span>
          ) : null}
        </label>
      </div>
      {agent ? (
        <>
          <label className="block">
            <span className={labelCls}>{t(fields.address)}</span>
            <input type="text" name="address" required maxLength={400} defaultValue={agent.address} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t(fields.speciality)}</span>
            <input type="text" name="speciality" required maxLength={200} defaultValue={agent.speciality} className={inputCls} />
          </label>
        </>
      ) : null}
      <p className="field-hint">{t(m.signInHint)}</p>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(m.save)}
      </button>
    </form>
  );
}

export function MyPasswordForm() {
  const t = tFor(useLocale());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setBusy(true);
        setError(null);
        setDone(false);
        const res = await fetch("/api/me/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: String(fd.get("currentPassword") ?? ""),
            newPassword: String(fd.get("newPassword") ?? ""),
          }),
        });
        setBusy(false);
        if (!res.ok) {
          setError(await errorOf(res, t(fields.somethingWentWrong)));
          return;
        }
        form.reset();
        setDone(true);
      }}
    >
      {error ? (
        <p role="alert" className="alert-error">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-sm text-brand-success">
          {t(profileMsgs.passwordUpdated)}
        </p>
      ) : null}
      <label className="block">
        <span className={labelCls}>{t(profileMsgs.currentPassword)}</span>
        {/* founder: visible as typed (the profile form's rule, kept) — the
            admin fills this in when he is managing an account */}
        <input type="text" name="currentPassword" required autoComplete="off" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(profileMsgs.newPassword)}</span>
        <PasswordInput
          name="newPassword"
          ariaLabel={t(profileMsgs.newPassword)}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(profileMsgs.changePassword)}
      </button>
    </form>
  );
}

/** An agent's CV — replaced, never removed (sign-up made it required). */
export function MyCvForm() {
  const router = useRouter();
  const t = tFor(useLocale());
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const cv = fileRef.current?.files?.[0];
        if (!cv) return;
        const fd = new FormData();
        fd.append("cv", cv);
        setBusy(true);
        setError(null);
        const res = await fetch("/api/me/cv", { method: "POST", body: fd });
        setBusy(false);
        if (!res.ok) {
          setError(await errorOf(res, t(profileMsgs.uploadFailed)));
          return;
        }
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }}
    >
      {error ? (
        <p role="alert" className="alert-error">
          {error}
        </p>
      ) : null}
      <label className="dropzone">
        <span className="dropzone-icon" aria-hidden="true">
          ↑
        </span>
        <span className="min-w-0 flex-1">
          <span className="dropzone-title block">{t(profileMsgs.replaceCvTitle)}</span>
          <input ref={fileRef} type="file" name="cv" accept=".pdf,.doc,.docx" required className="field-input mt-2" />
        </span>
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(profileMsgs.uploadNewCv)}
      </button>
    </form>
  );
}
