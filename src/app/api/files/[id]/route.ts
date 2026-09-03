import { ApiError } from "@/lib/api-error";
import { canUseModule } from "@/lib/auth/roles";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { vaultCompaniesOf, visibleCompany } from "@/lib/services/vault/tenancy";
import type { Brand } from "@/lib/pipeline-engine/constants";

import { handleRoute, requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

/* ADR-074 — the Attachment.kind values the DATA VAULT owns. Listed rather than
   inferred: a kind added tomorrow falls into the won-deal branch below, which
   is the stricter of the two, and that is the right way round to be wrong. */
const VAULT_ATTACHMENT_KINDS: readonly string[] = [
  "vault_document",
  "vault_sheet",
  "vault_attachment",
];

/* Authenticated file serving (ARCHITECTURE §8): recordings → B-Systems staff;
   CVs → the owning rep or portal admin (or B-Systems staff per A-8 pairing).
   Range requests supported so <audio>/<video> can seek inline (§7.2). */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function missingFilePage(filename: string, backHref: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>File not available</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         background: #f4f5f7; color: #1c2430; }
  .card { max-width: 480px; margin: 24px; padding: 32px; border-radius: 16px;
          background: #ffffff; border: 1px solid #e2e6ec;
          box-shadow: 0 8px 30px rgba(16, 24, 40, .08); }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .file { font-family: ui-monospace, monospace; font-size: 13px; color: #5b6675;
          word-break: break-all; margin: 0 0 16px; }
  p { font-size: 14px; line-height: 1.6; color: #3d4756; margin: 0 0 12px; }
  a.btn { display: inline-block; margin-top: 8px; padding: 10px 18px; border-radius: 10px;
          background: #1c2430; color: #fff; text-decoration: none; font-size: 14px; }
  @media (prefers-color-scheme: dark) {
    body { background: #10151c; color: #e8ecf2; }
    .card { background: #1a212b; border-color: #2a3441; }
    .file { color: #93a0b0; } p { color: #b8c2cf; }
    a.btn { background: #e8ecf2; color: #10151c; }
  }
</style>
</head>
<body>
  <div class="card">
    <h1>This file is no longer in storage</h1>
    <p class="file">${esc(filename)}</p>
    <p>Its record still exists, but the file itself is gone. This usually means it was
       uploaded before the latest deployment, on a server without persistent upload
       storage — redeploys wipe the container's files.</p>
    <p>To fix it: upload the file again — for statement proofs the admin has a
       <strong> Re-upload proof</strong> button; for anything else, ask your admin.
       To keep it from happening again, the server needs a persistent storage
       volume for uploads.</p>
    <a class="btn" href="${esc(backHref)}">Go back</a>
  </div>
</body>
</html>`;
}

export const GET = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const attachment = await db.attachment.findUnique({
      where: { id },
      include: {
        rep: { select: { userId: true } },
        /* ADR-074 — the two kinds a THIRD COMPANY can own: a won-deal document
           (its lead carries the brand) and a vault record (its own company
           column). Both are needed to answer "may this account read these
           bytes", and neither was asked before. */
        wonDeal: { select: { lead: { select: { brand: true } } } },
        vaultDocument: { select: { company: true } },
        vaultSheet: { select: { company: true } },
        vaultTask: { select: { company: true } },
      },
    });
    if (!attachment) throw new ApiError(404, "File not found");

    const isAdmin = user.roles.includes("bsystems_admin");
    if (attachment.kind === "recording") {
      if (!isAdmin && !user.roles.includes("bsystems_sales")) throw new ApiError(403, "No access");
    } else if (attachment.kind === "cv") {
      const isOwner = attachment.rep?.userId === user.id;
      if (!isOwner && !isAdmin) throw new ApiError(403, "No access");
    } else if (attachment.kind === "payment_proof") {
      // V2 §7: the admin and the statement's closer can see the proof
      if (!isAdmin) {
        const statement = attachment.statementId
          ? await db.statement.findUnique({ where: { id: attachment.statementId } })
          : null;
        if (statement?.closerUserId !== user.id) throw new ApiError(403, "No access");
      }
    } else if (VAULT_ATTACHMENT_KINDS.includes(attachment.kind)) {
      /* ADR-074 — VAULT BYTES follow the vault's own tenancy, not the
         B-Systems admin role. Two things were wrong at once here: Mindoo's
         administrator got 403 on a file HE had just uploaded (the vault is his
         module too), and a B-Systems admin could fetch Mindoo's vault bytes by
         id — the row list was walled and the file behind it was not. */
      if (!canUseModule(user, "vault")) throw new ApiError(404, "File not found");
      const company =
        attachment.vaultDocument?.company ??
        attachment.vaultSheet?.company ??
        attachment.vaultTask?.company ??
        null;
      if (!visibleCompany(vaultCompaniesOf(user), company)) {
        throw new ApiError(404, "File not found");
      }
    } else {
      /* proposal/contract PDFs on won leads (V2 §5) — the COMPANY'S OWN
         administrator, whoever that is. ADR-074: Mindoo wins the same way
         B-Systems does, so it uploads these and must be able to read them
         back; and a B-Systems admin must not read Mindoo's by id. 404 rather
         than 403, as everywhere else a company boundary is crossed. */
      const brand = attachment.wonDeal?.lead.brand ?? null;
      const mine = brand === null ? isAdmin : moduleCompaniesFor(user.roles).includes(brand as Brand);
      if (!mine) throw new ApiError(404, "File not found");
    }

    const total = await storage.size(attachment.storageKey).catch(() => null);
    if (total === null) {
      /* The DB row survived but the file did not — the classic cause is a
         redeploy on a host without a persistent uploads volume. Browsers get
         a readable page; API consumers keep the JSON 404. */
      if (req.headers.get("accept")?.includes("text/html")) {
        const back = req.headers.get("referer") ?? "/";
        return new Response(missingFilePage(attachment.filename, back), {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      throw new ApiError(404, "File missing from storage");
    }

    const range = req.headers.get("range");
    const baseHeaders: Record<string, string> = {
      "Content-Type": attachment.mime,
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
      "Cache-Control": "private, max-age=0",
    };

    const buffer = await storage.read(attachment.storageKey);
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
        if (start <= end && start < total) {
          const body = new Uint8Array(buffer.subarray(start, end + 1));
          return new Response(body, {
            status: 206,
            headers: {
              ...baseHeaders,
              "Content-Range": `bytes ${start}-${end}/${total}`,
              "Content-Length": String(end - start + 1),
            },
          });
        }
      }
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(total) },
    });
  },
);
