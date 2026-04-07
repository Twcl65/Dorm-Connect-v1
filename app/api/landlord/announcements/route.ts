import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      title: string;
      body: string;
      posted_at: Date;
    }>(
      `SELECT id, title, body, posted_at
       FROM public.student_announcements
       WHERE is_active = true AND audience IN ('Landlords', 'All')
       ORDER BY posted_at DESC`
    );

    return NextResponse.json({
      announcements: rows.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.body,
        date: new Date(r.posted_at).toISOString().slice(0, 10),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
