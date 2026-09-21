import { NextResponse } from "next/server";
import { invalidateLandlordUser, invalidateStudentUser } from "@/lib/api-cache";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import { insertNotification } from "@/lib/notify-user";
import { refreshRoomFromStudentReservations } from "@/lib/landlord-db";
import { recomputeReservationBalances } from "@/lib/payment-schedule";
import { ensureLeaseExtensionColumns } from "@/lib/lease-extension";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      status?: string;
      leaseEnd?: string;
      extend?: boolean;
    };
    const pool = await getPool();
    await ensureLeaseExtensionColumns(pool);

    const { rows: current } = await pool.query<{
      id: string;
      status: string;
      lease_start: string;
      lease_end: string;
      lease_extension_status: string | null;
      room_id: string;
      owner_user_id: string;
      property_name: string;
      room_no: string;
    }>(
      `SELECT s.id, s.status, s.lease_start::text, s.lease_end::text, s.room_id,
              s.lease_extension_status, r.owner_user_id, p.name AS property_name, r.room_no
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE s.id = $1::uuid AND s.student_user_id = $2::uuid`,
      [id, studentId]
    );
    const row = current[0];
    if (!row) {
      return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    }

    if (body.leaseEnd) {
      if (row.status !== "Confirmed") {
        return NextResponse.json(
          {
            error: body.extend
              ? "Only an approved stay can be extended."
              : "Only an approved stay can be ended early.",
          },
          { status: 400 }
        );
      }
      const nextEnd = body.leaseEnd.slice(0, 10);
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const start = row.lease_start.slice(0, 10);
      const currentEnd = row.lease_end.slice(0, 10);

      if (body.extend) {
        const minEnd = new Date(`${currentEnd}T12:00:00`);
        minEnd.setDate(minEnd.getDate() + 1);
        const minStr = minEnd.toISOString().slice(0, 10);
        const maxEnd = new Date(`${currentEnd}T12:00:00`);
        maxEnd.setMonth(maxEnd.getMonth() + 12);
        const maxStr = maxEnd.toISOString().slice(0, 10);
        if (nextEnd < minStr || nextEnd > maxStr) {
          return NextResponse.json(
            {
              error:
                "New last day of stay must be after the current end date and within 12 extra months.",
            },
            { status: 400 }
          );
        }
        if (row.lease_extension_status === "Pending") {
          return NextResponse.json(
            {
              error:
                "You already have a lease extension waiting for landlord approval.",
            },
            { status: 400 }
          );
        }
        await pool.query(
          `UPDATE public.student_dorm_reservations
           SET lease_extension_requested_end = $1::date,
               lease_extension_status = 'Pending',
               lease_extension_requested_at = now(),
               updated_at = now()
           WHERE id = $2::uuid`,
          [nextEnd, id]
        );
        try {
          await insertNotification(
            pool,
            row.owner_user_id,
            "Lease extension request",
            `${session.name} asked to extend ${row.property_name} · Room ${row.room_no} through ${nextEnd}.`,
            "reservation"
          );
        } catch {
          /* non-fatal */
        }
        invalidateStudentUser(studentId);
        invalidateLandlordUser(row.owner_user_id);
        return NextResponse.json({ ok: true, pending: true });
      } else {
        if (nextEnd < todayStr || nextEnd <= start || nextEnd >= currentEnd) {
          return NextResponse.json(
            {
              error:
                "Move-out date must be today or later, after move-in, and before the current last day of stay.",
            },
            { status: 400 }
          );
        }
      }

      await pool.query(
        `UPDATE public.student_dorm_reservations
         SET lease_end = $1::date, updated_at = now()
         WHERE id = $2::uuid`,
        [nextEnd, id]
      );
      await pool.query(
        `UPDATE public.landlord_tenant_leases
         SET lease_end = $1::date, updated_at = now()
         WHERE student_reservation_id = $2::uuid`,
        [nextEnd, id]
      );
      try {
        await recomputeReservationBalances(pool, id);
      } catch {
        /* non-fatal */
      }
      await refreshRoomFromStudentReservations(pool, row.room_id);
      try {
        await insertNotification(
          pool,
          row.owner_user_id,
          body.extend ? "Lease extended" : "Lease ending early",
          body.extend
            ? `${session.name} extended the stay through ${nextEnd} for ${row.property_name} · Room ${row.room_no}.`
            : `${session.name} set a move-out date of ${nextEnd} for ${row.property_name} · Room ${row.room_no}.`,
          "reservation"
        );
      } catch {
        /* non-fatal */
      }
      invalidateStudentUser(studentId);
      invalidateLandlordUser(row.owner_user_id);
      return NextResponse.json({ ok: true });
    }

    if (body.status !== "Cancelled") {
      return NextResponse.json({ error: "Only cancellation is supported." }, { status: 400 });
    }
    if (row.status !== "Pending") {
      return NextResponse.json(
        { error: "Reservation not found or cannot be cancelled." },
        { status: 404 }
      );
    }

    const { rowCount } = await pool.query(
      `UPDATE public.student_dorm_reservations
       SET status = 'Cancelled', updated_at = now()
       WHERE id = $1::uuid AND student_user_id = $2::uuid
         AND status = 'Pending'`,
      [id, studentId]
    );

    if (!rowCount) {
      return NextResponse.json(
        { error: "Reservation not found or cannot be cancelled." },
        { status: 404 }
      );
    }

    await refreshRoomFromStudentReservations(pool, row.room_id);
    try {
      await insertNotification(
        pool,
        row.owner_user_id,
        "Reservation cancelled",
        `${session.name} cancelled a request for ${row.property_name} · Room ${row.room_no}.`,
        "reservation"
      );
    } catch {
      /* non-fatal */
    }
    invalidateStudentUser(studentId);
    invalidateLandlordUser(row.owner_user_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
