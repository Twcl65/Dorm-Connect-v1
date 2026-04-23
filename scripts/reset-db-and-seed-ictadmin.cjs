/**
 * Wipe all data from every public table, then seed an ICT Admin account.
 *
 * Usage:
 *   node scripts/reset-db-and-seed-ictadmin.cjs
 *
 * Env:
 *   DATABASE_URL (required)
 *   DATABASE_SSL=disable (optional)
 *
 * Seeds:
 *   email: ictadmin@gmail.com
 *   role: ICT Admin
 *   password: ictadmin
 */
const path = require("path");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const root = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env") });
require("dotenv").config({ path: path.join(root, ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add it to .env or .env.local.");
  process.exit(1);
}

function sslOption() {
  if (process.env.DATABASE_SSL === "disable") return undefined;
  const needSsl =
    /supabase\.(co|com)/i.test(databaseUrl) || process.env.DATABASE_SSL === "require";
  return needSsl ? { rejectUnauthorized: false } : undefined;
}

function quoteIdent(x) {
  return `"${String(x).replace(/"/g, '""')}"`;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl, ssl: sslOption() });
  await client.connect();

  try {
    await client.query("BEGIN");

    const { rows: tableRows } = await client.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`
    );

    const tables = tableRows
      .map((r) => r.tablename)
      .filter((t) => typeof t === "string" && t.length > 0);

    if (tables.length === 0) {
      console.log("No public tables found. Nothing to wipe.");
    } else {
      const truncateTargets = tables
        .map((t) => `${quoteIdent("public")}.${quoteIdent(t)}`)
        .join(", ");
      await client.query(
        `TRUNCATE TABLE ${truncateTargets} RESTART IDENTITY CASCADE;`
      );
      console.log(`Wiped ${tables.length} tables.`);
    }

    const email = "ictadmin@gmail.com";
    const password = "ictadmin";
    const passwordHash = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO public.boarding_house_app_users
        (full_name, email, role, status, password_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      ["ICT Admin", email, "ICT Admin", "Active", passwordHash]
    );

    await client.query("COMMIT");
    console.log("Seeded ICT Admin:", email);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

