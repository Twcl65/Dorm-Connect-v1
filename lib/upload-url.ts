/** Site-relative path from local disk storage (legacy). */
export function isLocalUploadUrl(url: string): boolean {
  return url.trim().startsWith("/uploads/");
}

/** Public URL from Supabase Storage for this project. */
function resolveSupabaseHost(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit.replace(/\/$/, "")).host;
    } catch {
      return null;
    }
  }
  const db = process.env.DATABASE_URL ?? "";
  const match = db.match(/postgres\.([a-z0-9]+)/i);
  if (match?.[1]) return `${match[1]}.supabase.co`;
  return null;
}

export function isSupabasePublicStorageUrl(url: string): boolean {
  const baseHost = resolveSupabaseHost();
  if (!baseHost) return false;
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.host === baseHost &&
      parsed.pathname.includes("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}

/** URLs persisted in the database and safe to render in the app. */
export function isAllowedStoredFileUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (isLocalUploadUrl(u)) return true;
  if (isSupabasePublicStorageUrl(u)) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function filterAllowedStoredFileUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.filter(
    (x): x is string => typeof x === "string" && isAllowedStoredFileUrl(x)
  );
}
