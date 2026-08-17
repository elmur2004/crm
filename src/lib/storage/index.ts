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

/* UPLOADS_DIR env points storage at a persistent volume in production —
   without it, files live inside the container and die on every redeploy. */
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));

export function uploadsDir(): string {
  return UPLOADS_DIR;
}

export function uploadsDirConfigured(): boolean {
  return Boolean(process.env.UPLOADS_DIR);
}

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

/* ---------- validation (SPEC §7.2, §8.1, §15 + ADR-053) ---------- */

export type UploadKind =
  | "cv"
  | "recording"
  | "payment_proof"
  /* data vault (ADR-053): sheet files, document files, task-result files */
  | "vault_sheet"
  | "vault_document"
  | "vault_attachment";

const VAULT_MAX = 25 * 1024 * 1024; // the reference app's 25 MB cap (its D-09)

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
  /* vault allowlists mirror the reference app's per-context lists exactly */
  vault_sheet: {
    maxBytes: VAULT_MAX,
    extensions: ["xlsx", "xls", "csv"],
    mimes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ],
  },
  vault_document: {
    maxBytes: VAULT_MAX,
    extensions: ["pdf", "docx", "xlsx"],
    mimes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  vault_attachment: {
    maxBytes: VAULT_MAX,
    extensions: ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg", "txt"],
    mimes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/png",
      "image/jpeg",
      "text/plain",
    ],
  },
};

/* ---- content inspection helpers (ADR-053 — ported as a RULE, not as code,
   from the reference Vault app's inspect.ts: a platform-wide upgrade) ---- */

/** ZIP local-file-header signature. */
function isZip(bytes: Buffer): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  );
}

/**
 * OOXML files (docx/xlsx/pptx) are ZIP containers, and a bare "PK" check would
 * accept ANY zip renamed to .docx. The part *names* are stored uncompressed in
 * the archive headers, so reading the raw bytes for "[Content_Types].xml" plus
 * the flavour prefix ("word/", "xl/", "ppt/") discriminates the real thing
 * without decompressing anything (no decompression-bomb surface).
 */
function ooxmlFlavour(bytes: Buffer): "docx" | "xlsx" | "pptx" | null {
  if (!isZip(bytes)) return null;
  const text = bytes.toString("latin1");
  if (!text.includes("[Content_Types].xml")) return null;
  if (text.includes("xl/")) return "xlsx";
  if (text.includes("word/")) return "docx";
  if (text.includes("ppt/")) return "pptx";
  return null;
}

/** Legacy Office compound-document header (.xls / .doc). */
function isCompoundDoc(bytes: Buffer): boolean {
  const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return bytes.length > 8 && sig.every((b, i) => bytes[i] === b);
}

/**
 * CSV and plain text have no magic bytes at all, so they get a deliberate
 * sniff: must decode as text (no NUL, no control-byte soup), and "csv" further
 * wants a consistent delimiter across the first lines. Heuristic by nature —
 * unit-tested in src/lib/services/vault/row-count.test.ts alongside the
 * counting rules that share it.
 */
export function sniffText(bytes: Buffer): "csv" | "txt" | null {
  const sample = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  if (sample.includes(0)) return null; // NUL byte — binary

  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(sample);
  } catch {
    // Not valid UTF-8; allow latin-1 text but reject control soup.
    decoded = sample.toString("latin1");
    const control = [...decoded].filter(
      (ch) => ch.charCodeAt(0) < 9 || (ch.charCodeAt(0) > 13 && ch.charCodeAt(0) < 32),
    ).length;
    if (control / decoded.length > 0.01) return null;
  }

  const clean = decoded.replace(/^﻿/, "");
  if (clean.trim().length === 0) return null;

  const lines = clean
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 20);
  if (lines.length === 0) return null;

  for (const delim of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => splitOutsideQuotes(l, delim).length);
    const first = counts[0] ?? 0;
    if (first > 1 && counts.every((c) => c === first)) return "csv";
  }
  return "txt";
}

/** Delimiter counting that ignores separators inside quoted fields. */
function splitOutsideQuotes(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function sniffOk(kind: UploadKind, ext: string, bytes: Buffer): boolean {
  /* text formats may legitimately be tiny; binary formats under 12 bytes are junk */
  if (bytes.length < 12 && ext !== "csv" && ext !== "txt") return false;
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
  /* document-ish kinds (cv + the vault kinds) — the type is decided by the
     BYTES, never the extension (the reference app's BR-04, kept verbatim) */
  switch (ext) {
    case "pdf":
      return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    case "doc":
    case "xls":
      return isCompoundDoc(bytes); // OLE/BIFF container
    case "docx":
      return ooxmlFlavour(bytes) === "docx"; // upgraded from bare "PK" (ADR-053)
    case "xlsx":
      return ooxmlFlavour(bytes) === "xlsx";
    case "pptx":
      return ooxmlFlavour(bytes) === "pptx";
    case "png":
      return bytes.readUInt32BE(0) === 0x89504e47;
    case "jpg":
    case "jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "csv":
      return sniffText(bytes) !== null; // any real text; prose named .csv still counts as csv
    case "txt":
      return sniffText(bytes) !== null;
    default:
      return false;
  }
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
