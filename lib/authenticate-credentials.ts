import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { DB_ROLE_TO_ROUTE } from "@/lib/auth-config";
import { signSessionToken } from "@/lib/session-token";

export type AuthUserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  password_hash: string | null;
};

export type AuthenticateSuccess = {
  ok: true;
  user: AuthUserRow;
  token: string;
  redirect: string;
};

export type AuthenticateFailure = {
  ok: false;
  error: string;
  status: number;
};

export async function authenticateWithEmailPassword(
  email: string,
  password: string
): Promise<AuthenticateSuccess | AuthenticateFailure> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, error: "Invalid request.", status: 400 };
  }

  const pool = await getPool();
  const { rows } = await pool.query<AuthUserRow>(
    `SELECT id, full_name, email, role, status, password_hash
     FROM public.boarding_house_app_users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [normalizedEmail]
  );
  const user = rows[0];

  const generic = "Invalid email or password.";
  if (!user?.password_hash) {
    return { ok: false, error: generic, status: 401 };
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    return { ok: false, error: generic, status: 401 };
  }

  if (user.status !== "Active") {
    return {
      ok: false,
      error:
        "Your account is not active. Only active accounts can sign in. Contact an administrator if you believe this is a mistake.",
      status: 403,
    };
  }

  const redirect = DB_ROLE_TO_ROUTE[user.role];
  if (!redirect) {
    return {
      ok: false,
      error:
        "Your account role is not assigned to a dashboard. Contact an administrator.",
      status: 403,
    };
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

  return { ok: true, user, token, redirect };
}
