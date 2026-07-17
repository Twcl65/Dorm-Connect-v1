import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  ensureLandlordProperty,
  formatLeasePeriod,
  mapRentPaymentStatus,
  resolveDormDisplayName,
  resolveRoomListingStatus,
  type RoomListingStatus,
} from "@/lib/landlord-db";
import { requireLandlord } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const { searchParams } = new URL(req.url);
  let propertyId = (searchParams.get("propertyId") ?? "").trim();

  try {
    const pool = await getPool();

    let { rows: propList } = await pool.query<{
      id: string;
      name: string;
      address: string | null;
      city: string | null;
      contact_phone: string | null;
      latitude: string | null;
      longitude: string | null;
    }>(
      `SELECT id, name, address, city, contact_phone,
              latitude::text, longitude::text
       FROM public.landlord_properties
       WHERE owner_user_id = $1::uuid
       ORDER BY created_at ASC`,
      [ownerId]
    );

    if (propList.length === 0) {
      await ensureLandlordProperty(pool, ownerId);
      const again = await pool.query<{
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        contact_phone: string | null;
        latitude: string | null;
        longitude: string | null;
      }>(
        `SELECT id, name, address, city, contact_phone,
                latitude::text, longitude::text
         FROM public.landlord_properties
         WHERE owner_user_id = $1::uuid
         ORDER BY created_at ASC`,
        [ownerId]
      );
      propList = again.rows;
    }

    if (!propertyId || !/^[0-9a-f-]{36}$/i.test(propertyId)) {
      propertyId = propList[0]?.id ?? "";
    } else {
      const ok = propList.some((p) => p.id === propertyId);
      if (!ok) {
        return NextResponse.json({ error: "Invalid property." }, { status: 400 });
      }
    }

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
       WHERE p.id = $1::uuid`,
      [propertyId]
    );

    const { rows: rooms } = await pool.query<{
      id: string;
      property_id: string;
      room_no: string;
      capacity: number;
      monthly_rate: string;
      status: string;
      remarks: string | null;
      is_listed: boolean;
      listing_location: string | null;
      listing_description: string | null;
      listing_image_urls: unknown;
      listing_background_url: string | null;
      room_image_urls: unknown;
      room_size_label: string | null;
      room_details: string | null;
    }>(
      `SELECT id, property_id, room_no, capacity, monthly_rate::text, status, remarks,
              is_listed, listing_location, listing_description, listing_image_urls,
              listing_background_url, room_image_urls, room_size_label, room_details
       FROM public.landlord_rooms
       WHERE owner_user_id = $1::uuid AND property_id = $2::uuid
       ORDER BY room_no`,
      [ownerId, propertyId]
    );

    const { rows: leases } = await pool.query<{
      id: string;
      room_id: string;
      room_no: string;
      tenant_name: string;
      lease_start: Date;
      lease_end: Date;
      payment_status: string;
    }>(
      `SELECT l.id, l.room_id, r.room_no, l.tenant_name,
              l.lease_start, l.lease_end, l.payment_status
       FROM public.landlord_tenant_leases l
       JOIN public.landlord_rooms r ON r.id = l.room_id
       WHERE l.owner_user_id = $1::uuid AND l.property_id = $2::uuid
       ORDER BY r.room_no`,
      [ownerId, propertyId]
    );

    const { rows: studentReservations } = await pool.query<{
      id: string;
      room_id: string;
      room_no: string;
      guest_name: string;
      lease_start: Date;
      lease_end: Date;
      status: string;
      rent_payment_status: string;
    }>(
      `SELECT DISTINCT ON (s.room_id)
              s.id, s.room_id, r.room_no, s.guest_name,
              s.lease_start, s.lease_end, s.status, s.rent_payment_status
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       WHERE r.owner_user_id = $1::uuid AND r.property_id = $2::uuid
         AND s.status IN ('Pending', 'Confirmed')
       ORDER BY s.room_id,
                CASE s.status WHEN 'Confirmed' THEN 0 ELSE 1 END,
                s.created_at DESC`,
      [ownerId, propertyId]
    );

    const { rows: manualReservations } = await pool.query<{
      id: string;
      room_id: string | null;
      room_no: string | null;
      guest_name: string;
      lease_start: Date;
      lease_end: Date;
      status: string;
      amount_paid: string;
    }>(
      `SELECT DISTINCT ON (lr.room_id)
              lr.id, lr.room_id, rm.room_no, lr.guest_name,
              lr.lease_start, lr.lease_end, lr.status, lr.amount_paid::text
       FROM public.landlord_reservations lr
       LEFT JOIN public.landlord_rooms rm ON rm.id = lr.room_id
       WHERE lr.owner_user_id = $1::uuid AND lr.property_id = $2::uuid
         AND lr.room_id IS NOT NULL
         AND lr.status IN ('Pending', 'Confirmed')
       ORDER BY lr.room_id,
                CASE lr.status WHEN 'Confirmed' THEN 0 ELSE 1 END,
                lr.created_at DESC`,
      [ownerId, propertyId]
    );

    const { rows: studentCounts } = await pool.query<{
      room_id: string;
      c: string;
    }>(
      `SELECT s.room_id, COUNT(*)::text AS c
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       WHERE r.owner_user_id = $1::uuid
         AND r.property_id = $2::uuid
         AND s.status IN ('Pending', 'Confirmed')
         AND NOT EXISTS (
           SELECT 1 FROM public.landlord_tenant_leases l
           WHERE l.student_reservation_id = s.id
         )
       GROUP BY s.room_id`,
      [ownerId, propertyId]
    );

    const { rows: manualCounts } = await pool.query<{
      room_id: string;
      c: string;
    }>(
      `SELECT lr.room_id, COUNT(*)::text AS c
       FROM public.landlord_reservations lr
       WHERE lr.owner_user_id = $1::uuid
         AND lr.property_id = $2::uuid
         AND lr.room_id IS NOT NULL
         AND lr.status IN ('Pending', 'Confirmed')
       GROUP BY lr.room_id`,
      [ownerId, propertyId]
    );

    const { rows: leaseCounts } = await pool.query<{
      room_id: string;
      c: string;
    }>(
      `SELECT l.room_id, COUNT(*)::text AS c
       FROM public.landlord_tenant_leases l
       JOIN public.landlord_rooms r ON r.id = l.room_id
       WHERE l.owner_user_id = $1::uuid
         AND l.property_id = $2::uuid
       GROUP BY l.room_id`,
      [ownerId, propertyId]
    );

    const leaseByRoom = new Map(leases.map((l) => [l.room_id, l]));
    const studentByRoom = new Map(
      studentReservations.map((s) => [s.room_id, s])
    );
    const manualByRoom = new Map(
      manualReservations
        .filter((m) => m.room_id)
        .map((m) => [m.room_id as string, m])
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

    const roomStatuses: (
      | "Occupied"
      | "Available"
      | "Reserved"
      | "Maintenance"
    )[] = [];

    const roomStatusByRoom = new Map<string, RoomListingStatus>();

    const mappedRooms = rooms.map((r) => {
      const lease = leaseByRoom.get(r.id);
      const studentRes = studentByRoom.get(r.id);
      const manualRes = manualByRoom.get(r.id);
      const effectiveStatus = resolveRoomListingStatus({
        dbRoomStatus: r.status,
        capacity: r.capacity,
        leaseCount: leaseCountByRoom.get(r.id) ?? 0,
        studentReservationCount: studentReservationCountByRoom.get(r.id) ?? 0,
        manualReservationCount: manualReservationCountByRoom.get(r.id) ?? 0,
      });
      roomStatuses.push(effectiveStatus);
      roomStatusByRoom.set(r.id, effectiveStatus);

      const imgs = Array.isArray(r.listing_image_urls)
        ? (r.listing_image_urls as string[])
        : [];
      const roomImgs = Array.isArray(r.room_image_urls)
        ? (r.room_image_urls as string[])
        : [];

      return {
        id: r.id,
        propertyId: r.property_id,
        roomNo: r.room_no,
        capacity: r.capacity,
        rate: Number(r.monthly_rate),
        status: effectiveStatus,
        remarks: r.remarks ?? undefined,
        isListed: r.is_listed,
        listingLocation: r.listing_location ?? undefined,
        listingDescription: r.listing_description ?? undefined,
        listingImageUrls: imgs,
        listingBackgroundUrl: r.listing_background_url ?? undefined,
        roomImageUrls: roomImgs,
        roomSizeLabel: r.room_size_label ?? undefined,
        roomDetails: r.room_details ?? undefined,
      };
    });

    await Promise.all(
      rooms.map(async (r, i) => {
        const next = roomStatuses[i];
        if (r.status === "Maintenance" || r.status === next) return;
        await pool.query(
          `UPDATE public.landlord_rooms SET status = $2, updated_at = now() WHERE id = $1::uuid`,
          [r.id, next]
        );
      })
    );

    const leaseRows = rooms
      .map((r) => {
        const lease = leaseByRoom.get(r.id);
        const studentRes = studentByRoom.get(r.id);
        const manualRes = manualByRoom.get(r.id);
        const effectiveStatus =
          roomStatusByRoom.get(r.id) ??
          resolveRoomListingStatus({
            dbRoomStatus: r.status,
            capacity: r.capacity,
            leaseCount: leaseCountByRoom.get(r.id) ?? 0,
            studentReservationCount:
              studentReservationCountByRoom.get(r.id) ?? 0,
            manualReservationCount: manualReservationCountByRoom.get(r.id) ?? 0,
          });

        if (lease) {
          return {
            id: lease.id,
            roomId: lease.room_id,
            roomNo: lease.room_no,
            name: lease.tenant_name,
            leaseStart: new Date(lease.lease_start).toISOString().slice(0, 10),
            leaseEnd: new Date(lease.lease_end).toISOString().slice(0, 10),
            leasePeriod: formatLeasePeriod(
              new Date(lease.lease_start),
              new Date(lease.lease_end)
            ),
            paymentStatus: lease.payment_status as
              | "Paid"
              | "Pending"
              | "Overdue",
            status: effectiveStatus,
            reservationStatus:
              studentRes?.status === "Confirmed" ||
              studentRes?.status === "Pending"
                ? studentRes.status
                : undefined,
          };
        }

        if (studentRes) {
          return {
            id: studentRes.id,
            roomId: studentRes.room_id,
            roomNo: studentRes.room_no,
            name: studentRes.guest_name,
            leaseStart: new Date(studentRes.lease_start)
              .toISOString()
              .slice(0, 10),
            leaseEnd: new Date(studentRes.lease_end).toISOString().slice(0, 10),
            leasePeriod: formatLeasePeriod(
              new Date(studentRes.lease_start),
              new Date(studentRes.lease_end)
            ),
            paymentStatus: mapRentPaymentStatus(studentRes.rent_payment_status),
            status: effectiveStatus,
            reservationStatus: studentRes.status as "Pending" | "Confirmed",
          };
        }

        if (manualRes?.room_id) {
          const paid =
            manualRes.status === "Confirmed" &&
            Number(manualRes.amount_paid) > 0;
          return {
            id: manualRes.id,
            roomId: manualRes.room_id,
            roomNo: manualRes.room_no ?? r.room_no,
            name: manualRes.guest_name,
            leaseStart: new Date(manualRes.lease_start)
              .toISOString()
              .slice(0, 10),
            leaseEnd: new Date(manualRes.lease_end).toISOString().slice(0, 10),
            leasePeriod: formatLeasePeriod(
              new Date(manualRes.lease_start),
              new Date(manualRes.lease_end)
            ),
            paymentStatus: paid ? ("Paid" as const) : ("Pending" as const),
            status: effectiveStatus,
            reservationStatus: manualRes.status as "Pending" | "Confirmed",
          };
        }

        return null;
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const total = rooms.length;
    const occupied = roomStatuses.filter((s) => s === "Occupied").length;
    const available = roomStatuses.filter((s) => s === "Available").length;
    const reserved = roomStatuses.filter((s) => s === "Reserved").length;
    const maintenance = roomStatuses.filter((s) => s === "Maintenance").length;

    const propertyName = resolveDormDisplayName(
      prop[0]?.name,
      prop[0]?.acc_dorm_name ?? null
    );

    return NextResponse.json({
      properties: propList.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address?.trim() || null,
        city: p.city?.trim() || null,
        contactPhone: p.contact_phone?.trim() || null,
        latitude:
          p.latitude != null && p.latitude !== "" ? Number(p.latitude) : null,
        longitude:
          p.longitude != null && p.longitude !== ""
            ? Number(p.longitude)
            : null,
      })),
      selectedPropertyId: propertyId,
      propertyName,
      stats: { total, occupied, available, reserved, maintenance },
      rooms: mappedRooms,
      leaseRows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load rooms";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
