"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { tFor, type Msg } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { vault } from "@/lib/i18n/dict/vault";
import {
  VAULT_COMPANIES,
  VAULT_COMPANY_LABELS,
  VAULT_DOCUMENT_TYPE_LABELS,
  VAULT_DOCUMENT_TYPES,
  VAULT_LINK_TYPE_LABELS,
  VAULT_LINK_TYPES,
  VAULT_SHEET_TYPE_LABELS,
  VAULT_SHEET_TYPES,
} from "@/lib/services/vault/constants";

/* ADR-053 Phase 5 — every vault modal + row action, composed from the design
   system's modal/field/button classes (the accounting forms.tsx pattern).
   The server re-validates everything; these forms only collect. */

/* ------------------------------------------------------------- plumbing */

async function send(
  url: string,
  method: "POST" | "PATCH",
  body: FormData | unknown,
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: isForm ? body : JSON.stringify(body),
  });
  if (res.ok) return { ok: true, status: res.status, error: null };
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, status: res.status, error: data?.error ?? null };
}

function useAction() {
  const router = useRouter();
  const t = tFor(useLocale());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(0);
  const run = async (
    url: string,
    method: "POST" | "PATCH",
    body: FormData | unknown,
    after?: () => void,
  ) => {
    setBusy(true);
    setError(null);
    const result = await send(url, method, body);
    setBusy(false);
    setStatus(result.status);
    if (!result.ok) {
      setError(result.error ?? t(vault.somethingWentWrong));
      return false;
    }
    after?.();
    router.refresh();
    return true;
  };
  return { busy, error, status, run, setError };
}

