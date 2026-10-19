import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { requireIctAdmin } from "@/lib/require-session";
import { appUserCount } from "@/lib/admin-api-guard";
import {
  isBoardingRole,
  isBoardingStatus,
  isIctVerificationStatus,
  rowToDto,
  type BoardingHouseUserRow,
} from "@/lib/boarding-house-users";

export const dynamic = "force-dynamic";

const RETURNING =
  `id, seq_id, full_name, email, role, status, student_id,
   ict_verification_status, emergency_contact_name, emergency_contact_phone, course,
   created_at, updated_at, last_login_at`;

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
      studentId?: string | null;
      newPassword?: string;
      ictVerificationStatus?: string;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      course?: string | null;
    };
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role ?? "";
    const status = body.status ?? "";
    const studentIdRaw =
      body.studentId === undefined || body.studentId === null
        ? undefined
        : String(body.studentId).trim();
    const studentId =
      studentIdRaw === undefined
        ? undefined
        : studentIdRaw.length > 0
          ? studentIdRaw
          : null;
    const newPassword = (body.newPassword ?? "").trim();

    if (body.ictVerificationStatus !== undefined) {
      if (!isIctVerificationStatus(body.ictVerificationStatus)) {
        return NextResponse.json(
          { error: "Invalid ICT verification status." },
          { status: 400 }
        );
      }
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
    if (newPassword.length > 0 && newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const pool = await getPool();

    const encName =
      body.emergencyContactName !== undefined
        ? (body.emergencyContactName ?? "").trim() || null
        : undefined;
    const encPhone =
      body.emergencyContactPhone !== undefined
        ? (body.emergencyContactPhone ?? "").trim() || null
        : undefined;
    const courseVal =
      body.course !== undefined
        ? (body.course ?? "").trim() || null
        : undefined;

    const parts: string[] = [
      "full_name = $1",
      "email = $2",
      "role = $3",
      "status = $4",
    ];
    const vals: unknown[] = [name, email, role, status];
    let p = 5;

    if (studentId !== undefined) {
      parts.push(`student_id = $${p}`);
      vals.push(studentId);
      p++;
    }
    if (body.ictVerificationStatus !== undefined) {
      parts.push(`ict_verification_status = $${p}`);
      vals.push(body.ictVerificationStatus);
      p++;
    }
    if (encName !== undefined) {
      parts.push(`emergency_contact_name = $${p}`);
      vals.push(encName);
      p++;
    }
    if (encPhone !== undefined) {
      parts.push(`emergency_contact_phone = $${p}`);
      vals.push(encPhone);
      p++;
    }
    if (courseVal !== undefined) {
      parts.push(`course = $${p}`);
      vals.push(courseVal);
      p++;
    }

    if (newPassword.length > 0) {
      const hash = await bcrypt.hash(newPassword, 10);
      parts.push(`password_hash = $${p}`);
      vals.push(hash);
      p++;
    }

    parts.push("updated_at = now()");
    vals.push(id);

    const sql = `UPDATE public.boarding_house_app_users
       SET ${parts.join(", ")}
       WHERE id = $${p}::uuid
       RETURNING ${RETURNING}`;

    const { rows } = await pool.query<BoardingHouseUserRow>(sql, vals);
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ user: rowToDto(row) });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json(
        {
          error:
            "That email or student ID is already in use by another account.",
        },
        { status: 409 }
      );
    }
    const message = e instanceof Error ? e.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
