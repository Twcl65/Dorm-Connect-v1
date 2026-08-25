"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const relPath = process.argv[2];
  if (!relPath) {
    console.error("Usage: node scripts/apply-sql-migration.cjs <path-to-sql>");
    process.exit(1);
  }

  const sqlPath = path.isAbsolute(relPath)
    ? relPath
    : path.join(process.cwd(), relPath);

  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file not found: ${sqlPath}`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new Client({
    connectionString,
    ssl: /supabase\.(co|com)/i.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log(`Applied: ${path.relative(process.cwd(), sqlPath)}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
