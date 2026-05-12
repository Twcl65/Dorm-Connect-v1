import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";
import { expireAccreditationsIfNeeded } from "@/lib/accreditation-expiry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await requireOsaAdmin())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const pool = await getPool();
    await expireAccreditationsIfNeeded(pool);

    const { rows } = await pool.query<{
      id: string;
      dorm_name: string;
      address: string;
      status: string;
      submitted_at: Date;
      owner_name: string;
      owner_email: string;
      accreditation_expires_at: Date | null;
    }>(
      `SELECT a.id, a.dorm_name, a.address, a.status, a.submitted_at,
              a.accreditation_expires_at,
              u.full_name AS owner_name, u.email AS owner_email
       FROM public.landlord_accreditation_requests a
       JOIN public.boarding_house_app_users u ON u.id = a.owner_user_id
       ORDER BY a.submitted_at DESC`
    );

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        dormName: r.dorm_name,
        address: r.address,
        status: r.status,
        submittedAt: new Date(r.submitted_at).toISOString().slice(0, 10),
        ownerName: r.owner_name,
        ownerEmail: r.owner_email,
        expiresAt: r.accreditation_expires_at
          ? new Date(r.accreditation_expires_at).toISOString().slice(0, 10)
          : null,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