function VaultModal({
  title,
  onClose,
  onSubmit,
  busy,
  error,
  submitLabel,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  children: ReactNode;
}) {
  const t = tFor(useLocale());
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">{t(vault.navItem)}</p>
            <p className="modal-title">{title}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t(vault.close)}>
            ×
          </button>
        </div>
        <div className="modal-body modal-body--grid">{children}</div>
        <div className="modal-foot">
          <span className="modal-foot-note">
            {error ? <span className="text-brand-danger">{error}</span> : null}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t(vault.cancel)}
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {submitLabel}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`field${wide ? " field--wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

function CompanyOptions({ withBoth }: { withBoth?: boolean }) {
  const t = tFor(useLocale());
  return (
    <>
      {withBoth ? <option value="">{t(vault.companyBoth)}</option> : null}
      {VAULT_COMPANIES.map((c) => (
        <option key={c} value={c}>
          {t(VAULT_COMPANY_LABELS[c])}
        </option>
      ))}
    </>
  );
}

const str = (fd: FormData, name: string) => {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
};

/* ---------------------------------------------------------------- forms */

export interface VaultFormRow {
  id: string;
  company: string;
  name: string;
  url: string;
  notes: string | null;
}

function FormModal({
  row,
  onClose,
}: {
  row: VaultFormRow | null;
  onClose: () => void;
}) {
  const t = tFor(useLocale());
  const { busy, error, status, run } = useAction();
  const [acknowledge, setAcknowledge] = useState(false);

  const submit = async (fd: FormData) => {
    const body = {
      company: str(fd, "company"),
      name: str(fd, "name"),
      url: str(fd, "url"),
      notes: str(fd, "notes") || undefined,
      acknowledgeDuplicate: acknowledge,
    };
    const ok = row
      ? await run(`/api/vault/forms/${row.id}`, "PATCH", body, onClose)
      : await run("/api/vault/forms", "POST", body, onClose);
    if (!ok) setAcknowledge(false);
  };

  return (
    <VaultModal
      title={t(row ? vault.editForm : vault.addForm)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(vault.save)}
    >
      <Field label={t(vault.name)} wide>
        <input className="field-input" name="name" required maxLength={160} defaultValue={row?.name ?? ""} />
      </Field>
      <Field label={t(vault.url)} wide>
        <input className="field-input" name="url" type="url" required defaultValue={row?.url ?? ""} dir="ltr" />
      </Field>
      <Field label={t(vault.company)}>
        <select className="field-input" name="company" defaultValue={row?.company ?? "byteforce"}>
          <CompanyOptions />
        </select>
      </Field>
      <Field label={t(vault.notes)} wide>
        <textarea className="field-input" name="notes" rows={3} maxLength={5000} defaultValue={row?.notes ?? ""} />
      </Field>
      {/* the duplicate-URL handshake: a 409 names the clash; ticking re-files */}
      {status === 409 ? (
        <label className="check-row field--wide">
          <input
            type="checkbox"
            checked={acknowledge}
            onChange={(e) => setAcknowledge(e.target.checked)}
          />
          <span>{t(vault.duplicateConfirm)}</span>
        </label>
      ) : null}
    </VaultModal>
  );
}

export function AddFormButton() {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(vault.addForm)}
      </button>
      {open ? <FormModal row={null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditFormButton({ row }: { row: VaultFormRow }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost btn--sm" onClick={() => setOpen(true)}>
        {t(vault.edit)}
      </button>
      {open ? <FormModal row={row} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/* ---------------------------------------------------------------- links */

/* ADR-070 — the founder's five fields: Link Name, URL, Company, Category and
   Type. The FormModal above is the shape this follows (same duplicate-URL
   handshake, same Save), with the two that are new to this section:

   · CATEGORY is a plain text input wearing a <datalist>. That is the native
     suggestion idiom — and it is already the idiom here (roleForms.tsx and
     LeadEventPanel.tsx both use one for rep names) — so it needs no bespoke
     combobox, no keyboard trap and no ARIA of our own: he picks one of the
     suggestions or types something new, and whatever is in the box is what
     gets stored.
   · TYPE is a closed <select> over the eight, re-validated server-side. */

export interface VaultLinkRow {
  id: string;
  company: string;
  name: string;
  url: string;
  category: string;
  type: string;
  notes: string | null;
}

function LinkModal({
  row,
  categories,
  onClose,
}: {
  row: VaultLinkRow | null;
  /** categories already on file, merged with our own suggestions by the page */
  categories: string[];
  onClose: () => void;
}) {
  const t = tFor(useLocale());
  const { busy, error, status, run } = useAction();
  const [acknowledge, setAcknowledge] = useState(false);

  const submit = async (fd: FormData) => {
    const body = {
      company: str(fd, "company"),
      name: str(fd, "name"),
      url: str(fd, "url"),
      category: str(fd, "category"),
      type: str(fd, "type"),
      notes: str(fd, "notes") || undefined,
      acknowledgeDuplicate: acknowledge,
    };
    const ok = row
      ? await run(`/api/vault/links/${row.id}`, "PATCH", body, onClose)
      : await run("/api/vault/links", "POST", body, onClose);
    if (!ok) setAcknowledge(false);
  };

  return (
    <VaultModal
      title={t(row ? vault.editLink : vault.addLink)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(vault.save)}
    >
      <Field label={t(vault.name)} wide>
        <input
          className="field-input"
          name="name"
          required
          maxLength={160}
          defaultValue={row?.name ?? ""}
        />
      </Field>
      <Field label={t(vault.url)} wide>
        <input
          className="field-input"
          name="url"
          type="url"
          required
          defaultValue={row?.url ?? ""}
          dir="ltr"
        />
      </Field>
      <Field label={t(vault.company)}>
        <select className="field-input" name="company" defaultValue={row?.company ?? "byteforce"}>
          <CompanyOptions />
        </select>
      </Field>
      <Field label={t(vault.type)}>
        <select className="field-input" name="type" defaultValue={row?.type ?? "website"}>
          {VAULT_LINK_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(VAULT_LINK_TYPE_LABELS[x])}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t(vault.category)} hint={t(vault.categoryHint)} wide>
        <input
          className="field-input"
          name="category"
          list="vault-link-categories"
          required
          maxLength={80}
          defaultValue={row?.category ?? ""}
        />
        <datalist id="vault-link-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label={t(vault.notes)} wide>
        <textarea
          className="field-input"
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={row?.notes ?? ""}
        />
      </Field>
      {/* the duplicate-URL handshake: a 409 names the clash; ticking re-files */}
      {status === 409 ? (
        <label className="check-row field--wide">
          <input
            type="checkbox"
            checked={acknowledge}
            onChange={(e) => setAcknowledge(e.target.checked)}
          />
          <span>{t(vault.duplicateConfirm)}</span>
        </label>
      ) : null}
    </VaultModal>
  );
}

export function AddLinkButton({ categories }: { categories: string[] }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(vault.addLink)}
      </button>
      {open ? (
        <LinkModal row={null} categories={categories} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function EditLinkButton({
  row,
  categories,
}: {
  row: VaultLinkRow;
  categories: string[];
}) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost btn--sm" onClick={() => setOpen(true)}>
        {t(vault.edit)}
      </button>
      {open ? (
        <LinkModal row={row} categories={categories} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- sheets */

export interface VaultSheetRow {
  id: string;
  company: string;
  name: string;
  type: string;
  storage: string;
  url: string | null;
  dateCreated: string;
  recordCount: number | null;
  recordCountAsOf: string | null;
  notes: string | null;
}

function SheetModal({ row, onClose }: { row: VaultSheetRow | null; onClose: () => void }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const [storage, setStorage] = useState(row?.storage ?? "link");

  const submit = async (fd: FormData) => {
    if (row) {
      // metadata edit is JSON; the file itself rides the Replace file action
      const body = {
        company: str(fd, "company"),
        name: str(fd, "name"),
        type: str(fd, "type"),
        storage,
        url: storage === "link" ? str(fd, "url") : undefined,
        dateCreated: str(fd, "dateCreated"),
        notes: str(fd, "notes") || undefined,
        recordCount: str(fd, "recordCount") || undefined,
        recordCountAsOf: str(fd, "recordCountAsOf") || undefined,
      };
      await run(`/api/vault/sheets/${row.id}`, "PATCH", body, onClose);
      return;
    }
    fd.set("storage", storage);
    await run("/api/vault/sheets", "POST", fd, onClose);
  };

  return (
    <VaultModal
      title={t(row ? vault.editSheet : vault.addSheet)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(vault.save)}
    >
      <Field label={t(vault.name)} wide>
        <input className="field-input" name="name" required maxLength={160} defaultValue={row?.name ?? ""} />
      </Field>
      <Field label={t(vault.company)}>
        <select className="field-input" name="company" defaultValue={row?.company ?? "byteforce"}>
          <CompanyOptions />
        </select>
      </Field>
      <Field label={t(vault.type)}>
        <select className="field-input" name="type" defaultValue={row?.type ?? "leads"}>
          {VAULT_SHEET_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(VAULT_SHEET_TYPE_LABELS[x])}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t(vault.dateCreated)}>
        <input className="field-input" name="dateCreated" type="date" required defaultValue={row?.dateCreated ?? ""} />
      </Field>
      <Field label={t(vault.storageMode)}>
        <select className="field-input" name="storageChoice" value={storage} onChange={(e) => setStorage(e.target.value)}>
          <option value="link">{t(vault.storageLink)}</option>
          <option value="file">{t(vault.storageFile)}</option>
        </select>
      </Field>
      {storage === "link" ? (
        <Field label={t(vault.url)} wide>
          <input className="field-input" name="url" type="url" required defaultValue={row?.url ?? ""} dir="ltr" />
        </Field>
      ) : row ? null : (
        <Field label={t(vault.file)} hint={t(vault.sheetFileTypes)} wide>
          <input className="field-input" name="file" type="file" required accept=".xlsx,.xls,.csv" />
        </Field>
      )}
      <Field label={t(vault.recordCount)} hint={t(vault.manualCountHint)}>
        <input className="field-input"
          name="recordCount"
          type="number"
          min={0}
          defaultValue={row?.recordCount ?? ""}
        />
      </Field>
      <Field label={t(vault.recordCountAsOf)}>
        <input className="field-input" name="recordCountAsOf" type="date" defaultValue={row?.recordCountAsOf ?? ""} />
      </Field>
      <Field label={t(vault.notes)} wide>
        <textarea className="field-input" name="notes" rows={3} maxLength={5000} defaultValue={row?.notes ?? ""} />
      </Field>
    </VaultModal>
  );
}

export function AddSheetButton() {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(vault.addSheet)}
      </button>
      {open ? <SheetModal row={null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditSheetButton({ row }: { row: VaultSheetRow }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost btn--sm" onClick={() => setOpen(true)}>
        {t(vault.edit)}
      </button>
      {open ? <SheetModal row={row} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Upload/replace a sheet or document file — appends a version, never deletes. */
export function ReplaceFileButton({
  postUrl,
  hint,
  accept,
  label,
}: {
  postUrl: string;
  hint: string;
  accept: string;
  label: string;
}) {
  const { busy, error, run } = useAction();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-sm text-brand-danger">{error}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        aria-label={hint}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.set("file", file);
          await run(postUrl, "POST", fd);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="btn-ghost btn--sm"
        disabled={busy}
        title={hint}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
    </span>
  );
}

/* ------------------------------------------------------------ documents */

export interface VaultDocumentRow {
  id: string;
  company: string;
  name: string;
  description: string | null;
  type: string;
}

function DocumentModal({ row, onClose }: { row: VaultDocumentRow | null; onClose: () => void }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();

  const submit = async (fd: FormData) => {
    if (row) {
      const body = {
        company: str(fd, "company"),
        name: str(fd, "name"),
        description: str(fd, "description") || undefined,
        type: str(fd, "type"),
      };
      await run(`/api/vault/documents/${row.id}`, "PATCH", body, onClose);
      return;
    }
    await run("/api/vault/documents", "POST", fd, onClose);
  };

  return (
    <VaultModal
      title={t(row ? vault.editDocument : vault.addDocument)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(vault.save)}
    >
      <Field label={t(vault.name)} wide>
        <input className="field-input" name="name" required maxLength={160} defaultValue={row?.name ?? ""} />
      </Field>
      <Field label={t(vault.company)}>
        <select className="field-input" name="company" defaultValue={row?.company ?? "byteforce"}>
          <CompanyOptions />
        </select>
      </Field>
      <Field label={t(vault.type)}>
        <select className="field-input" name="type" defaultValue={row?.type ?? "contract"}>
          {VAULT_DOCUMENT_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(VAULT_DOCUMENT_TYPE_LABELS[x])}
            </option>
          ))}
        </select>
      </Field>
      {row ? null : (
        <Field label={t(vault.file)} hint={t(vault.documentFileTypes)} wide>
          <input className="field-input" name="file" type="file" required accept=".pdf,.docx,.xlsx" />
        </Field>
      )}
      <Field label={t(vault.description)} wide>
        <textarea className="field-input" name="description" rows={3} maxLength={5000} defaultValue={row?.description ?? ""} />
      </Field>
    </VaultModal>
  );
}

export function AddDocumentButton() {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(vault.addDocument)}
      </button>
      {open ? <DocumentModal row={null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditDocumentButton({ row }: { row: VaultDocumentRow }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost btn--sm" onClick={() => setOpen(true)}>
        {t(vault.edit)}
      </button>
      {open ? <DocumentModal row={row} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/* ------------------------------------------------------------ employees */

export interface VaultEmployeeRow {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  active: boolean;
}

function EmployeeModal({ row, onClose }: { row: VaultEmployeeRow | null; onClose: () => void }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();

  const submit = async (fd: FormData) => {
    const body = {
      name: str(fd, "name"),
      title: str(fd, "title") || undefined,
      company: str(fd, "company") || null,
    };
    if (row) await run(`/api/vault/employees/${row.id}`, "PATCH", body, onClose);
    else await run("/api/vault/employees", "POST", body, onClose);
  };

  return (
    <VaultModal
      title={t(row ? vault.editEmployee : vault.addEmployee)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(vault.save)}
    >
      <Field label={t(vault.name)} wide>
        <input className="field-input" name="name" required maxLength={120} defaultValue={row?.name ?? ""} />
      </Field>
      <Field label={t(vault.jobTitle)}>
        <input className="field-input" name="title" maxLength={120} defaultValue={row?.title ?? ""} />
      </Field>
      <Field label={t(vault.company)}>
        <select className="field-input" name="company" defaultValue={row?.company ?? ""}>
          <CompanyOptions withBoth />
        </select>
      </Field>
    </VaultModal>
  );
}

export function AddEmployeeButton() {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(vault.addEmployee)}
      </button>
      {open ? <EmployeeModal row={null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EmployeeActions({ row }: { row: VaultEmployeeRow }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {error ? <span className="text-sm text-brand-danger">{error}</span> : null}
      <button type="button" className="btn-ghost btn--sm" onClick={() => setOpen(true)}>
        {t(vault.edit)}
      </button>
      <button
        type="button"
        className="btn-ghost btn--sm"
        disabled={busy}
        title={t(vault.deactivateHint)}
        onClick={() =>
          run(`/api/vault/employees/${row.id}`, "PATCH", { active: !row.active })
        }
      >
        {row.active ? t(vault.deactivate) : t(vault.reactivate)}
      </button>
      {open ? <EmployeeModal row={row} onClose={() => setOpen(false)} /> : null}
    </span>
  );
}

/* ---------------------------------------------------------------- tasks */

export interface VaultTaskRow {
  id: string;
  employeeId: string;
  name: string;
  description: string | null;
  company: string | null;
  deadline: string;
  status: string;
}

export type AssigneeOption = { id: string; name: string };

function TaskModal({
  row,
  assignees,
  onClose,
}: {
  row: VaultTaskRow | null;
  assignees: AssigneeOption[];
  onClose: () => void;
}) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();

  const submit = async (fd: FormData) => {
    const body = {
      employeeId: str(fd, "employeeId"),
      name: str(fd, "name"),
      description: str(fd, "description") || undefined,
      company: str(fd, "company") || null,
      deadline: str(fd, "deadline"),
    };
    if (row) await run(`/api/vault/tasks/${row.id}`, "PATCH", body, onClose);
    else await run("/api/vault/tasks", "POST", body, onClose);
  };

  return (
    <VaultModal
      title={t(row ? vault.editTask : vault.addTask)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(vault.save)}
    >
      <Field label={t(vault.name)} wide>
        <input className="field-input" name="name" required maxLength={200} defaultValue={row?.name ?? ""} />
      </Field>
      <Field label={t(vault.assignee)}>
        <select className="field-input" name="employeeId" required defaultValue={row?.employeeId ?? ""}>
          <option value="" disabled>
            —
          </option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t(vault.deadline)}>
        <input className="field-input" name="deadline" type="date" required defaultValue={row?.deadline ?? ""} />
      </Field>
      <Field label={t(vault.company)}>
        <select className="field-input" name="company" defaultValue={row?.company ?? ""}>
          <CompanyOptions withBoth />
        </select>
      </Field>
      <Field label={t(vault.description)} wide>
        <textarea className="field-input" name="description" rows={3} maxLength={10000} defaultValue={row?.description ?? ""} />
      </Field>
    </VaultModal>
  );
}

export function AddTaskButton({ assignees }: { assignees: AssigneeOption[] }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(vault.addTask)}
      </button>
      {open ? <TaskModal row={null} assignees={assignees} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function EditTaskButton({
  row,
  assignees,
}: {
  row: VaultTaskRow;
  assignees: AssigneeOption[];
}) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost btn--sm" onClick={() => setOpen(true)}>
        {t(vault.edit)}
      </button>
      {open ? <TaskModal row={row} assignees={assignees} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/* -------------------------------------------- the result panel (the gate) */

type LinkDraft = { url: string; label: string };

/** Clicking Complete on a resultless task opens THIS — never a bare error.
    The panel accepts text, files and links, and its "Save & complete" button
    completes the task in the same step (one action, not two). */
export function CompleteTaskButton({
  taskId,
  taskName,
  resultText,
}: {
  taskId: string;
  taskName: string;
  /** existing saved result text, prefilled so re-opening the panel is additive */
  resultText?: string | null;
}) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LinkDraft[]>([]);
  const { busy, error, run, setError } = useAction();
  const formRef = useRef<HTMLFormElement>(null);

  const buildFormData = () => {
    const fd = new FormData(formRef.current ?? undefined);
    const cleanLinks = links.filter((l) => l.url.trim() !== "");
    fd.set(
      "links",
      JSON.stringify(cleanLinks.map((l) => ({ url: l.url.trim(), label: l.label.trim() || null }))),
    );
    return fd;
  };

  const close = () => {
    setOpen(false);
    setLinks([]);
    setError(null);
  };

  if (!open) {
    return (
      <button type="button" className="btn-primary btn--sm" onClick={() => setOpen(true)}>
        {t(vault.completeTask)}
      </button>
    );
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <form
        ref={formRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void run(`/api/vault/tasks/${taskId}/complete`, "POST", buildFormData(), close);
        }}
      >
        <div className="modal-head">
          <div>
            <p className="modal-eyebrow">{taskName}</p>
            <p className="modal-title">{t(vault.resultPanelTitle)}</p>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label={t(vault.close)}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-note">{t(vault.resultPanelHint)}</p>
          <Field label={t(vault.resultText)} wide>
            <textarea
              className="field-input"
              name="resultText"
              rows={4}
              maxLength={20000}
              defaultValue={resultText ?? ""}
            />
          </Field>
          <Field label={t(vault.resultFiles)} hint={t(vault.attachmentFileTypes)} wide>
            <input className="field-input"
              name="files"
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt"
            />
          </Field>
          <div className="field field--wide">
            <span className="field-label">{t(vault.resultLinks)}</span>
            {links.map((l, i) => (
              <span key={i} className="flex gap-2 flex-wrap">
                <input className="field-input"
                  type="url"
                  placeholder="https://"
                  dir="ltr"
                  value={l.url}
                  aria-label={t(vault.url)}
                  onChange={(e) =>
                    setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                  }
                />
                <input className="field-input"
                  placeholder={t(vault.linkLabel)}
                  value={l.label}
                  aria-label={t(vault.linkLabel)}
                  onChange={(e) =>
                    setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
              </span>
            ))}
            <span>
              <button
                type="button"
                className="btn-ghost btn--sm"
                onClick={() => setLinks([...links, { url: "", label: "" }])}
              >
                + {t(vault.addLink)}
              </button>
            </span>
          </div>
        </div>
        <div className="modal-foot">
          <span className="modal-foot-note">
            {error ? <span className="text-brand-danger">{error}</span> : null}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() =>
                void run(`/api/vault/tasks/${taskId}/result`, "POST", buildFormData(), close)
              }
            >
              {t(vault.saveResult)}
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {t(vault.saveAndComplete)}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}

export function ReopenTaskButton({ taskId }: { taskId: string }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-sm text-brand-danger">{error}</span> : null}
      <button
        type="button"
        className="btn-ghost btn--sm"
        disabled={busy}
        title={t(vault.reopenHint)}
        onClick={() => run(`/api/vault/tasks/${taskId}/reopen`, "POST", {})}
      >
        {t(vault.reopenTask)}
      </button>
    </span>
  );
}
