import { getPool } from "@/lib/db";
import { requireIctAdmin } from "@/lib/require-session";

export async function appUserCount(): Promise<number> {
  const pool = await getPool();
  const { rows } = await pool.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM public.boarding_house_app_users"
  );
  return rows[0]?.c ?? 0;
}

/** When the table is empty, allow unauthenticated access for first ICT admin bootstrap. */
export async function requireIctAdminUnlessBootstrapEmpty(): Promise<
  "bootstrap" | "session" | null
> {
  const n = await appUserCount();
  if (n === 0) return "bootstrap";
  const s = await requireIctAdmin();
  return s ? "session" : null;
}
