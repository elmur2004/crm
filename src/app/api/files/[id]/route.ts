import { ApiError } from "@/lib/api-error";
import { handleRoute, requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

/* Authenticated file serving (ARCHITECTURE §8): recordings → B-Systems staff;
   CVs → the owning rep or portal admin (or B-Systems staff per A-8 pairing).
   Range requests supported so <audio>/<video> can seek inline (§7.2). */

export const GET = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const attachment = await db.attachment.findUnique({
      where: { id },
      include: { rep: { select: { userId: true } } },
    });
    if (!attachment) throw new ApiError(404, "File not found");

    if (attachment.kind === "recording") {
      if (!user.roles.includes("bsystems_staff")) throw new ApiError(403, "No access");
    } else {
      const isOwner = attachment.rep?.userId === user.id;
      const isAdmin = user.roles.includes("portal_admin");
      if (!isOwner && !isAdmin) throw new ApiError(403, "No access");
    }

    const total = await storage.size(attachment.storageKey).catch(() => null);
    if (total === null) throw new ApiError(404, "File missing from storage");

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
