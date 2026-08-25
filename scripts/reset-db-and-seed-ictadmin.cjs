"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MIGRATION_DIR = path.join(__dirname, "..", "db", "migrations");

const SEED_USERS = [
  {
    email: "ictadmin@gmail.com",
    fullName: "ICT Admin",
    role: "ICT Admin",
    password: "ictadmin",
  },
  {
    email: "osaadmin@gmail.com",
    fullName: "OSA/SAS Admin",
    role: "OSA/SAS Admin",
    password: "osaadmin",
  },
  {
    email: "ustpdorm@gmail.com",
    fullName: "USTP Dorm",
    role: "Landlord",
    password: "ustpdorm",
  },
  {
    email: "ustpstudent@gmail.com",
    fullName: "USTP Student",
    role: "Student",
    password: "ustptudent",
    studentId: "2024-00001",
    ictVerificationStatus: "Verified",
  },
];

const TRUNCATE_TABLES = [
  "public.push_tokens",
  "public.app_notifications",
  "public.os_accredit_inspections",
  "public.payment_due_dates",
  "public.dorm_incident_reports",
  "public.student_dorm_reviews",
  "public.student_payment_records",
  "public.student_dorm_reservations",
  "public.student_announcements",
  "public.landlord_tenant_announcements",
  "public.landlord_activity_log",
  "public.landlord_payments",
  "public.landlord_reservations",
  "public.landlord_tenant_leases",
  "public.landlord_accreditation_requests",
  "public.landlord_rooms",
  "public.landlord_properties",
  "public.boarding_house_app_users",
];

function migrationFiles() {
  return fs
    .readdirSync(MIGRATION_DIR)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function applyMigration(relPath) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "apply-sql-migration.cjs"), relPath],
    {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      env: process.env,
    }
  );
  if (result.status !== 0) {
    throw new Error(`Failed migration: ${relPath}`);
  }
}

async function truncateData(client) {
  const existing = [];
  for (const table of TRUNCATE_TABLES) {
    const { rows } = await client.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [table]
    );
    if (rows[0]?.exists) existing.push(table);
  }

  if (existing.length === 0) return;

  await client.query(
    `TRUNCATE TABLE ${existing.join(", ")} RESTART IDENTITY CASCADE`
  );
}

async function seedUsers(client) {
  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const ictStatus =
      user.role === "Student"
        ? user.ictVerificationStatus ?? "Verified"
        : "Verified";

    await client.query(
      `INSERT INTO public.boarding_house_app_users
        (full_name, email, role, status, password_hash, student_id, ict_verification_status)
       VALUES ($1, $2, $3, 'Active', $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         status = EXCLUDED.status,
         password_hash = EXCLUDED.password_hash,
         student_id = EXCLUDED.student_id,
         ict_verification_status = EXCLUDED.ict_verification_status,
         updated_at = now()`,
      [
        user.fullName,
        user.email.toLowerCase(),
        user.role,
        passwordHash,
        user.studentId ?? null,
        ictStatus,
      ]
    );
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log("Applying migrations…");
  for (const file of migrationFiles()) {
    applyMigration(path.join("db", "migrations", file));
  }

  const client = new Client({
    connectionString,
    ssl: /supabase\.(co|com)/i.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();
    console.log("Clearing application data…");
    await truncateData(client);

    console.log("Seeding default users…");
    await seedUsers(client);

    const { rows } = await client.query(
      `SELECT email, role, status
       FROM public.boarding_house_app_users
       ORDER BY seq_id ASC`
    );

    console.log("\nSeeded users:");
    for (const row of rows) {
      const seed = SEED_USERS.find(
        (u) => u.email.toLowerCase() === row.email.toLowerCase()
      );
      const password = seed?.password ?? "(unchanged)";
      console.log(`  ${row.email}  [${row.role}]  password: ${password}`);
    }
    console.log("\nDatabase reset complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
