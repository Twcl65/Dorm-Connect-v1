import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const MAX_BYTES = 6 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

/** Saves under public/uploads/dormconnect and returns a site-relative URL path. */
export async function savePublicUpload(
  buffer: Buffer,
  mime: string
): Promise<string> {
  const type = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED.has(type)) {
    throw new Error("Invalid file type. Use JPG, PNG, WebP, GIF, or PDF.");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("File too large (max 6 MB).");
  }
  const ext = EXT[type] ?? ".bin";
  const name = `${randomUUID()}${ext}`;
  const dir = join(process.cwd(), "public", "uploads", "dormconnect");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), buffer);
  return `/uploads/dormconnect/${name}`;
}
