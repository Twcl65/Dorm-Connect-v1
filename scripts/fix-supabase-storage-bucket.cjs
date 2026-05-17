/**
 * Updates an existing bucket: public, 10 MB limit, no MIME restrictions.
 * Run if uploads fail with mime-type errors from Supabase Storage.
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
  const { error } = await supabase.storage.updateBucket(bucket, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: null,
  });

  if (error) {
    console.error("Could not update bucket:", error.message);
    console.error(
      "If the bucket does not exist, run: npm run storage:setup"
    );
    process.exit(1);
  }

  console.log(`Updated bucket "${bucket}" (public, 10 MB, all MIME types).`);
})();
