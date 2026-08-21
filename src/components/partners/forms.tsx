"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import {
  businessActivityLabel,
  pCommon,
  pForms,
  prospectKindLabel,
} from "@/lib/i18n/dict/partners";
import { fields as authFields, profile, signup } from "@/lib/i18n/dict/auth";
import { PROSPECT_KINDS } from "@/lib/pipeline-engine/configs/partners";

/* Partners & Agents client forms: add a card of either kind, number 2/3 slots
   (PP-2 fires server-side on save), recording upload (§7.2), agent CV.

   Founder: the agent field set is the PUBLIC SIGNUP form's, field for field
   ("the fields of adding an agent is the fields when he applies by himself"),
   reusing the signup dictionary so the two can never drift — minus the
   password, which the ADMIN sets later at the Won gate. */

const inputCls = "field-input";
const labelCls = "field-label block mb-1.5";
const btnPrimary = "btn-primary";

/* Business activity is a FIXED list (founder directive) — "Other activities"
   opens a free-text box for the specific activity. */
export const BUSINESS_ACTIVITIES = [
  "HR company",
  "Marketing company",
  "Accounting firm",
  "Law firm",
] as const;
export const OTHER_ACTIVITY = "Other activities";

export function BusinessActivityField({ defaultValue }: { defaultValue?: string }) {
  const locale = useLocale();
  const t = tFor(locale);
  const isPreset =
    defaultValue !== undefined &&
    (BUSINESS_ACTIVITIES as readonly string[]).includes(defaultValue);
  const [choice, setChoice] = useState<string>(
    defaultValue === undefined ? BUSINESS_ACTIVITIES[0] : isPreset ? defaultValue : OTHER_ACTIVITY,
  );
  return (
    <>
      <label className="block">
        <span className={labelCls}>{t(pForms.businessActivity)}</span>
        <select
          name="businessActivityChoice"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={inputCls}
        >
          {BUSINESS_ACTIVITIES.map((a) => (
            <option key={a} value={a}>
              {businessActivityLabel(locale, a)}
            </option>
          ))}
          <option value={OTHER_ACTIVITY}>{businessActivityLabel(locale, OTHER_ACTIVITY)}</option>
        </select>
      </label>
      {choice === OTHER_ACTIVITY ? (
        <label className="block">
          <span className={labelCls}>{t(pForms.specifyActivity)}</span>
          <input
            type="text"
            name="businessActivityOther"
            required
            defaultValue={defaultValue !== undefined && !isPreset ? defaultValue : ""}
            className={inputCls}
          />
        </label>
      ) : null}
    </>
  );
}

/** The submitted business activity: the chosen preset, or the free text. */
export function businessActivityFrom(fd: FormData): string {
  const choice = String(fd.get("businessActivityChoice"));
  return choice === OTHER_ACTIVITY ? String(fd.get("businessActivityOther") || "") : choice;
}

/** The card fields belonging to a PARTNER — unchanged from the original form. */
export function PartnerProspectFields({
  defaults,
}: {
  defaults?: {
    name: string;
    companyName: string | null;
    role: string | null;
    number: string;
    email: string | null;
    businessActivity: string | null;
  };
}) {
  const t = tFor(useLocale());
  return (
    <>
      <label className="block">
        <span className={labelCls}>{t(pCommon.name)}</span>
        <input type="text" name="name" required defaultValue={defaults?.name} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(pCommon.companyName)}</span>
        <input
          type="text"
          name="companyName"
          required
          defaultValue={defaults?.companyName ?? ""}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>{t(pCommon.role)}</span>
        <input type="text" name="role" defaultValue={defaults?.role ?? ""} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(pCommon.number)}</span>
        <input type="tel" name="number" required defaultValue={defaults?.number} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(signup.email)}</span>
        <input type="email" name="email" defaultValue={defaults?.email ?? ""} className={inputCls} />
      </label>
      <BusinessActivityField defaultValue={defaults?.businessActivity ?? undefined} />
    </>
  );
}

/** The card fields belonging to an AGENT — the signup form's SET, same labels,
    but only the NAME and the NUMBER are required (founder: "everything is
    optional other than the name and the number... just to not confuse this
    one"). The admin usually opens this mid-phone-call. Everything the profile
    genuinely needs is insisted on later, at the Won gate. The password is not
    asked for here at all: the admin sets it at that gate. */
export function AgentProspectFields({
  defaults,
  withCv = true,
}: {
  defaults?: {
    firstName: string;
    lastName: string;
    number: string;
    email: string | null;
    address: string | null;
    speciality: string | null;
  };
  withCv?: boolean;
}) {
  const t = tFor(useLocale());
  return (
    <>
      <label className="block">
        <span className={labelCls}>{t(authFields.firstName)}</span>
        <input
          type="text"
          name="firstName"
          required
          defaultValue={defaults?.firstName}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>{t(authFields.lastName)}</span>
        <input
          type="text"
          name="lastName"
          required
          defaultValue={defaults?.lastName}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>{t(signup.phone)}</span>
        <input type="tel" name="number" required defaultValue={defaults?.number} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t(signup.email)}</span>
        <input type="email" name="email" defaultValue={defaults?.email ?? ""} className={inputCls} />
        <span className="field-hint">{t(signup.emailHint)}</span>
      </label>
      <label className="block sm:col-span-2">
        <span className={labelCls}>{t(authFields.address)}</span>
        <input type="text" name="address" defaultValue={defaults?.address ?? ""} className={inputCls} />
      </label>
      <label className="block sm:col-span-2">
        <span className={labelCls}>{t(authFields.speciality)}</span>
        <input
          type="text"
          name="speciality"
          defaultValue={defaults?.speciality ?? ""}
          placeholder={t(signup.specialityPlaceholder)}
          className={inputCls}
        />
      </label>
      {withCv ? (
        <label className="dropzone sm:col-span-2">
          <span className="dropzone-icon" aria-hidden="true">↑</span>
          <span className="min-w-0 flex-1">
            <span className="dropzone-title block">{t(signup.cvTitle)}</span>
            <span className="dropzone-hint">{t(pForms.cvOptionalHintAccount)}</span>
            <input type="file" name="cv" accept=".pdf,.doc,.docx" className="mt-1.5 block w-full text-sm" />
          </span>
        </label>
      ) : null}
    </>
  );
}

