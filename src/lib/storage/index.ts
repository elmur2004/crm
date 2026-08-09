import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { ApiError } from "@/lib/api-error";

/* Storage abstraction (SPEC §2): local /uploads in dev behind an interface an
   S3-compatible driver can replace later. Keys are opaque server-generated ids —
   never user-controlled paths. Files are served ONLY through the authenticated
   /api/files route (a rep's CV is not world-readable — ARCHITECTURE §8). */

export interface StoredFile {
  key: string;
  size: number;
}

export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  stream(key: string): NodeJS.ReadableStream;
  size(key: string): Promise<number>;
  delete(key: string): Promise<void>;
}

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

function safePath(key: string): string {
  if (!/^[a-z0-9]+\.[a-z0-9]{2,5}$/i.test(key)) throw new ApiError(400, "Bad file key");
  return path.join(UPLOADS_DIR, key);
}

export const localStorageDriver: Storage = {
  async put(key, data) {
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(safePath(key), data);
  },
  read(key) {
    return readFile(safePath(key));
  },
  stream(key) {
    return createReadStream(safePath(key));
  },
  async size(key) {
    return (await stat(safePath(key))).size;
  },
  delete(key) {
    return unlink(safePath(key)).catch(() => undefined);
  },
};

export const storage: Storage = localStorageDriver;

/* ---------- validation (SPEC §7.2, §8.1, §15) ---------- */

export type UploadKind = "cv" | "recording" | "payment_proof";

const RULES: Record<
  UploadKind,
  { maxBytes: number; extensions: string[]; mimes: string[] }
> = {
  cv: {
    maxBytes: 10 * 1024 * 1024, // ≤ 10 MB (also used for proposal/contract PDFs — V2 §5)
    extensions: ["pdf", "doc", "docx"],
    mimes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  recording: {
    maxBytes: 50 * 1024 * 1024, // ≤ 50 MB (§15)
    extensions: ["mp3", "mp4"],
    mimes: ["audio/mpeg", "audio/mp3", "video/mp4", "audio/mp4"],
  },
  payment_proof: {
    maxBytes: 5 * 1024 * 1024, // ≤ 5 MB image (V2 §7)
    extensions: ["png", "jpg", "jpeg", "webp"],
    mimes: ["image/png", "image/jpeg", "image/webp"],
  },
};

function sniffOk(kind: UploadKind, ext: string, bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  if (kind === "recording") {
    if (ext === "mp3") {
      // ID3 tag or MPEG frame sync
      return (
        bytes.subarray(0, 3).toString("ascii") === "ID3" ||
        (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)
      );
    }
    return bytes.subarray(4, 8).toString("ascii") === "ftyp"; // mp4
  }
  if (kind === "payment_proof") {
    if (ext === "png") return bytes.readUInt32BE(0) === 0x89504e47;
    if (ext === "jpg" || ext === "jpeg")
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (ext === "pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (ext === "doc") return bytes.readUInt32BE(0) === 0xd0cf11e0; // OLE
  return bytes[0] === 0x50 && bytes[1] === 0x4b; // docx = zip "PK"
}

/** Validates a browser File and stores it. Returns Attachment-ready fields. */
export async function validateAndStore(
  kind: UploadKind,
  file: File,
): Promise<{ key: string; filename: string; mime: string; size: number }> {
  const rules = RULES[kind];
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!rules.extensions.includes(ext)) {
    throw new ApiError(400, `Allowed file types: ${rules.extensions.join(", ")}`);
  }
  if (file.size === 0) throw new ApiError(400, "Empty file");
  if (file.size > rules.maxBytes) {
    throw new ApiError(400, `File too large — max ${Math.round(rules.maxBytes / 1024 / 1024)} MB`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffOk(kind, ext, buffer)) {
    throw new ApiError(400, "File content does not match its extension");
  }
  const key = `${randomUUID().replace(/-/g, "")}.${ext}`;
  await storage.put(key, buffer);
  const filename = path.basename(file.name).replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  const mime = rules.mimes.includes(file.type) ? file.type : rules.mimes[0]!;
  return { key, filename, mime, size: buffer.length };
}
