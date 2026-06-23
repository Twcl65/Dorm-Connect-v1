import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { formatLeasePeriod, resolveRoomListingStatus } from "@/lib/landlord-db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const propertyId = new URL(req.url).searchParams.get("propertyId")?.trim() ?? "";
  if (!propertyId || !/^[0-9a-f-]{36}$/i.test(propertyId)) {
    return NextResponse.json({ error: "Valid propertyId is required." }, { status: 400 });
  }

  try {
    const pool = await getPool();

    const { rows: propRows } = await pool.query<{
      id: string;
      name: string;
      owner_name: string;
      address: string | null;
      city: string | null;
    }>(
      `SELECT p.id, p.name, u.full_name AS owner_name, p.address, p.city
       FROM public.landlord_properties p
       JOIN public.boarding_house_app_users u ON u.id = p.owner_user_id
       WHERE p.id = $1::uuid
         AND EXISTS (
           SELECT 1 FROM public.landlord_accreditation_requests a
           WHERE a.property_id = p.id AND a.status = 'Approved'
         )`,
      [propertyId]
    );
    const property = propRows[0];
    if (!property) {
      return NextResponse.json({ error: "Accredited dorm not found." }, { status: 404 });
    }

    const { rows: rooms } = await pool.query<{
      id: string;
      room_no: string;
      capacity: number;
      monthly_rate: string;
      status: string;
    }>(
      `SELECT id, room_no, capacity, monthly_rate::text, status
       FROM public.landlord_rooms
       WHERE property_id = $1::uuid
       ORDER BY room_no`,
      [propertyId]
    );

    const { rows: leases } = await pool.query<{
      id: string;
      room_id: string;
      tenant_name: string;
      email: string | null;
      lease_start: Date;
      lease_end: Date;
    }>(
      `SELECT l.id, l.room_id, l.tenant_name, l.email, l.lease_start, l.lease_end
       FROM public.landlord_tenant_leases l
       WHERE l.property_id = $1::uuid`,
      [propertyId]
    );

    const { rows: studentRes } = await pool.query<{
      id: string;
      room_id: string;
      guest_name: string;
      status: string;
      lease_start: Date;
      lease_end: Date;
      student_user_id: string;
      full_name: string | null;
      email: string | null;
      school_id: string | null;
      course: string | null;
    }>(
      `SELECT DISTINCT ON (s.room_id)
              s.id, s.room_id, s.guest_name, s.status, s.lease_start, s.lease_end,
              s.student_user_id, u.full_name, u.email, u.student_id AS school_id, u.course
       FROM public.student_dorm_reservations s
       JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
       JOIN public.landlord_rooms r ON r.id = s.room_id
       WHERE r.property_id = $1::uuid
         AND s.status IN ('Pending', 'Confirmed')
       ORDER BY s.room_id,
                CASE s.status WHEN 'Confirmed' THEN 0 ELSE 1 END,
                s.created_at DESC`,
      [propertyId]
    );

    const { rows: manualRes } = await pool.query<{
      id: string;
      room_id: string | null;
      guest_name: string;
      email: string | null;
      status: string;
      lease_start: Date;
      lease_end: Date;
    }>(
      `SELECT DISTINCT ON (lr.room_id)
              lr.id, lr.room_id, lr.guest_name, lr.email, lr.status,
              lr.lease_start, lr.lease_end
       FROM public.landlord_reservations lr
       WHERE lr.property_id = $1::uuid
         AND lr.room_id IS NOT NULL
         AND lr.status IN ('Pending', 'Confirmed')
       ORDER BY lr.room_id,
                CASE lr.status WHEN 'Confirmed' THEN 0 ELSE 1 END,
                lr.created_at DESC`,
      [propertyId]
    );

    const { rows: studentCounts } = await pool.query<{
      room_id: string;
      c: string;
    }>(
      `SELECT s.room_id, COUNT(*)::text AS c
       FROM public.student_dorm_reservations s
       WHERE s.room_id IN (
         SELECT id FROM public.landlord_rooms WHERE property_id = $1::uuid
       )
         AND s.status IN ('Pending', 'Confirmed')
         AND NOT EXISTS (
           SELECT 1 FROM public.landlord_tenant_leases l
           WHERE l.student_reservation_id = s.id
         )
       GROUP BY s.room_id`,
      [propertyId]
    );

    const { rows: manualCounts } = await pool.query<{
      room_id: string;
      c: string;
    }>(
      `SELECT room_id, COUNT(*)::text AS c
       FROM public.landlord_reservations
       WHERE property_id = $1::uuid
         AND room_id IS NOT NULL
         AND status IN ('Pending', 'Confirmed')
       GROUP BY room_id`,
      [propertyId]
    );

    const { rows: leaseCounts } = await pool.query<{
      room_id: string;
      c: string;
    }>(
      `SELECT room_id, COUNT(*)::text AS c
       FROM public.landlord_tenant_leases
       WHERE property_id = $1::uuid
       GROUP BY room_id`,
      [propertyId]
    );

    const leaseByRoom = new Map(leases.map((l) => [l.room_id, l]));
    const studentByRoom = new Map(studentRes.map((s) => [s.room_id, s]));
    const manualByRoom = new Map(
      manualRes.filter((m) => m.room_id).map((m) => [m.room_id as string, m])
    );
    const studentReservationCountByRoom = new Map(
      studentCounts.map((row) => [row.room_id, Number(row.c)])
    );
    const manualReservationCountByRoom = new Map(
      manualCounts.map((row) => [row.room_id, Number(row.c)])
    );
    const leaseCountByRoom = new Map(
      leaseCounts.map((row) => [row.room_id, Number(row.c)])
    );

    let occupied = 0;
    let reserved = 0;
    let vacant = 0;
    let maintenance = 0;

    const roomRows = rooms.map((r) => {
      const lease = leaseByRoom.get(r.id);
      const student = studentByRoom.get(r.id);
      const manual = manualByRoom.get(r.id);

      const status = resolveRoomListingStatus({
        dbRoomStatus: r.status,
        capacity: r.capacity,
        leaseCount: leaseCountByRoom.get(r.id) ?? 0,
        studentReservationCount: studentReservationCountByRoom.get(r.id) ?? 0,
        manualReservationCount: manualReservationCountByRoom.get(r.id) ?? 0,
      });

      if (status === "Occupied") occupied += 1;
      else if (status === "Reserved") reserved += 1;
      else if (status === "Maintenance") maintenance += 1;
      else vacant += 1;

      const boarders: {
        id: string;
        name: string;
        email?: string;
        schoolId?: string;
        course?: string;
        source: "student_app" | "manual_reservation" | "landlord_lease";
        occupancyStatus: string;
        leaseStart: string;
        leaseEnd: string;
        leasePeriod: string;
      }[] = [];

      if (student) {
        boarders.push({
          id: student.id,
          name: student.full_name?.trim() || student.guest_name,
          email: student.email ?? undefined,
          schoolId: student.school_id ?? undefined,
          course: student.course ?? undefined,
          source: "student_app",
          occupancyStatus:
            student.status === "Confirmed" ? "Active" : student.status,
          leaseStart: new Date(student.lease_start).toISOString().slice(0, 10),
          leaseEnd: new Date(student.lease_end).toISOString().slice(0, 10),
          leasePeriod: formatLeasePeriod(
            new Date(student.lease_start),
            new Date(student.lease_end)
          ),
        });
      } else if (manual) {
        boarders.push({
          id: manual.id,
          name: manual.guest_name,
          email: manual.email ?? undefined,
          source: "manual_reservation",
          occupancyStatus:
            manual.status === "Confirmed" ? "Active" : manual.status,
          leaseStart: new Date(manual.lease_start).toISOString().slice(0, 10),
          leaseEnd: new Date(manual.lease_end).toISOString().slice(0, 10),
          leasePeriod: formatLeasePeriod(
            new Date(manual.lease_start),
            new Date(manual.lease_end)
          ),
        });
      } else if (lease) {
        boarders.push({
          id: lease.id,
          name: lease.tenant_name,
          email: lease.email ?? undefined,
          source: "landlord_lease",
          occupancyStatus: "Active",
          leaseStart: new Date(lease.lease_start).toISOString().slice(0, 10),
          leaseEnd: new Date(lease.lease_end).toISOString().slice(0, 10),
          leasePeriod: formatLeasePeriod(
            new Date(lease.lease_start),
            new Date(lease.lease_end)
          ),
        });
      }

      return {
        roomId: r.id,
        roomNo: r.room_no,
        capacity: r.capacity,
        monthlyRate: Number(r.monthly_rate),
        status,
        boarders,
      };
    });

    const allBoarders = roomRows.flatMap((r) =>
      r.boarders.map((b) => ({
        ...b,
        roomNo: r.roomNo,
      }))
    );

    return NextResponse.json({
      property: {
        id: property.id,
        dormName: property.name,
        ownerName: property.owner_name,
        location: [property.address, property.city].filter(Boolean).join(", "),
      },
      summary: {
        totalRooms: rooms.length,
        occupied,
        reserved,
        vacant,
        maintenance,
        totalBoarders: allBoarders.length,
      },
      rooms: roomRows,
      boarders: allBoarders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load occupancy";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
