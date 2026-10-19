import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { authenticateWithEmailPassword } from "@/lib/authenticate-credentials";
import { getCorsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

/** Mobile sign-in: unified app — Student and Landlord roles (optional role filter). */
export async function POST(req: Request) {
  const cors = getCorsHeaders();

  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      role?: string;
    };

    const result = await authenticateWithEmailPassword(
      body.email ?? "",
      body.password ?? ""
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status, headers: cors }
      );
    }

    const mobileRoles = ["Student", "Landlord"];
    const expectedRole = (body.role ?? "").trim();

    if (expectedRole) {
      if (result.user.role !== expectedRole) {
        return NextResponse.json(
          {
            error: `This account is not a ${expectedRole} account.`,
          },
          { status: 403, headers: cors }
        );
      }
    } else if (!mobileRoles.includes(result.user.role)) {
      return NextResponse.json(
        {
          error:
            "This account type cannot use the mobile app. Sign in on the website for admin accounts.",
        },
        { status: 403, headers: cors }
      );
    }

    let profileImageUrl: string | null = null;
    let ictVerificationStatus: string | null = null;
    try {
      const pool = await getPool();
      const { rows } = await pool.query<{
        profile_image_url: string | null;
        ict_verification_status: string | null;
      }>(
        `SELECT profile_image_url, ict_verification_status
         FROM public.boarding_house_app_users WHERE id = $1::uuid`,
        [result.user.id]
      );
      profileImageUrl = rows[0]?.profile_image_url?.trim() || null;
      ictVerificationStatus =
        rows[0]?.ict_verification_status?.trim() || null;
    } catch {
      /* non-fatal */
    }

    return NextResponse.json(
      {
        ok: true,
        accessToken: result.token,
        user: {
          id: result.user.id,
          name: result.user.full_name,
          email: result.user.email,
          role: result.user.role,
          profileImageUrl,
          ictVerificationStatus,
        },
      },
      { headers: cors }
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("AUTH_SECRET")) {
      return NextResponse.json(
        { error: "Server is not configured for sign-in (AUTH_SECRET)." },
        { status: 500, headers: cors }
      );
    }
    const message = e instanceof Error ? e.message : "Sign-in failed.";
    return NextResponse.json({ error: message }, { status: 500, headers: cors });
  }
}
