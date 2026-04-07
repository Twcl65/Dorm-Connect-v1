import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureLandlordProperty, landlordLog } from "@/lib/landlord-db";
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

    const { rows } = await pool.query<{
      id: string;
      room_no: string;
      tenant_name: string;
      lease_start: string;
      lease_end: string;
      payment_status: string;
      email: string | null;
      phone: string | null;
      property_name: string;
    }>(
      `SELECT l.id, r.room_no, l.tenant_name,
              l.lease_start::text, l.lease_end::text, l.payment_status,
              l.email, l.phone, p.name AS property_name
       FROM public.landlord_tenant_leases l
       JOIN public.landlord_rooms r ON r.id = l.room_id
       JOIN public.landlord_properties p ON p.id = l.property_id
       WHERE l.owner_user_id = $1::uuid
       ORDER BY r.room_no`,
      [ownerId]
    );

    const formatPeriod = (a: string, b: string) =>
      `${new Date(a).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${new Date(b).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

    let propertyName = rows[0]?.property_name;
    if (!propertyName) {
      const { rows: pn } = await pool.query<{ name: string }>(
        `SELECT name FROM public.landlord_properties WHERE owner_user_id = $1::uuid LIMIT 1`,
        [ownerId]
      );
      propertyName = pn[0]?.name ?? "My property";
    }

    return NextResponse.json({
      propertyName,
      leases: rows.map((r) => ({
        id: r.id,
        roomNo: r.room_no,
        name: r.tenant_name,
        leaseStart: r.lease_start.slice(0, 10),
        leaseEnd: r.lease_end.slice(0, 10),
        leasePeriod: formatPeriod(r.lease_start, r.lease_end),
        paymentStatus: r.payment_status as "Paid" | "Pending" | "Overdue",
        email: r.email ?? undefined,
        contact: r.phone ?? undefined,
      })),
      stats: {
        total: rows.length,
        activeLeases: rows.length,
        paid: rows.filter((x) => x.payment_status === "Paid").length,
        pending: rows.filter((x) => x.payment_status === "Pending").length,
        overdue: rows.filter((x) => x.payment_status === "Overdue").length,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load leases";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const body = (await req.json()) as {
      roomNo?: string;
      tenantName?: string;
      email?: string;
      phone?: string;
      leaseStart?: string;
      leaseEnd?: string;
      paymentStatus?: string;
      remarks?: string;
    };
    const roomNo = (body.roomNo ?? "").trim();
    const tenantName = (body.tenantName ?? "").trim();
    if (!roomNo || !tenantName) {
      return NextResponse.json(
        { error: "Room number and tenant name are required." },
        { status: 400 }
      );
    }
    const leaseStart = body.leaseStart;
    const leaseEnd = body.leaseEnd;
    if (!leaseStart || !leaseEnd) {
      return NextResponse.json(
        { error: "Lease start and end dates are required." },
        { status: 400 }
      );
    }
    const ps =
      body.paymentStatus === "Paid" ||
      body.paymentStatus === "Pending" ||
      body.paymentStatus === "Overdue"
        ? body.paymentStatus
        : "Pending";

    const pool = await getPool();
    const propertyId = await ensureLandlordProperty(pool, ownerId);

    const { rows: rrows } = await pool.query<{ id: string }>(
      `SELECT id FROM public.landlord_rooms
       WHERE owner_user_id = $1::uuid AND property_id = $2::uuid AND room_no = $3`,
      [ownerId, propertyId, roomNo]
    );
    const roomId = rrows[0]?.id;
    if (!roomId) {
      return NextResponse.json(
        { error: `Room ${roomNo} not found. Add the room first.` },
        { status: 404 }
      );
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_tenant_leases
        (owner_user_id, property_id, room_id, tenant_name, email, phone,
         lease_start, lease_end, payment_status, remarks)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::date, $8::date, $9, $10)
       RETURNING id`,
      [
        ownerId,
        propertyId,
        roomId,
        tenantName,
        (body.email ?? "").trim() || null,
        (body.phone ?? "").trim() || null,
        leaseStart,
        leaseEnd,
        ps,
        (body.remarks ?? "").trim() || null,
      ]
    );

    await pool.query(
      `UPDATE public.landlord_rooms SET status = 'Occupied', updated_at = now()
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [roomId, ownerId]
    );

    await landlordLog(pool, ownerId, `Added tenant ${tenantName} to room ${roomNo}`);
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create lease";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
