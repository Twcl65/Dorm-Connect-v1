import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { status?: string };
    if (body.status !== "Cancelled") {
      return NextResponse.json({ error: "Only cancellation is supported." }, { status: 400 });
    }

    const pool = await getPool();
    const { rowCount } = await pool.query(
      `UPDATE public.student_dorm_reservations
       SET status = 'Cancelled', updated_at = now()
       WHERE id = $1::uuid AND student_user_id = $2::uuid
         AND status = 'Pending'`,
      [id, studentId]
    );

    if (!rowCount) {
      return NextResponse.json(
        { error: "Reservation not found or cannot be cancelled." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
