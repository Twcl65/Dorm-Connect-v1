import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  ensureLandlordProperty,
  resolveDormDisplayName,
} from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";
import { buildDocxReport } from "../_docx";

export const dynamic = "force-dynamic";

function formatPeriod(a: string, b: string) {
  // SQL returns YYYY-MM-DD text for dates; parse safely.
  const aa = new Date(`${a}T00:00:00`);
  const bb = new Date(`${b}T00:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${fmt(aa)} - ${fmt(bb)}`;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    const propertyId = await ensureLandlordProperty(pool, ownerId);

    const { rows: prop } = await pool.query<{
      name: string;
      acc_dorm_name: string | null;
    }>(
      `SELECT p.name,
              (SELECT a.dorm_name FROM public.landlord_accreditation_requests a
               WHERE (a.property_id = p.id OR a.owner_user_id = p.owner_user_id)
                 AND trim(a.dorm_name) <> ''
               ORDER BY a.submitted_at DESC
               LIMIT 1) AS acc_dorm_name
       FROM public.landlord_properties p
       WHERE p.id = $1::uuid
       ORDER BY p.created_at ASC
       LIMIT 1`,
      [propertyId]
    );

    const propertyName = resolveDormDisplayName(
      prop[0]?.name ?? null,
      prop[0]?.acc_dorm_name ?? null
    );

    const { rows } = await pool.query<{
      room_no: string;
      capacity: number;
      monthly_rate: string;
      status: string;
      remarks: string | null;
      is_listed: boolean;
      listing_location: string | null;
      listing_description: string | null;
      room_size_label: string | null;
      room_details: string | null;
      tenant_name: string | null;
      lease_start: string | null;
      lease_end: string | null;
      payment_status: string | null;
    }>(
      `SELECT r.room_no, r.capacity, r.monthly_rate::text AS monthly_rate,
              r.status, r.remarks,
              r.is_listed,
              r.listing_location, r.listing_description,
              r.room_size_label, r.room_details,
              l.tenant_name,
              l.lease_start::text AS lease_start,
              l.lease_end::text AS lease_end,
              l.payment_status
       FROM public.landlord_rooms r
       LEFT JOIN public.landlord_tenant_leases l
         ON l.room_id = r.id AND l.owner_user_id = r.owner_user_id
       WHERE r.owner_user_id = $1::uuid
       ORDER BY r.room_no`,
      [ownerId]
    );

    const data = rows.map((r) => ({
      roomNo: r.room_no,
      capacity: r.capacity,
      rate: Number(r.monthly_rate) || 0,
      roomStatus: r.status,
      isListed: r.is_listed ? "Yes" : "No",
      listingLocation: r.listing_location ?? "",
      listingDescription: r.listing_description ?? "",
      roomSizeLabel: r.room_size_label ?? "",
      roomDetails: r.room_details ?? "",
      remarks: r.remarks ?? "",
      tenantName: r.tenant_name ?? "",
      leaseStart: r.lease_start ?? "",
      leaseEnd: r.lease_end ?? "",
      leasePeriod:
        r.lease_start && r.lease_end ? formatPeriod(r.lease_start, r.lease_end) : "",
      paymentStatus: r.payment_status ?? "",
    }));

    const buf = await buildDocxReport({
      title: "Room Information Report",
      subtitle:
        "Room status, tenant assignment (when available), and room/listing details.",
      columns: [
        { key: "roomNo", label: "Room No." },
        { key: "capacity", label: "Capacity" },
        { key: "rate", label: "Rate (₱/month)" },
        { key: "roomStatus", label: "Room Status" },
        { key: "isListed", label: "Listed" },
        { key: "tenantName", label: "Tenant Name" },
        { key: "leasePeriod", label: "Lease Period" },
        { key: "paymentStatus", label: "Payment Status" },
        { key: "roomSizeLabel", label: "Room Size" },
        { key: "listingLocation", label: "Listing Location" },
        { key: "roomDetails", label: "Room Details" },
      ],
      rows: data,
    });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="rooms-report.docx"`,
        "X-DormConnect-Property": propertyName,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to export rooms report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

