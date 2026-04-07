import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      dorm_name: string;
      address: string;
      status: string;
      submitted_at: Date;
      documents_count: number;
      owner_name: string;
      owner_email: string;
      property_name: string | null;
      operational_status: string | null;
      compliance_status: string | null;
    }>(
      `SELECT a.id, a.dorm_name, a.address, a.status, a.submitted_at, a.documents_count,
              u.full_name AS owner_name, u.email AS owner_email,
              p.name AS property_name,
              p.operational_status, p.compliance_status
       FROM public.landlord_accreditation_requests a
       JOIN public.boarding_house_app_users u ON u.id = a.owner_user_id
       LEFT JOIN public.landlord_properties p ON p.id = a.property_id
       ORDER BY a.submitted_at DESC`
    );

    const requests = rows
      .filter((r) => r.status !== "Approved")
      .map((r) => ({
        id: r.id,
        dormName: r.dorm_name,
        owner: r.owner_name,
        ownerEmail: r.owner_email,
        address: r.address,
        propertyName: r.property_name,
        dateSubmitted: formatDate(new Date(r.submitted_at)),
        status: r.status,
        documentsCount: r.documents_count,
      }));

    const accredited = rows
      .filter((r) => r.status === "Approved")
      .map((r) => {
        const start = new Date(r.submitted_at);
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);
        const validityPeriod = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        const now = Date.now();
        const msLeft = end.getTime() - now;
        const op = r.operational_status ?? "Operating";
        let status: "Active" | "Expiring" | "Not Operating" = "Active";
        if (op === "Not Operating") {
          status = "Not Operating";
        } else if (msLeft > 0 && msLeft < 30 * 24 * 60 * 60 * 1000) {
          status = "Expiring";
        }
        const compliance =
          (r.compliance_status as "Compliant" | "Warning" | "Non-Compliant") ||
          "Compliant";
        return {
          id: r.id,
          dormName: r.dorm_name,
          owner: r.owner_name,
          status,
          validityPeriod,
          compliance,
        };
      });

    return NextResponse.json({ requests, accredited });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
