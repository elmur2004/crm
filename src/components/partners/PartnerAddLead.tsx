"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_TYPES, LEAD_TYPE_LABELS } from "@/lib/pipeline-engine/constants";

/* §7.4 / PP-5 — add a lead inside a partner's detail: §6.1 lead fields + optional
   assign-to-rep (A-6, default Unassigned). The server stamps the attribution. */

const inputCls =
  "w-full border border-brand-border rounded-brand-control px-3 py-2 bg-brand-surface-card text-sm";
const labelCls = "block text-sm font-medium mb-1";
const btnPrimary =
  "bg-brand-primary text-brand-on-primary rounded-brand-control px-4 py-2 text-sm font-medium disabled:opacity-50";

export function PartnerAddLeadClient({
  partnerId,
  reps,
}: {
  partnerId: string;
  reps: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        Add lead
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/b-systems/partners/${partnerId}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salesRepId: String(fd.get("salesRepId") || "") || undefined,
            name: String(fd.get("name")),
            number: String(fd.get("number")),
            email: String(fd.get("email") || "") || undefined,
            type: String(fd.get("type")),
            description: String(fd.get("description") || "") || undefined,
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
      className="border border-brand-border rounded-brand-card p-4 space-y-3 bg-brand-surface-card w-full"
    >
      <p className="text-sm font-bold">New lead from this partner</p>
      {error ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Number</span>
          <input type="tel" name="number" required className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input type="email" name="email" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Type</span>
          <select name="type" required className={inputCls}>
            {LEAD_TYPES.map((t) => (
              <option key={t} value={t}>
                {LEAD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Assign to rep (optional)</span>
          <select name="salesRepId" className={inputCls}>
            <option value="">Unassigned (Partner leads)</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Description</span>
        <textarea name="description" rows={2} className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className={btnPrimary}>
        Save lead
      </button>
    </form>
  );
}
