"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tFor, type Msg } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { formatEGP, toPiasters, toPounds } from "@/lib/money";
import { acct } from "@/lib/i18n/dict/accounting";
import {
  ACCT_DEPT_LABELS,
  ACCT_DEPTS,
  ACCT_EXPENSE_TYPE_LABELS,
  ACCT_EXPENSE_TYPES,
  ACCT_INCOME_TYPE_LABELS,
  ACCT_INCOME_TYPES,
  mediaHidden,
  type AcctCompany,
} from "@/lib/accounting/constants";
import { acctQuery } from "@/lib/accounting/params";

/* ADR-052 Phase 2 — every accounting modal + row action, composed from the
   design system's modal/field/button classes. Amounts are typed in EGP and
   converted with toPiasters before POST (the statements pattern); the server
   re-validates everything. Money is never undoable — the services already
   consume pending undo entries on every write. */

/* ------------------------------------------------------------- plumbing */

async function send(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<{ ok: boolean; error: string | null }> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return { ok: true, error: null };
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, error: data?.error ?? null };
}

function useAction() {
  const router = useRouter();
  const t = tFor(useLocale());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (
    url: string,
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    body: unknown,
    after?: () => void,
  ) => {
    setBusy(true);
    setError(null);
    const result = await send(url, method, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? t(acct.somethingWentWrong));
      return false;
    }
    after?.();
    router.refresh();
    return true;
  };
  return { busy, error, run, setError };
}

function AcctModal({
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
            <p className="modal-eyebrow">{t(acct.navItem)}</p>
            <p className="modal-title">{title}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t(acct.cancel)}>
            ×
          </button>
        </div>
        <div className="modal-body modal-body--grid">{children}</div>
        <div className="modal-foot">
          <span className="modal-foot-note">{error ? <span className="text-brand-danger">{error}</span> : null}</span>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t(acct.cancel)}
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

function DeptOptions({ blankLabel, company }: { blankLabel: Msg | null; company: AcctCompany }) {
  const t = tFor(useLocale());
  return (
    <>
      {blankLabel ? <option value="">{t(blankLabel)}</option> : null}
      {ACCT_DEPTS.filter(
        (d) => d !== "media_fee" || (!mediaHidden(company) && blankLabel === null),
      ).map((d) =>
        d === "media_fee" ? null : (
          <option key={d} value={d}>
            {t(ACCT_DEPT_LABELS[d])}
          </option>
        ),
      )}
    </>
  );
}

function egp(fd: FormData, key: string): number {
  return toPiasters(String(fd.get(key) || "0"));
}

const amountInput = "field-input";

/* --------------------------------------------------------------- income */

export interface IncomeRowDto {
  id: string;
  month: string;
  type: string;
  client: string;
  serviceLine: string;
  amount: number; // piasters
  note: string;
  collected: boolean;
  collectedDate: string | null;
}

