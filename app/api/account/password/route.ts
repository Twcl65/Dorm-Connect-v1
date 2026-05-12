import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set([
  "Student",
  "Landlord",
  "ICT Admin",
  "OSA/SAS Admin",
]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password is too long." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    const { rows } = await pool.query<{ password_hash: string | null }>(
      `SELECT password_hash FROM public.boarding_house_app_users WHERE id = $1::uuid`,
      [session.sub]
    );
    const hash = rows[0]?.password_hash;
    if (!hash) {
      return NextResponse.json(
        { error: "Password sign-in is not set for this account." },
        { status: 400 }
      );
    }

    const ok = await bcrypt.compare(currentPassword, hash);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE public.boarding_house_app_users
       SET password_hash = $1, updated_at = now()
       WHERE id = $2::uuid`,
      [newHash, session.sub]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to change password";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
