const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Prefer browser MIME; fall back to extension when type is missing or generic. */
export function resolveUploadMime(fileName: string, clientMime: string): string {
  const raw = clientMime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (raw && raw !== "application/octet-stream") return raw;

  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return raw || "application/octet-stream";
  const ext = fileName.slice(dot).toLowerCase();
  return EXT_TO_MIME[ext] ?? (raw || "application/octet-stream");
}