/** An agent card stores ONE `name`; the gate splits it back for the profile. */
export function agentNameFrom(fd: FormData): string {
  return `${String(fd.get("firstName") || "").trim()} ${String(fd.get("lastName") || "").trim()}`.trim();
}

export function AddProspectForm() {
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("partner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        {t(pForms.addPartnerLead)}
      </button>
    );
  }
  const agent = kind === "agent";
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        /* an agent card may carry a CV file, so it posts multipart; a partner
           card keeps the original JSON body byte for byte */
        let res: Response;
        if (agent) {
          const body = new FormData();
          body.set("kind", "agent");
          body.set("name", agentNameFrom(fd));
          for (const key of ["number", "email", "address", "speciality", "description"]) {
            body.set(key, String(fd.get(key) || ""));
          }
          const cv = fd.get("cv");
          if (cv instanceof File && cv.size > 0) body.set("cv", cv);
          res = await fetch("/api/b-systems/partners-pipeline", { method: "POST", body });
        } else {
          res = await fetch("/api/b-systems/partners-pipeline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "partner",
              name: String(fd.get("name")),
              companyName: String(fd.get("companyName")),
              role: String(fd.get("role") || "") || undefined,
              email: String(fd.get("email") || "") || undefined,
              number: String(fd.get("number")),
              businessActivity: businessActivityFrom(fd),
              description: String(fd.get("description") || "") || undefined,
            }),
          });
        }
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? t(pCommon.somethingWrong));
          return;
        }
        setOpen(false);
        router.refresh();
      }}
      className="card card-pad space-y-3 w-full"
    >
      <p className="u-h3">{t(pForms.newPartnerLead)}</p>
      {error ? <p className="alert-error">{error}</p> : null}
      {/* the FIRST control: partner or agent — the field set follows it */}
      <label className="block">
        <span className={labelCls}>{t(pForms.whichKind)}</span>
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={inputCls}
        >
          {PROSPECT_KINDS.map((k) => (
            <option key={k} value={k}>
              {prospectKindLabel(locale, k)}
            </option>
          ))}
        </select>
        <span className="field-hint">
          {t(pForms.kindLockedQualified)}
          {agent ? ` ${t(pForms.agentOptionalHint)}` : ""}
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {agent ? <AgentProspectFields /> : <PartnerProspectFields />}
      </div>
      <label className="block">
        <span className={labelCls}>{t(pCommon.description)}</span>
        <textarea name="description" rows={2} className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(pForms.savePartnerLead)}
      </button>
    </form>
  );
}

/** Agent card CV — added or replaced any time before the Won gate moves it
    onto the agent's profile. */
export function ProspectCvUpload({ prospectId }: { prospectId: string }) {
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
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
        const res = await fetch(`/api/b-systems/partners-pipeline/${prospectId}/cv`, {
          method: "POST",
          body: fd,
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? t(pCommon.uploadFailed));
          return;
        }
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }}
      className="space-y-2"
    >
      {error ? <p className="alert-error">{error}</p> : null}
      {/* NOT marked required: the design system stars any dropzone whose input
          is required, and a star on an optional CV would contradict itself —
          the submit handler already returns early when no file is chosen */}
      <label className="dropzone">
        <span className="dropzone-icon" aria-hidden="true">↑</span>
        <span className="min-w-0 flex-1">
          <span className="dropzone-title block">{t(profile.replaceCvTitle)}</span>
          <span className="dropzone-hint">{t(pForms.cvOptionalHintAccount)}</span>
          <input ref={fileRef} type="file" name="file" accept=".pdf,.doc,.docx" className="mt-1.5 block w-full text-sm" />
        </span>
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(pForms.saveCv)}
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
  const locale = useLocale();
  const t = tFor(locale);
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
          setError(data?.error ?? t(pCommon.somethingWrong));
          return;
        }
        setFields([""]);
        router.refresh();
      }}
      className="space-y-2"
    >
      <p className="u-h3">{t(pForms.altNumbersTitle)}</p>
      {inDidntAnswer ? (
        <p className="field-hint">
          {t(pForms.altNumbersHint)}
        </p>
      ) : null}
      {error ? <p className="alert-error">{error}</p> : null}
      {fields.map((value, i) => (
        <input
          key={i}
          type="tel"
          value={value}
          aria-label={t(pForms.newNumberN).replace("{n}", String(i + 1))}
          placeholder={t(pForms.newNumberPh)}
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
          {t(pForms.addAnotherNumber)}
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {t(pForms.saveNumbers)}
        </button>
      </div>
    </form>
  );
}

export function RecordingUpload({ prospectId }: { prospectId: string }) {
  const router = useRouter();
  const locale = useLocale();
  const t = tFor(locale);
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
          setError(data?.error ?? t(pCommon.uploadFailed));
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
          <span className="dropzone-title block">{t(pForms.dropzoneTitle)}</span>
          <input ref={fileRef} type="file" name="file" accept=".mp3,.mp4" required className="mt-1.5 block w-full text-sm" />
        </span>
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {t(pForms.uploadRecording)}
      </button>
    </form>
  );
}
