"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, inputCls, labelCls } from "@/components/portal/groupForms";

/* V2 §4/§5 — admin milestone check/uncheck + proposal/contract PDF uploads. */

export function MilestoneCheckbox({
  milestoneId,
  completed,
  disabled,
  label,
}: {
  milestoneId: string;
  completed: boolean;
  disabled: boolean;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={completed}
        disabled={disabled || busy}
        aria-label={`Milestone completed: ${label}`}
        onChange={async (e) => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/b-systems/milestones/${milestoneId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: e.target.checked }),
          });
          setBusy(false);
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            setError(data?.error ?? "Failed");
            return;
          }
          router.refresh();
        }}
      />
      {error ? <span className="text-xs text-brand-danger">{error}</span> : null}
    </span>
  );
}

export function WonDocumentUpload({ wonDealId }: { wonDealId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"proposal" | "contract">("proposal");
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
        fd.append("kind", kind);
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/b-systems/won-leads/${wonDealId}/documents`, {
          method: "POST",
          body: fd,
        });
        setBusy(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Upload failed");
          return;
        }
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }}
      className="space-y-2"
    >
      {error ? <p className="alert-error">{error}</p> : null}
      <div className="flex items-end gap-2 flex-wrap">
        <label className="block">
          <span className={labelCls}>Document</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "proposal" | "contract")}
            className={inputCls}
          >
            <option value="proposal">Proposal PDF</option>
            <option value="contract">Contract PDF</option>
          </select>
        </label>
        <label className="block flex-1 min-w-48">
          <span className={labelCls}>File (.pdf / .doc / .docx)</span>
          <span className="dropzone">
            <span className="dropzone-icon" aria-hidden="true">
              ↑
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              required
              className="text-sm min-w-0 flex-1"
            />
          </span>
        </label>
        <button type="submit" disabled={busy} className={btnPrimary}>
          Upload
        </button>
      </div>
    </form>
  );
}
