/**
 * Apply a single .sql file to the database configured by DATABASE_URL.
 * Loads .env then .env.local from the project root (same idea as Next.js).
 *
 * Usage: node scripts/apply-sql-migration.cjs db/migrations/008_dormconnect_features.sql
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const root = path.join(__dirname, "..");

require("dotenv").config({ path: path.join(root, ".env") });
require("dotenv").config({ path: path.join(root, ".env.local") });

const sqlRel = process.argv[2];
if (!sqlRel) {
  console.error("Usage: node scripts/apply-sql-migration.cjs <path-to.sql>");
  process.exit(1);
}

const sqlPath = path.isAbsolute(sqlRel) ? sqlRel : path.join(root, sqlRel);
if (!fs.existsSync(sqlPath)) {
  console.error("File not found:", sqlPath);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add it to .env or .env.local.");
  process.exit(1);
}

function sslOption() {
  if (process.env.DATABASE_SSL === "disable") return undefined;
  const needSsl =
    /supabase\.(co|com)/i.test(databaseUrl) ||
    process.env.DATABASE_SSL === "require";
  return needSsl ? { rejectUnauthorized: false } : undefined;
}

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: sslOption(),
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK:", path.relative(root, sqlPath));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
