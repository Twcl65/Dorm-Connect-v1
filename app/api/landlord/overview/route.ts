import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureLandlordProperty } from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    await ensureLandlordProperty(pool, ownerId);

    const [{ rows: propRows }, { rows: roomStats }, { rows: resStats }, { rows: payMonth }, { rows: accStats }, { rows: activities }, { rows: roomsPreview }, { rows: tenantsPreview }] =
      await Promise.all([
        pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM public.landlord_properties WHERE owner_user_id = $1::uuid`,
          [ownerId]
        ),
        pool.query<{
          total: string;
          occupied: string;
          available: string;
          maintenance: string;
        }>(
          `SELECT
             COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE status = 'Occupied')::text AS occupied,
             COUNT(*) FILTER (WHERE status = 'Available')::text AS available,
             COUNT(*) FILTER (WHERE status = 'Maintenance')::text AS maintenance
           FROM public.landlord_rooms WHERE owner_user_id = $1::uuid`,
          [ownerId]
        ),
        pool.query<{
          total: string;
          confirmed: string;
          pending: string;
          cancelled: string;
        }>(
          `SELECT
             COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE status = 'Confirmed')::text AS confirmed,
             COUNT(*) FILTER (WHERE status = 'Pending')::text AS pending,
             COUNT(*) FILTER (WHERE status = 'Cancelled')::text AS cancelled
           FROM public.landlord_reservations WHERE owner_user_id = $1::uuid`,
          [ownerId]
        ),
        pool.query<{ s: string | null }>(
          `SELECT COALESCE(SUM(amount), 0)::text AS s
           FROM public.landlord_payments
           WHERE owner_user_id = $1::uuid AND status = 'Paid'
             AND paid_on IS NOT NULL
             AND date_trunc('month', paid_on AT TIME ZONE 'UTC') = date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC')`,
          [ownerId]
        ),
        pool.query<{
          approved: string;
          pending: string;
        }>(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'Approved')::text AS approved,
             COUNT(*) FILTER (WHERE status IN (
               'Pending',
               'Scheduled for Inspection',
               'Recommended for Approval',
               'Hold'
             ))::text AS pending
           FROM public.landlord_accreditation_requests WHERE owner_user_id = $1::uuid`,
          [ownerId]
        ),
        pool.query<{ description: string; created_at: Date }>(
          `SELECT description, created_at FROM public.landlord_activity_log
           WHERE owner_user_id = $1::uuid ORDER BY created_at DESC LIMIT 12`,
          [ownerId]
        ),
        pool.query<{
          id: string;
          room_no: string;
          capacity: number;
          monthly_rate: string;
          status: string;
        }>(
          `SELECT id, room_no, capacity, monthly_rate::text, status
           FROM public.landlord_rooms
           WHERE owner_user_id = $1::uuid
           ORDER BY room_no LIMIT 8`,
          [ownerId]
        ),
        pool.query<{
          id: string;
          room_no: string;
          tenant_name: string;
          lease_start: string;
          lease_end: string;
          payment_status: string;
        }>(
          `SELECT l.id, r.room_no, l.tenant_name,
                  l.lease_start::text, l.lease_end::text, l.payment_status
           FROM public.landlord_tenant_leases l
           JOIN public.landlord_rooms r ON r.id = l.room_id
           WHERE l.owner_user_id = $1::uuid
           ORDER BY l.updated_at DESC LIMIT 6`,
          [ownerId]
        ),
      ]);

    const formatPhp = (n: number) =>
      `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

    return NextResponse.json({
      propertiesCount: Number(propRows[0]?.c ?? 0),
      rooms: {
        total: Number(roomStats[0]?.total ?? 0),
        occupied: Number(roomStats[0]?.occupied ?? 0),
        available: Number(roomStats[0]?.available ?? 0),
        maintenance: Number(roomStats[0]?.maintenance ?? 0),
      },
      reservations: {
        total: Number(resStats[0]?.total ?? 0),
        confirmed: Number(resStats[0]?.confirmed ?? 0),
        pending: Number(resStats[0]?.pending ?? 0),
        cancelled: Number(resStats[0]?.cancelled ?? 0),
      },
      paymentsThisMonth: formatPhp(Number(payMonth[0]?.s ?? 0)),
      accreditation: {
        approved: Number(accStats[0]?.approved ?? 0),
        pending: Number(accStats[0]?.pending ?? 0),
      },
      activities: activities.map((a) => ({
        description: a.description,
        time: new Date(a.created_at).toLocaleString(),
      })),
      roomsPreview: roomsPreview.map((r) => ({
        id: r.id,
        roomNo: r.room_no,
        capacity: r.capacity,
        rate: formatPhp(Number(r.monthly_rate)),
        status: r.status,
      })),
      tenantsPreview: tenantsPreview.map((t) => ({
        id: t.id,
        roomNo: t.room_no,
        name: t.tenant_name,
        leasePeriod: `${new Date(t.lease_start).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${new Date(t.lease_end).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
        paymentStatus:
          t.payment_status === "Paid"
            ? "Up to Date"
            : t.payment_status === "Overdue"
              ? "Overdue"
              : "Pending",
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load overview";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
