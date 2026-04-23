import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let profileImageUrl: string | null = null;
  try {
    const pool = await getPool();
    const { rows } = await pool.query<{ profile_image_url: string | null }>(
      `SELECT profile_image_url FROM public.boarding_house_app_users WHERE id = $1::uuid`,
      [session.sub]
    );
    const u = rows[0]?.profile_image_url?.trim();
    profileImageUrl = u || null;
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    user: {
      id: session.sub,
      name: session.name,
      email: session.email,
      role: session.role,
      profileImageUrl,
    },
  });
}
