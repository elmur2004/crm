"use client";

import { useState } from "react";
import { login } from "@/lib/auth/actions";
import { btnAccent, inputCls, labelCls } from "./groupForms";

export function SignupForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch("/api/b-systems/signup", { method: "POST", body: fd });
        if (!res.ok) {
          setBusy(false);
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Something went wrong");
          return;
        }
        /* §8.1: "On success the rep lands in their portal" (ADR-025) — sign the
           new account in through the consolidated flow (ADR-028). */
        const creds = new FormData();
        creds.set("identifier", String(fd.get("phone")));
        creds.set("password", String(fd.get("password")));
        await login(creds);
      }}
      className="space-y-3"
    >
      {error ? (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>First name</span>
          <input type="text" name="firstName" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Last name</span>
          <input type="text" name="lastName" required className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Phone number</span>
        <input type="tel" name="phone" required autoComplete="tel" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Address</span>
        <input type="text" name="address" required className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Speciality</span>
        <input type="text" name="speciality" required placeholder="e.g. ERP consulting" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>CV (.pdf / .doc / .docx, ≤ 10 MB)</span>
        <input type="file" name="cv" accept=".pdf,.doc,.docx" required className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Password</span>
          <input type="password" name="password" required minLength={8} autoComplete="new-password" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Confirm password</span>
          <input type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" className={inputCls} />
        </label>
      </div>
      <button type="submit" disabled={busy} className={`${btnAccent} w-full`}>
        Sign up
      </button>
    </form>
  );
}
