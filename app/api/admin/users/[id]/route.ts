import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireIctAdmin } from "@/lib/require-session";
import { appUserCount } from "@/lib/admin-api-guard";
import {
  isBoardingRole,
  isBoardingStatus,
  rowToDto,
  type BoardingHouseUserRow,
} from "@/lib/boarding-house-users";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const n = await appUserCount();
    if (n === 0) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await requireIctAdmin())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { id } = context.params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const body = (await req.json()) as {
      name?: string;
      email?: string;
      role?: string;
      status?: string;
    };
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role ?? "";
    const status = body.status ?? "";

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }
    if (!isBoardingRole(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    if (!isBoardingStatus(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const pool = await getPool();
    const { rows } = await pool.query<BoardingHouseUserRow>(
      `UPDATE public.boarding_house_app_users
       SET full_name = $1, email = $2, role = $3, status = $4, updated_at = now()
       WHERE id = $5::uuid
       RETURNING id, seq_id, full_name, email, role, status, created_at, updated_at, last_login_at`,
      [name, email, role, status, id]
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ user: rowToDto(row) });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      );
    }
    const message = e instanceof Error ? e.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
