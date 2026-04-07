import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

const AUDIENCES = ["Students", "Landlords", "All"] as const;

export async function GET() {
  const session = await requireOsaAdmin();
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
      is_active: boolean;
      audience: string;
    }>(
      `SELECT id, title, body, posted_at, is_active, audience
       FROM public.student_announcements
       ORDER BY posted_at DESC`
    );

    const now = Date.now();
    const list = rows.map((r) => {
      const posted = new Date(r.posted_at).getTime();
      let status: "Posted" | "Not Yet Posted" = r.is_active
        ? "Posted"
        : "Not Yet Posted";
      if (r.is_active && posted > now + 60_000) {
        status = "Not Yet Posted";
      }
      return {
        id: r.id,
        date: new Date(r.posted_at).toISOString().slice(0, 10),
        title: r.title,
        audience: r.audience,
        status,
        isActive: r.is_active,
        body: r.body,
      };
    });

    const total = list.length;
    const current = list.filter((x) => x.status === "Posted").length;
    const scheduled = list.filter((x) => x.status === "Not Yet Posted").length;
    const expired = 0;

    return NextResponse.json({
      announcements: list,
      summary: { total, current, scheduled, expired },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      title?: string;
      body?: string;
      audience?: string;
      isActive?: boolean;
    };
    const title = (body.title ?? "").trim();
    const text = (body.body ?? "").trim();
    const audience = body.audience ?? "Students";
    if (!title || !text) {
      return NextResponse.json(
        { error: "Title and body are required." },
        { status: 400 }
      );
    }
    if (!(AUDIENCES as readonly string[]).includes(audience)) {
      return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
    }
    const isActive = body.isActive !== false;

    const pool = await getPool();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.student_announcements
        (title, body, posted_at, is_active, audience, created_by_user_id)
       VALUES ($1, $2, now(), $3, $4, $5::uuid)
       RETURNING id`,
      [title, text, isActive, audience, session.sub]
    );

    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
