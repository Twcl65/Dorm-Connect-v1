import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { resolveUploadMime } from "@/lib/resolve-upload-mime";
import {
  isCloudUploadConfigured,
  uploadToSupabaseStorage,
} from "@/lib/supabase-storage";

export const ALLOWED_UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const ALLOWED_UPLOAD_LABEL =
  "JPG, PNG, WebP, GIF, PDF, or Word (.doc, .docx)";

const MAX_BYTES = 10 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

function validateUpload(buffer: Buffer, mime: string): string {
  const type = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_UPLOAD_MIMES.has(type)) {
    throw new Error(`Invalid file type. Use ${ALLOWED_UPLOAD_LABEL}.`);
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("File too large (max 10 MB).");
  }
  return type;
}

async function saveLocalUpload(buffer: Buffer, mime: string): Promise<string> {
  const type = validateUpload(buffer, mime);
  const ext = EXT[type] ?? ".bin";
  const name = `${randomUUID()}${ext}`;
  const dir = join(process.cwd(), "public", "uploads", "dormconnect");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), buffer);
  return `/uploads/dormconnect/${name}`;
}

/**
 * Stores a file in Supabase Storage when configured (shared across devices),
 * otherwise falls back to public/uploads on this server.
 */
export async function savePublicUpload(
  buffer: Buffer,
  mime: string,
  fileName = ""
): Promise<string> {
  const resolved = resolveUploadMime(fileName, mime);
  const type = validateUpload(buffer, resolved);
  const ext = EXT[type] ?? ".bin";
  const name = `${randomUUID()}${ext}`;

  if (isCloudUploadConfigured()) {
    return uploadToSupabaseStorage(buffer, type, name);
  }

  return saveLocalUpload(buffer, resolved);
}
