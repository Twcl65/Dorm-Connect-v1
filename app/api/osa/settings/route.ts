import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

const TABLE = "public.osa_signatory_config";

type SignatoryConfig = {
  id: number;
  signatory_name: string;
  signatory_title: string;
  campus: string;
  campus_director_name: string;
  created_at: Date;
  updated_at: Date;
};

const DEFAULTS = {
  signatory_name: "OSA Authorized Representative",
  signatory_title: "Office of Student Affairs",
  campus: "USTP Jasaan Campus",
  campus_director_name: "Campus Director",
};

/** Ensure the table exists; the migration may not have been applied yet. */
async function ensureTable(
  pool: Awaited<ReturnType<typeof getPool>>
): Promise<void> {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (\n` +
        `  id SERIAL PRIMARY KEY,\n` +
        `  signatory_name TEXT NOT NULL DEFAULT 'OSA Authorized Representative',\n` +
        `  signatory_title TEXT NOT NULL DEFAULT 'Office of Student Affairs',\n` +
        `  campus TEXT NOT NULL DEFAULT 'USTP Jasaan Campus',\n` +
        `  campus_director_name TEXT NOT NULL DEFAULT 'Campus Director',\n` +
        `  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n` +
        `  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n` +
        `)`
    );

    // Add columns that may be missing on an existing table (column-level migration).
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'osa_signatory_config'
            AND column_name = 'campus_director_name'
        ) THEN
          ALTER TABLE ${TABLE}
            ADD COLUMN campus_director_name TEXT NOT NULL DEFAULT 'Campus Director';
        END IF;
      END $$;
    `);

    // Seed a default row if the table is empty.
    const check = await pool.query(`SELECT 1 FROM ${TABLE} LIMIT 1`);
    if (check.rowCount === 0) {
      await pool.query(
        `INSERT INTO ${TABLE} (signatory_name, signatory_title, campus, campus_director_name)
         VALUES ($1, $2, $3, $4)`,
        [DEFAULTS.signatory_name, DEFAULTS.signatory_title, DEFAULTS.campus, DEFAULTS.campus_director_name]
      );
    }
  } catch {
    // If we can't create the table or columns, silently continue.
  }
}

async function getConfig(
  pool: Awaited<ReturnType<typeof getPool>>
) {
  try {
    const { rows } = await pool.query<SignatoryConfig>(
      `SELECT id, signatory_name, signatory_title, campus, campus_director_name, created_at, updated_at
       FROM ${TABLE}
       ORDER BY id DESC
       LIMIT 1`
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const pool = await getPool();
  await ensureTable(pool);
  const config = await getConfig(pool);
  if (!config) {
    return NextResponse.json({ config: DEFAULTS });
  }
  return NextResponse.json({
    config: {
      signatory_name: config.signatory_name,
      signatory_title: config.signatory_title,
      campus: config.campus,
      campus_director_name: config.campus_director_name,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const pool = await getPool();
  await ensureTable(pool);
  let existing = await getConfig(pool);
  if (!existing) {
    // Insert a default row first so PATCH has something to update.
    await pool.query(
      `INSERT INTO ${TABLE} (signatory_name, signatory_title, campus, campus_director_name)
       VALUES ($1, $2, $3, $4)`,
      [DEFAULTS.signatory_name, DEFAULTS.signatory_title, DEFAULTS.campus, DEFAULTS.campus_director_name]
    );
    existing = await getConfig(pool);
  }
  if (!existing) {
    return NextResponse.json({ error: "Config not found." }, { status: 404 });
  }

  const body = (await req.json()) as {
    signatory_name?: string;
    signatory_title?: string;
    campus?: string;
    campus_director_name?: string;
  };

  const { signatory_name, signatory_title, campus, campus_director_name } = body;

  if (
    signatory_name === undefined &&
    signatory_title === undefined &&
    campus === undefined &&
    campus_director_name === undefined
  ) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (signatory_name !== undefined) {
    updates.push(`signatory_name = $${paramIdx++}`);
    values.push(signatory_name);
  }
  if (signatory_title !== undefined) {
    updates.push(`signatory_title = $${paramIdx++}`);
    values.push(signatory_title);
  }
  if (campus !== undefined) {
    updates.push(`campus = $${paramIdx++}`);
    values.push(campus);
  }
  if (campus_director_name !== undefined) {
    updates.push(`campus_director_name = $${paramIdx++}`);
    values.push(campus_director_name);
  }

  updates.push(`updated_at = now()`);
  values.push(existing.id);

  const result = await pool.query(
    `UPDATE public.osa_signatory_config
     SET ${updates.join(", ")}
     WHERE id = $${paramIdx}
     RETURNING id`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Config was not updated." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
