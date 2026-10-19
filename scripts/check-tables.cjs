const { Client } = require("pg");
require("dotenv").config();

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name
    `);
    console.log("Tables:");
    for (const r of res.rows) console.log(" ", r.table_name);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
