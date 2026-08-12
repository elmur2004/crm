"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { useLocale } from "@/components/shared/LocaleProvider";
import { tFor } from "@/lib/i18n/core";
import { fields, signup } from "@/lib/i18n/dict/auth";
import { btnAccent, inputCls, labelCls } from "./groupForms";

/* §8.1 sign-up, founder V3 rules: the agent registers BOTH identifiers (email +
   phone — either signs in later), and the submission is an approval REQUEST —
   the admin reviews it on Registrations before the account can sign in. */

export function SignupForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const t = tFor(useLocale());

  if (submitted) {
    return (
      <div className="space-y-4">
        <p role="status" className="info-banner mb-0">
          {t(signup.successBanner)}
        </p>
        <p className="u-muted">
          {t(signup.alreadyApproved)}{" "}
          <Link href="/login" className="text-brand-link underline underline-offset-2">{t(signup.signIn)}</Link>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch("/api/b-systems/signup", { method: "POST", body: fd });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? t(fields.somethingWentWrong));
          return;
        }
        setSubmitted(true);
      }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5"
    >
      {error ? (
        <p role="alert" className="alert-error sm:col-span-2">
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className={labelCls}>{t(fields.firstName)}</span>
        <input type="text" name="firstName" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(fields.lastName)}</span>
        <input type="text" name="lastName" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(signup.phone)}</span>
        <input type="tel" name="phone" required autoComplete="tel" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(signup.email)}</span>
        <input type="email" name="email" required autoComplete="email" className={inputCls} />
        <span className="field-hint">{t(signup.emailHint)}</span>
      </label>
      <label className="block sm:col-span-2">
        <span className={labelCls}>{t(fields.address)}</span>
        <input type="text" name="address" required className={inputCls} />
      </label>
      <label className="block sm:col-span-2">
        <span className={labelCls}>{t(fields.speciality)}</span>
        <input type="text" name="speciality" required placeholder={t(signup.specialityPlaceholder)} className={inputCls} />
      </label>
      <label className="dropzone sm:col-span-2">
        <span className="dropzone-icon" aria-hidden="true">↑</span>
        <span className="min-w-0 flex-1">
          <span className="dropzone-title block">{t(signup.cvTitle)}</span>
          <input type="file" name="cv" accept=".pdf,.doc,.docx" required className="mt-1.5 block w-full text-sm" />
        </span>
      </label>
      <label className="block">
        <span className={labelCls}>{t(fields.password)}</span>
        <PasswordInput name="password" ariaLabel={t(fields.password)} required minLength={8} autoComplete="new-password" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(signup.confirmPassword)}</span>
        <PasswordInput name="confirmPassword" ariaLabel={t(signup.confirmPassword)} required minLength={8} autoComplete="new-password" className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={`${btnAccent} w-full sm:col-span-2`}>
        {t(signup.submit)}
      </button>
    </form>
  );
}
