/**
 * One-time setup: create the public "dormconnect" storage bucket.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "dormconnect";

if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first."
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  const { data: existing } = await supabase.storage.getBucket(bucket);
  if (existing) {
    console.log(`Bucket "${bucket}" already exists.`);
    process.exit(0);
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
  });

  if (error) {
    console.error("Could not create bucket:", error.message);
    process.exit(1);
  }

  console.log(`Created public bucket "${bucket}". Uploads will use cloud URLs.`);
})();
