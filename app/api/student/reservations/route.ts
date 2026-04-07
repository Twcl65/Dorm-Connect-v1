import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import {
  formatLeasePeriod,
  landlordStatusToStudentApproved,
} from "@/lib/student-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      property_name: string;
      room_no: string;
      lease_start: string;
      lease_end: string;
      status: string;
      monthly_rent: string;
      listing_location: string | null;
      property_address: string | null;
      property_city: string | null;
      landlord_name: string;
      created_at: Date;
    }>(
      `SELECT s.id, p.name AS property_name, r.room_no,
              s.lease_start::text, s.lease_end::text, s.status,
              s.monthly_rent::text,
              r.listing_location, p.address AS property_address, p.city AS property_city,
              u.full_name AS landlord_name, s.created_at
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
       WHERE s.student_user_id = $1::uuid
       ORDER BY s.created_at DESC`,
      [studentId]
    );

    const list = rows.map((x) => {
      const ls = new Date(x.lease_start);
      const le = new Date(x.lease_end);
      const months = Math.max(
        1,
        Math.round((le.getTime() - ls.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
      );
      const location =
        x.listing_location?.trim() ||
        [x.property_address, x.property_city].filter(Boolean).join(", ") ||
        "—";
      return {
        id: x.id,
        dorm: x.property_name,
        room: x.room_no,
        status: landlordStatusToStudentApproved(x.status),
        date: new Date(x.created_at).toISOString().slice(0, 10),
        moveInDate: x.lease_start.slice(0, 10),
        leaseMonths: months,
        monthlyRent: Number(x.monthly_rent),
        location,
        landlord: x.landlord_name,
        distance: "—",
        documentType: "Listed",
        amenities: [] as string[],
        images: [
          "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1200",
        ],
        leasePeriod: formatLeasePeriod(ls, le),
      };
    });

    return NextResponse.json({ reservations: list });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reservations";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const body = (await req.json()) as {
      roomId?: string;
      leaseStart?: string;
      leaseEnd?: string;
      notes?: string;
    };
    const roomId = (body.roomId ?? "").trim();
    const leaseStart = body.leaseStart;
    const leaseEnd = body.leaseEnd;
    if (!roomId || !leaseStart || !leaseEnd) {
      return NextResponse.json(
        { error: "roomId, leaseStart, and leaseEnd are required." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    const { rows: rm } = await pool.query<{
      id: string;
      monthly_rate: string;
      status: string;
      is_listed: boolean;
      operational_status: string;
      accredited: boolean;
    }>(
      `SELECT r.id, r.monthly_rate::text, r.status, r.is_listed,
              p.operational_status,
              EXISTS (
                SELECT 1 FROM public.landlord_accreditation_requests acc
                WHERE acc.property_id = r.property_id AND acc.status = 'Approved'
              ) AS accredited
       FROM public.landlord_rooms r
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE r.id = $1::uuid`,
      [roomId]
    );
    const room = rm[0];
    if (
      !room ||
      !room.is_listed ||
      room.status !== "Available" ||
      !room.accredited ||
      room.operational_status === "Not Operating"
    ) {
      return NextResponse.json(
        {
          error:
            "That room is not available. Only listed rooms in accredited, operating dormitories can be reserved.",
        },
        { status: 400 }
      );
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.student_dorm_reservations
        (student_user_id, room_id, guest_name, lease_start, lease_end, monthly_rent, status, notes)
       VALUES ($1::uuid, $2::uuid, $3, $4::date, $5::date, $6, 'Pending', $7)
       RETURNING id`,
      [
        studentId,
        roomId,
        session.name,
        leaseStart.slice(0, 10),
        leaseEnd.slice(0, 10),
        Number(room.monthly_rate),
        (body.notes ?? "").trim() || null,
      ]
    );

    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create reservation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
