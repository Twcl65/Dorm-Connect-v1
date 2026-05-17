import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "dormconnect";

let adminClient: SupabaseClient | null = null;

function resolveSupabaseUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const db = process.env.DATABASE_URL ?? "";
  const match = db.match(/postgres\.([a-z0-9]+)/i);
  if (match?.[1]) return `https://${match[1]}.supabase.co`;
  return null;
}

function getSupabaseAdmin(): SupabaseClient | null {
  const url = resolveSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function isCloudUploadConfigured(): boolean {
  return getSupabaseAdmin() !== null;
}

/** Upload bytes to Supabase Storage; returns a public HTTPS URL. */
export async function uploadToSupabaseStorage(
  buffer: Buffer,
  mime: string,
  objectName: string
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Cloud storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const path = `dormconnect/${objectName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    if (/bucket.*not found/i.test(error.message)) {
      throw new Error(
        `Storage bucket "${BUCKET}" was not found. Create a public bucket with that name in Supabase → Storage.`
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
