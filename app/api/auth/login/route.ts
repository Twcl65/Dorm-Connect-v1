import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { DB_ROLE_TO_ROUTE, SESSION_COOKIE } from "@/lib/auth-config";
import { signSessionToken } from "@/lib/session-token";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  password_hash: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const pool = await getPool();
    const { rows } = await pool.query<UserRow>(
      `SELECT id, full_name, email, role, status, password_hash
       FROM public.boarding_house_app_users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );
    const user = rows[0];

    const generic = "Invalid email or password.";
    if (!user?.password_hash) {
      return NextResponse.json({ error: generic }, { status: 401 });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ error: generic }, { status: 401 });
    }

    if (user.status !== "Active") {
      return NextResponse.json(
        {
          error:
            "Your account is not active. Only active accounts can sign in. Contact an administrator if you believe this is a mistake.",
        },
        { status: 403 }
      );
    }

    const redirect = DB_ROLE_TO_ROUTE[user.role];
    if (!redirect) {
      return NextResponse.json(
        {
          error:
            "Your account role is not assigned to a dashboard. Contact an administrator.",
        },
        { status: 403 }
      );
    }

    await pool.query(
      `UPDATE public.boarding_house_app_users
       SET last_login_at = now(), updated_at = now()
       WHERE id = $1::uuid`,
      [user.id]
    );

    const token = await signSessionToken({
      sub: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
    });

    const res = NextResponse.json({ ok: true, redirect });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.message.includes("AUTH_SECRET")) {
      return NextResponse.json(
        { error: "Server is not configured for sign-in (AUTH_SECRET)." },
        { status: 500 }
      );
    }
    const message = e instanceof Error ? e.message : "Sign-in failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