function IncomeModal({
  company,
  month,
  initial,
  onClose,
}: {
  company: AcctCompany;
  month: string;
  initial: IncomeRowDto | null;
  onClose: () => void;
}) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const [collected, setCollected] = useState(initial?.collected ?? false);
  const submit = (fd: FormData) => {
    const body = {
      company,
      month: String(fd.get("month") || month),
      type: String(fd.get("type")),
      client: String(fd.get("client") || ""),
      serviceLine: String(fd.get("serviceLine") || "other"),
      amount: egp(fd, "amount"),
      note: String(fd.get("note") || ""),
      collected,
      collectedDate: collected ? String(fd.get("collectedDate") || "") || null : null,
    };
    void run(
      initial ? `/api/b-systems/accounting/income/${initial.id}` : "/api/b-systems/accounting/income",
      initial ? "PATCH" : "POST",
      body,
      onClose,
    );
  };
  return (
    <AcctModal
      title={t(initial ? acct.editIncome : acct.addIncome)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(acct.save)}
    >
      <Field label={t(acct.type)}>
        <select name="type" className="field-input" defaultValue={initial?.type ?? "invoice"}>
          {ACCT_INCOME_TYPES.filter((x) => x !== "media_fee" || !mediaHidden(company)).map((x) => (
            <option key={x} value={x}>
              {t(ACCT_INCOME_TYPE_LABELS[x])}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t(acct.department)}>
        <select name="serviceLine" className="field-input" defaultValue={initial?.serviceLine || "social"}>
          <DeptOptions blankLabel={null} company={company} />
          {!mediaHidden(company) ? <option value="media_fee">{t(ACCT_DEPT_LABELS.media_fee)}</option> : null}
          <option value="other">{t(ACCT_DEPT_LABELS.other)}</option>
        </select>
      </Field>
      <Field label={t(acct.clientName)} wide>
        <input name="client" className="field-input" defaultValue={initial?.client ?? ""} />
      </Field>
      <Field label={t(acct.amountEgp)}>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          dir="ltr"
          className={amountInput}
          defaultValue={initial ? toPounds(initial.amount) : ""}
        />
      </Field>
      <Field label={t(acct.belongsToMonth)}>
        <input name="month" type="month" dir="ltr" className="field-input" defaultValue={initial?.month ?? month} />
      </Field>
      <Field label={t(acct.note)} wide>
        <input name="note" className="field-input" defaultValue={initial?.note ?? ""} />
      </Field>
      <Field label={t(acct.status)}>
        <select
          className="field-input"
          value={String(collected)}
          onChange={(e) => setCollected(e.target.value === "true")}
        >
          <option value="false">{t(acct.pendingStatus)}</option>
          <option value="true">{t(acct.collected)}</option>
        </select>
      </Field>
      {collected ? (
        <Field label={t(acct.collectedOn)}>
          <input
            name="collectedDate"
            type="date"
            dir="ltr"
            className="field-input"
            defaultValue={initial?.collectedDate ?? ""}
          />
        </Field>
      ) : null}
    </AcctModal>
  );
}

export function AddIncomeButton({ company, month }: { company: AcctCompany; month: string }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(acct.addIncome)}
      </button>
      {open ? <IncomeModal company={company} month={month} initial={null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function IncomeActions({ row, company }: { row: IncomeRowDto; company: AcctCompany }) {
  const t = tFor(useLocale());
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  return (
    <span className="flex gap-1.5 justify-end">
      <button
        type="button"
        className="row-toggle row-toggle--restore"
        title={t(acct.toggleCollected)}
        onClick={() =>
          void run(`/api/b-systems/accounting/income/${row.id}`, "PATCH", {
            toggleCollected: true,
            company,
          })
        }
      >
        ✓
      </button>
      <button type="button" className="row-toggle row-toggle--restore" onClick={() => setEditing(true)}>
        {t(acct.edit)}
      </button>
      <button
        type="button"
        className="row-toggle"
        onClick={() => {
          if (window.confirm(t(acct.deleteConfirm)))
            void run(`/api/b-systems/accounting/income/${row.id}?company=${company}`, "DELETE", undefined);
        }}
      >
        {t(acct.delete)}
      </button>
      {editing ? (
        <IncomeModal company={company} month={row.month} initial={row} onClose={() => setEditing(false)} />
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------- expenses */

export interface ExpenseRowDto {
  id: string;
  month: string;
  type: string;
  name: string;
  serviceLine: string;
  amount: number; // piasters (net, for display the page precomputes)
  note: string;
  paid: boolean;
  rosterId: string | null;
  auto: boolean;
}

export interface RosterOption {
  id: string;
  name: string;
}

function ExpenseModal({
  company,
  month,
  roster,
  initial,
  onClose,
}: {
  company: AcctCompany;
  month: string;
  roster: RosterOption[];
  initial: ExpenseRowDto | null;
  onClose: () => void;
}) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const [type, setType] = useState(initial?.type ?? "subscription");
  const [paid, setPaid] = useState(initial?.paid ?? false);
  const submit = (fd: FormData) => {
    const body = {
      company,
      month: String(fd.get("month") || month),
      type,
      name: String(fd.get("name") || ""),
      serviceLine: String(fd.get("serviceLine") || ""),
      amount: egp(fd, "amount"),
      note: String(fd.get("note") || ""),
      paid,
      rosterId: type === "payroll" ? String(fd.get("rosterId") || "") || null : null,
    };
    void run(
      initial
        ? `/api/b-systems/accounting/expenses/${initial.id}`
        : "/api/b-systems/accounting/expenses",
      initial ? "PATCH" : "POST",
      body,
      onClose,
    );
  };
  return (
    <AcctModal
      title={t(initial ? acct.editExpense : acct.addExpense)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(acct.save)}
    >
      <Field label={t(acct.type)}>
        <select className="field-input" value={type} onChange={(e) => setType(e.target.value)}>
          {ACCT_EXPENSE_TYPES.filter((x) => x !== "media" || !mediaHidden(company)).map((x) => (
            <option key={x} value={x}>
              {t(ACCT_EXPENSE_TYPE_LABELS[x])}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t(acct.deptOptional)} hint={t(acct.overheadHint)}>
        <select name="serviceLine" className="field-input" defaultValue={initial?.serviceLine ?? ""}>
          <DeptOptions blankLabel={acct.overheadOption} company={company} />
        </select>
      </Field>
      {type === "payroll" ? (
        <Field label={t(acct.personOptional)} hint={t(acct.personHint)} wide>
          <select name="rosterId" className="field-input" defaultValue={initial?.rosterId ?? ""}>
            <option value="">{t(acct.extraPayrollOption)}</option>
            {roster.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label={t(acct.namePayee)} wide>
        <input name="name" className="field-input" defaultValue={initial?.name ?? ""} placeholder={t(acct.payeePlaceholder)} />
      </Field>
      <Field label={t(acct.amountEgp)}>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          dir="ltr"
          className={amountInput}
          defaultValue={initial ? toPounds(initial.amount) : ""}
        />
      </Field>
      <Field label={t(acct.belongsToMonth)}>
        <input name="month" type="month" dir="ltr" className="field-input" defaultValue={initial?.month ?? month} />
      </Field>
      <Field label={t(acct.note)} wide>
        <input name="note" className="field-input" defaultValue={initial?.note ?? ""} />
      </Field>
      <Field label={t(acct.status)} hint={t(acct.statusHint)}>
        <select className="field-input" value={String(paid)} onChange={(e) => setPaid(e.target.value === "true")}>
          <option value="false">{t(acct.onHold)}</option>
          <option value="true">{t(acct.paid)}</option>
        </select>
      </Field>
    </AcctModal>
  );
}

export function AddExpenseButton({
  company,
  month,
  roster,
}: {
  company: AcctCompany;
  month: string;
  roster: RosterOption[];
}) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(acct.addExpense)}
      </button>
      {open ? (
        <ExpenseModal company={company} month={month} roster={roster} initial={null} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function ExpenseActions({
  row,
  company,
  month,
  roster,
}: {
  row: ExpenseRowDto;
  company: AcctCompany;
  month: string;
  roster: RosterOption[];
}) {
  const t = tFor(useLocale());
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  const togglePaid = () =>
    row.auto
      ? void run("/api/b-systems/accounting/payroll-paid", "POST", {
          company,
          memberId: row.rosterId,
          month: row.month,
        })
      : void run(`/api/b-systems/accounting/expenses/${row.id}`, "PATCH", {
          togglePaid: true,
          company,
        });
  return (
    <span className="flex gap-1.5 justify-end">
      <button
        type="button"
        className="row-toggle row-toggle--restore"
        title={t(row.paid ? acct.markOnHold : acct.approveMarkPaid)}
        onClick={togglePaid}
      >
        ✓
      </button>
      {row.auto ? (
        <Link
          className="row-toggle row-toggle--restore inline-flex items-center"
          href={`/b-systems/accounting/roster${acctQuery({ company, month })}`}
          title={t(acct.editInRoster)}
        >
          {t(acct.editInRoster)}
        </Link>
      ) : (
        <>
          <button type="button" className="row-toggle row-toggle--restore" onClick={() => setEditing(true)}>
            {t(acct.edit)}
          </button>
          <button
            type="button"
            className="row-toggle"
            onClick={() => {
              if (window.confirm(t(acct.deleteConfirm)))
                void run(`/api/b-systems/accounting/expenses/${row.id}?company=${company}`, "DELETE", undefined);
            }}
          >
            {t(acct.delete)}
          </button>
        </>
      )}
      {editing ? (
        <ExpenseModal company={company} month={row.month} roster={roster} initial={row} onClose={() => setEditing(false)} />
      ) : null}
    </span>
  );
}

/* ---------------------------------------------------------------- roster */

export interface MemberDto {
  id: string;
  name: string;
  role: string;
  serviceLine: string;
  account: string;
  salary: number; // current effective, piasters
  active: boolean; // current effective
}

function RosterModal({
  company,
  month,
  initial,
  onClose,
}: {
  company: AcctCompany;
  month: string;
  initial: MemberDto | null;
  onClose: () => void;
}) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const submit = (fd: FormData) => {
    const body = {
      company,
      name: String(fd.get("name") || ""),
      role: String(fd.get("role") || ""),
      serviceLine: String(fd.get("serviceLine") || ""),
      account: String(fd.get("account") || ""),
      salary: egp(fd, "salary"),
      active: initial ? String(fd.get("active")) === "true" : true,
      from: String(fd.get("from") || month),
    };
    void run(
      initial ? `/api/b-systems/accounting/roster/${initial.id}` : "/api/b-systems/accounting/roster",
      initial ? "PATCH" : "POST",
      body,
      onClose,
    );
  };
  return (
    <AcctModal
      title={t(initial ? acct.editPerson : acct.addPerson)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(acct.save)}
    >
      <Field label={t(acct.name)}>
        <input name="name" className="field-input" required defaultValue={initial?.name ?? ""} />
      </Field>
      <Field label={t(acct.role)}>
        <input name="role" className="field-input" defaultValue={initial?.role ?? ""} placeholder={t(acct.rolePlaceholder)} />
      </Field>
      <Field label={t(acct.department)}>
        <select name="serviceLine" className="field-input" defaultValue={initial?.serviceLine ?? ""}>
          <DeptOptions blankLabel={acct.none} company={company} />
        </select>
      </Field>
      <Field label={t(acct.paymentAccountNo)} hint={t(acct.paymentAccountHint)}>
        <input name="account" className="field-input" inputMode="numeric" dir="ltr" defaultValue={initial?.account ?? ""} />
      </Field>
      <Field label={t(acct.monthlySalaryEgp)}>
        <input
          name="salary"
          type="number"
          step="0.01"
          min="0"
          required
          dir="ltr"
          className={amountInput}
          defaultValue={initial ? toPounds(initial.salary) : ""}
        />
      </Field>
      <Field
        label={t(initial ? acct.effectiveFrom : acct.salaryStarts)}
        hint={t(initial ? acct.effectiveFromHint : acct.salaryStartsHint)}
      >
        <input name="from" type="month" dir="ltr" className="field-input" defaultValue={month} />
      </Field>
      {initial ? (
        <Field label={t(acct.status)}>
          <select name="active" className="field-input" defaultValue={String(initial.active)}>
            <option value="true">{t(acct.active)}</option>
            <option value="false">{t(acct.removedOnLeave)}</option>
          </select>
        </Field>
      ) : null}
    </AcctModal>
  );
}

export function AddPersonButton({ company, month }: { company: AcctCompany; month: string }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(acct.addPerson)}
      </button>
      {open ? <RosterModal company={company} month={month} initial={null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function RosterActions({
  member,
  company,
  month,
}: {
  member: MemberDto;
  company: AcctCompany;
  month: string;
}) {
  const t = tFor(useLocale());
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  return (
    <span className="flex gap-1.5 justify-end">
      <button
        type="button"
        className="row-toggle row-toggle--restore"
        title={t(acct.toggleActiveFromMonth)}
        onClick={() =>
          void run(`/api/b-systems/accounting/roster/${member.id}`, "PATCH", {
            toggleActive: true,
            company,
          })
        }
      >
        ⇄
      </button>
      <button type="button" className="row-toggle row-toggle--restore" onClick={() => setEditing(true)}>
        {t(acct.edit)}
      </button>
      <button
        type="button"
        className="row-toggle"
        onClick={() => {
          if (window.confirm(t(acct.deleteConfirm)))
            void run(`/api/b-systems/accounting/roster/${member.id}?company=${company}`, "DELETE", undefined);
        }}
      >
        {t(acct.delete)}
      </button>
      {editing ? (
        <RosterModal company={company} month={month} initial={member} onClose={() => setEditing(false)} />
      ) : null}
    </span>
  );
}

/* ----------------------------------------------------------------- media */

export function MediaButtons({ company, month }: { company: AcctCompany; month: string }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const [mode, setMode] = useState<"received" | "sent" | null>(null);
  const [amount, setAmount] = useState("");
  const [feeMode, setFeeMode] = useState<"pct" | "flat">("pct");
  const [feePct, setFeePct] = useState("15");
  const [feeFlat, setFeeFlat] = useState("");
  const amountP = (() => {
    try {
      return toPiasters(amount || "0");
    } catch {
      return 0;
    }
  })();
  const feeP =
    feeMode === "pct"
      ? Math.round((amountP * (Number(feePct) || 0)) / 100)
      : (() => {
          try {
            return toPiasters(feeFlat || "0");
          } catch {
            return 0;
          }
        })();
  const close = () => {
    setMode(null);
    setAmount("");
    setFeeFlat("");
    setFeePct("15");
    setFeeMode("pct");
  };
  const submit = (fd: FormData) => {
    const base = {
      company,
      month,
      client: String(fd.get("client") || ""),
      amount: amountP,
      ref: String(fd.get("ref") || ""),
    };
    void run(
      "/api/b-systems/accounting/media",
      "POST",
      mode === "received" ? { ...base, mode, feeAmount: feeP } : { ...base, mode },
      close,
    );
  };
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setMode("received")}>
        + {t(acct.fundsFromClient)}
      </button>
      <button type="button" className="btn-ghost" onClick={() => setMode("sent")}>
        {t(acct.sendToBuyer)}
      </button>
      {mode ? (
        <AcctModal
          title={t(mode === "received" ? acct.fundsReceivedTitle : acct.sendFundsTitle)}
          onClose={close}
          onSubmit={submit}
          busy={busy}
          error={error}
          submitLabel={t(acct.save)}
        >
          <Field label={t(acct.client)}>
            <input name="client" className="field-input" required defaultValue="" />
          </Field>
          <Field label={t(mode === "received" ? acct.totalReceivedEgp : acct.amountSentEgp)}>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              dir="ltr"
              className={amountInput}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          {mode === "received" ? (
            <Field label={t(acct.agencyFeeYourIncome)} hint={t(acct.agencyFeeHint)} wide>
              <span className="flex flex-wrap items-center gap-2">
                <select
                  className="field-input max-w-40"
                  value={feeMode}
                  onChange={(e) => setFeeMode(e.target.value as "pct" | "flat")}
                >
                  <option value="pct">{t(acct.pctOfBudget)}</option>
                  <option value="flat">{t(acct.flatFee)}</option>
                </select>
                {feeMode === "pct" ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    className="field-input max-w-32"
                    value={feePct}
                    onChange={(e) => setFeePct(e.target.value)}
                  />
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    className="field-input max-w-32"
                    value={feeFlat}
                    onChange={(e) => setFeeFlat(e.target.value)}
                  />
                )}
                <span className="u-muted">
                  {t(acct.feeIncomeIs)}
                  <strong>{formatEGP(feeP)}</strong>
                  {" · "}
                  {t(acct.heldForAds)}
                  <strong>{formatEGP(Math.max(0, amountP - feeP))}</strong>
                </span>
              </span>
            </Field>
          ) : null}
          <Field label={t(acct.referenceNote)} wide>
            <input
              name="ref"
              className="field-input"
              placeholder={t(mode === "received" ? acct.transferRef : acct.buyerPlatform)}
            />
          </Field>
        </AcctModal>
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------------- loans */

export interface LoanDto {
  id: string;
  direction: string;
  party: string;
  outstanding: number; // piasters
}

export function AddLoanButton({ company, month: _month }: { company: AcctCompany; month: string }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"borrowed" | "lent">("borrowed");
  const [moveCash, setMoveCash] = useState(true);
  const submit = (fd: FormData) => {
    void run(
      "/api/b-systems/accounting/loans",
      "POST",
      {
        company,
        direction,
        party: String(fd.get("party") || ""),
        principal: egp(fd, "principal"),
        date: String(fd.get("date") || ""),
        dueDate: String(fd.get("dueDate") || ""),
        note: String(fd.get("note") || ""),
        moveCash,
      },
      () => setOpen(false),
    );
  };
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(acct.newLoan)}
      </button>
      {open ? (
        <AcctModal
          title={t(acct.newLoan)}
          onClose={() => setOpen(false)}
          onSubmit={submit}
          busy={busy}
          error={error}
          submitLabel={t(acct.saveLoan)}
        >
          <Field label={t(acct.direction)} wide>
            <select
              className="field-input"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "borrowed" | "lent")}
            >
              <option value="borrowed">{t(acct.weBorrowed)}</option>
              <option value="lent">{t(acct.weLent)}</option>
            </select>
          </Field>
          <Field label={t(direction === "borrowed" ? acct.lenderLabel : acct.borrowerLabel)} wide>
            <input
              name="party"
              className="field-input"
              required
              placeholder={t(direction === "borrowed" ? acct.lenderPlaceholder : acct.borrowerPlaceholder)}
            />
          </Field>
          <Field label={t(acct.amountEgp)}>
            <input name="principal" type="number" step="0.01" min="0" required dir="ltr" className={amountInput} />
          </Field>
          <Field label={t(acct.date)}>
            <input name="date" type="date" required dir="ltr" className="field-input" />
          </Field>
          <Field label={t(acct.dueDateOptional)}>
            <input name="dueDate" type="date" dir="ltr" className="field-input" />
          </Field>
          <Field label={t(acct.note)}>
            <input name="note" className="field-input" placeholder={t(acct.loanNotePlaceholder)} />
          </Field>
          <label className="check-row field--wide">
            <input type="checkbox" checked={moveCash} onChange={(e) => setMoveCash(e.target.checked)} />
            {t(acct.recordCashMove)}
          </label>
        </AcctModal>
      ) : null}
    </>
  );
}

export function LoanActions({ loan, company }: { loan: LoanDto; company: AcctCompany }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const [paying, setPaying] = useState(false);
  const [moveCash, setMoveCash] = useState(true);
  const settled = loan.outstanding <= 50;
  const submit = (fd: FormData) => {
    void run(
      `/api/b-systems/accounting/loans/${loan.id}/payments`,
      "POST",
      {
        company,
        amount: egp(fd, "amount"),
        date: String(fd.get("date") || ""),
        note: String(fd.get("note") || ""),
        moveCash,
      },
      () => setPaying(false),
    );
  };
  return (
    <span className="flex gap-1.5 justify-end">
      {!settled ? (
        <button type="button" className="row-toggle row-toggle--restore" onClick={() => setPaying(true)}>
          {t(loan.direction === "borrowed" ? acct.recordRepayment : acct.recordCollection)}
        </button>
      ) : null}
      <button
        type="button"
        className="row-toggle"
        onClick={() => {
          if (window.confirm(t(acct.deleteConfirm)))
            void run(`/api/b-systems/accounting/loans/${loan.id}?company=${company}`, "DELETE", undefined);
        }}
      >
        {t(acct.delete)}
      </button>
      {paying ? (
        <AcctModal
          title={t(loan.direction === "borrowed" ? acct.recordRepayment : acct.recordCollection)}
          onClose={() => setPaying(false)}
          onSubmit={submit}
          busy={busy}
          error={error}
          submitLabel={t(acct.save)}
        >
          <p className="u-muted field--wide">
            {loan.party} · {t(acct.outstandingIs)} <strong>{formatEGP(loan.outstanding)}</strong>
          </p>
          <Field label={t(acct.amountEgp)}>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              dir="ltr"
              className={amountInput}
              defaultValue={toPounds(loan.outstanding)}
            />
          </Field>
          <Field label={t(acct.date)}>
            <input name="date" type="date" required dir="ltr" className="field-input" />
          </Field>
          <Field label={t(acct.note)} wide>
            <input name="note" className="field-input" />
          </Field>
          <label className="check-row field--wide">
            <input type="checkbox" checked={moveCash} onChange={(e) => setMoveCash(e.target.checked)} />
            {t(acct.recordCashMove)}
          </label>
        </AcctModal>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------- treasury */

export interface MoveDto {
  id: string;
  month: string;
  kind: string;
  label: string;
  amount: number;
  date: string;
}

function MoveModal({
  company,
  month,
  initial,
  onClose,
}: {
  company: AcctCompany;
  month: string;
  initial: MoveDto | null;
  onClose: () => void;
}) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const submit = (fd: FormData) => {
    const body = {
      company,
      month: String(fd.get("month") || month),
      kind: String(fd.get("kind")),
      label: String(fd.get("label") || ""),
      amount: egp(fd, "amount"),
      date: String(fd.get("date") || ""),
    };
    void run(
      initial
        ? `/api/b-systems/accounting/treasury/${initial.id}`
        : "/api/b-systems/accounting/treasury",
      initial ? "PATCH" : "POST",
      body,
      onClose,
    );
  };
  return (
    <AcctModal
      title={t(initial ? acct.editMovement : acct.movementTitle)}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={t(acct.save)}
    >
      <Field label={t(acct.type)}>
        <select name="kind" className="field-input" defaultValue={initial?.kind ?? "deposit"}>
          <option value="deposit">{t(acct.depositIn)}</option>
          <option value="withdraw">{t(acct.withdrawOut)}</option>
        </select>
      </Field>
      <Field label={t(acct.label)}>
        <input name="label" className="field-input" defaultValue={initial?.label ?? ""} placeholder={t(acct.moveLabelPlaceholder)} />
      </Field>
      <Field label={t(acct.amountEgp)}>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          dir="ltr"
          className={amountInput}
          defaultValue={initial ? toPounds(initial.amount) : ""}
        />
      </Field>
      <Field label={t(acct.belongsToMonth)}>
        <input name="month" type="month" dir="ltr" className="field-input" defaultValue={initial?.month ?? month} />
      </Field>
      <Field label={t(acct.date)}>
        <input name="date" type="date" required dir="ltr" className="field-input" defaultValue={initial?.date ?? ""} />
      </Field>
    </AcctModal>
  );
}

export function AddMoveButton({ company, month }: { company: AcctCompany; month: string }) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(acct.depositWithdraw)}
      </button>
      {open ? <MoveModal company={company} month={month} initial={null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function MoveActions({ row, company }: { row: MoveDto; company: AcctCompany }) {
  const t = tFor(useLocale());
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  return (
    <span className="flex gap-1.5 justify-end">
      <button type="button" className="row-toggle row-toggle--restore" onClick={() => setEditing(true)}>
        {t(acct.edit)}
      </button>
      <button
        type="button"
        className="row-toggle"
        onClick={() => {
          if (window.confirm(t(acct.deleteConfirm)))
            void run(`/api/b-systems/accounting/treasury/${row.id}?company=${company}`, "DELETE", undefined);
        }}
      >
        {t(acct.delete)}
      </button>
      {editing ? (
        <MoveModal company={company} month={row.month} initial={row} onClose={() => setEditing(false)} />
      ) : null}
    </span>
  );
}

export function OpeningButton({ company, current }: { company: AcctCompany; current: number }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const submit = (fd: FormData) => {
    void run(
      "/api/b-systems/accounting/settings",
      "PUT",
      { company, openingBalance: egp(fd, "openingBalance") },
      () => setOpen(false),
    );
  };
  return (
    <>
      <button type="button" className="btn-ghost btn--sm" onClick={() => setOpen(true)}>
        {t(acct.set)}
      </button>
      {open ? (
        <AcctModal
          title={t(acct.systemOpeningTitle)}
          onClose={() => setOpen(false)}
          onSubmit={submit}
          busy={busy}
          error={error}
          submitLabel={t(acct.save)}
        >
          <Field label={t(acct.systemOpeningLabel)} hint={t(acct.systemOpeningHint)} wide>
            <input
              name="openingBalance"
              type="number"
              step="0.01"
              min="0"
              required
              dir="ltr"
              className={amountInput}
              defaultValue={toPounds(current)}
            />
          </Field>
        </AcctModal>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- targets */

export function AddTargetButton({ company, month }: { company: AcctCompany; month: string }) {
  const t = tFor(useLocale());
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const submit = (fd: FormData) => {
    void run(
      "/api/b-systems/accounting/targets",
      "POST",
      { company, period: String(fd.get("period") || month), goal: egp(fd, "goal") },
      () => setOpen(false),
    );
  };
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + {t(acct.setTarget)}
      </button>
      {open ? (
        <AcctModal
          title={t(acct.setMonthlyTarget)}
          onClose={() => setOpen(false)}
          onSubmit={submit}
          busy={busy}
          error={error}
          submitLabel={t(acct.save)}
        >
          <Field label={t(acct.monthCol)}>
            <input name="period" type="month" required dir="ltr" className="field-input" defaultValue={month} />
          </Field>
          <Field label={t(acct.incomeGoalEgp)}>
            <input name="goal" type="number" step="0.01" min="0" required dir="ltr" className={amountInput} />
          </Field>
        </AcctModal>
      ) : null}
    </>
  );
}

export function TargetActions({ id, company }: { id: string; company: AcctCompany }) {
  const t = tFor(useLocale());
  const { run } = useAction();
  return (
    <button
      type="button"
      className="row-toggle"
      onClick={() => {
        if (window.confirm(t(acct.deleteConfirm)))
          void run(`/api/b-systems/accounting/targets/${id}?company=${company}`, "DELETE", undefined);
      }}
    >
      {t(acct.delete)}
    </button>
  );
}
