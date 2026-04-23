import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { requireIctAdminUnlessBootstrapEmpty } from "@/lib/admin-api-guard";
import {
  isBoardingRole,
  isBoardingStatus,
  rowToDto,
  type BoardingHouseUserRow,
} from "@/lib/boarding-house-users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await requireIctAdminUnlessBootstrapEmpty())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const pool = await getPool();
    const { rows } = await pool.query<BoardingHouseUserRow>(
      `SELECT id, seq_id, full_name, email, role, status, student_id, created_at, updated_at, last_login_at
       FROM public.boarding_house_app_users
       ORDER BY seq_id ASC`
    );
    return NextResponse.json({ users: rows.map(rowToDto) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireIctAdminUnlessBootstrapEmpty();
    if (!gate) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      role?: string;
      status?: string;
      temporaryPassword?: string;
      studentId?: string | null;
    };
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role ?? "";
    const status = body.status ?? "Active";
    const temporaryPassword = (body.temporaryPassword ?? "").trim();
    const studentIdRaw = (body.studentId ?? "").trim();
    const studentId = studentIdRaw.length > 0 ? studentIdRaw : null;

    if (gate === "bootstrap" && role !== "ICT Admin") {
      return NextResponse.json(
        { error: "The first user in the system must be ICT Admin." },
        { status: 400 }
      );
    }

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
    if (temporaryPassword.length < 8) {
      return NextResponse.json(
        { error: "Temporary password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const password_hash = await bcrypt.hash(temporaryPassword, 10);
    const pool = await getPool();
    const { rows } = await pool.query<BoardingHouseUserRow>(
      `INSERT INTO public.boarding_house_app_users
        (full_name, email, role, status, password_hash, student_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, seq_id, full_name, email, role, status, student_id, created_at, updated_at, last_login_at`,
      [name, email, role, status, password_hash, studentId]
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "User was not created." },
        { status: 500 }
      );
    }
    return NextResponse.json({ user: rowToDto(row) }, { status: 201 });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json(
        {
          error:
            "A user with this email or student ID already exists.",
        },
        { status: 409 }
      );
    }
    const message = e instanceof Error ? e.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
