import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

function parseIntParam(v: string | null, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export async function GET(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  const url = new URL(req.url);
  const page = Math.max(1, parseIntParam(url.searchParams.get("page"), 1));
  const pageSize = Math.min(
    50,
    Math.max(5, parseIntParam(url.searchParams.get("pageSize"), 20))
  );
  const q = (url.searchParams.get("q") ?? "").trim();
  const offset = (page - 1) * pageSize;

  try {
    const pool = await getPool();
    const whereQ = q ? ` AND description ILIKE $2` : "";
    const params = q
      ? ([ownerId, `%${q}%`, pageSize, offset] as const)
      : ([ownerId, pageSize, offset] as const);

    const countRes = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM public.landlord_activity_log
       WHERE owner_user_id = $1::uuid${whereQ}`,
      q ? [ownerId, `%${q}%`] : [ownerId]
    );

    const listSql = q
      ? `SELECT id, description, created_at
         FROM public.landlord_activity_log
         WHERE owner_user_id = $1::uuid${whereQ}
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`
      : `SELECT id, description, created_at
         FROM public.landlord_activity_log
         WHERE owner_user_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`;

    const { rows } = await pool.query<{
      id: string;
      description: string;
      created_at: Date;
    }>(listSql, params as unknown as unknown[]);

    return NextResponse.json({
      page,
      pageSize,
      total: Number(countRes.rows[0]?.c ?? 0),
      logs: rows.map((r) => ({
        id: r.id,
        description: r.description,
        createdAt: r.created_at.toISOString(),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load logs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

