import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { displayedIctVerificationStatus } from "@/lib/boarding-house-users";
import { getSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let profileImageUrl: string | null = null;
  let ictVerificationStatus: string | null = null;
  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      role: string;
      status: string;
      profile_image_url: string | null;
      ict_verification_status: string | null;
    }>(
      `SELECT role, status, profile_image_url, ict_verification_status
       FROM public.boarding_house_app_users WHERE id = $1::uuid`,
      [session.sub]
    );
    const u = rows[0]?.profile_image_url?.trim();
    profileImageUrl = u || null;
    ictVerificationStatus = rows[0]
      ? displayedIctVerificationStatus(
          rows[0].role,
          rows[0].status,
          rows[0].ict_verification_status
        )
      : null;
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
      ictVerificationStatus,
    },
  });
}
