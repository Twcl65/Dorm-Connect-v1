import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

const AUDIENCES = ["Students", "Landlords", "All"] as const;

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      title?: string;
      body?: string;
      audience?: string;
      isActive?: boolean;
    };
    const pool = await getPool();

    const title = body.title != null ? String(body.title).trim() : null;
    const text = body.body != null ? String(body.body).trim() : null;
    const audience = body.audience;
    const isActive = body.isActive;

    if (
      title === null &&
      text === null &&
      audience === undefined &&
      isActive === undefined
    ) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400 }
      );
    }

    if (audience != null && !(AUDIENCES as readonly string[]).includes(audience)) {
      return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
    }

    const isActiveParam = isActive === undefined ? null : isActive;

    await pool.query(
      `UPDATE public.student_announcements
       SET title = COALESCE($2, title),
           body = COALESCE($3, body),
           audience = COALESCE($4, audience),
           is_active = COALESCE($5, is_active)
       WHERE id = $1::uuid`,
      [
        id,
        title && title.length > 0 ? title : null,
        text && text.length > 0 ? text : null,
        audience ?? null,
        isActiveParam,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
