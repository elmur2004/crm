"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { btnAccent, inputCls, labelCls } from "./groupForms";

/* §8.1 sign-up, founder V3 rules: the agent registers BOTH identifiers (email +
   phone — either signs in later), and the submission is an approval REQUEST —
   the admin reviews it on Registrations before the account can sign in. */

export function SignupForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="space-y-4">
        <p role="status" className="info-banner mb-0">
          Request received — the admin reviews new registrations. You&apos;ll be able to
          sign in with your email or phone once you&apos;re approved.
        </p>
        <p className="u-muted">
          Already approved? <Link href="/login" className="text-brand-link underline underline-offset-2">Sign in</Link>
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
          setError(data?.error ?? "Something went wrong");
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
        <span className={labelCls}>First name</span>
        <input type="text" name="firstName" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Last name</span>
        <input type="text" name="lastName" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Phone number</span>
        <input type="tel" name="phone" required autoComplete="tel" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Email</span>
        <input type="email" name="email" required autoComplete="email" className={inputCls} />
        <span className="field-hint">You&apos;ll sign in with your email or your phone.</span>
      </label>
      <label className="block sm:col-span-2">
        <span className={labelCls}>Address</span>
        <input type="text" name="address" required className={inputCls} />
      </label>
      <label className="block sm:col-span-2">
        <span className={labelCls}>Speciality</span>
        <input type="text" name="speciality" required placeholder="e.g. ERP consulting" className={inputCls} />
      </label>
      <label className="dropzone sm:col-span-2">
        <span className="dropzone-icon" aria-hidden="true">↑</span>
        <span className="min-w-0 flex-1">
          <span className="dropzone-title block">CV (.pdf / .doc / .docx, ≤ 10 MB)</span>
          <input type="file" name="cv" accept=".pdf,.doc,.docx" required className="mt-1.5 block w-full text-sm" />
        </span>
      </label>
      <label className="block">
        <span className={labelCls}>Password</span>
        <PasswordInput name="password" ariaLabel="Password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Confirm password</span>
        <PasswordInput name="confirmPassword" ariaLabel="Confirm password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={`${btnAccent} w-full sm:col-span-2`}>
        Sign up
      </button>
    </form>
  );
}
