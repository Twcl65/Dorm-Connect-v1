import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  landlordLog,
  refreshRoomFromStudentReservations,
} from "@/lib/landlord-db";
import { insertNotification } from "@/lib/notify-user";
import { fetchStudentUnpaidStaysElsewhere } from "@/lib/student-outstanding-balance";
import { requireLandlord } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      status?: string;
      rentPaymentStatus?: string;
      paymentMethod?: string;
      amountPaid?: number;
      referenceNo?: string;
      proofUrl?: string;
      depositAmount?: number;
      advanceAmount?: number;
      balanceRemaining?: number;
      nextPaymentDueDate?: string | null;
      notes?: string;
      holdApplication?: boolean;
    };

    const pool = await getPool();
    const { rows: cur } = await pool.query<{
      room_id: string;
      student_user_id: string;
      status: string;
      rent_payment_status: string;
      guest_name: string;
      property_name: string;
      property_id: string;
      room_no: string;
    }>(
      `SELECT s.room_id, s.student_user_id, s.status, s.rent_payment_status, s.guest_name,
              p.name AS property_name, p.id AS property_id, r.room_no
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid`,
      [id, ownerId]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const row = cur[0];

    let status = row.status;
    if (body.holdApplication === true) {
      status = "Pending";
    } else if (
      body.status === "Confirmed" ||
      body.status === "Pending" ||
      body.status === "Cancelled"
    ) {
      status = body.status;
    }

    if (status === "Confirmed" && body.holdApplication !== true) {
      const unpaidElsewhere = await fetchStudentUnpaidStaysElsewhere(
        pool,
        row.student_user_id,
        row.property_id
      );
      if (unpaidElsewhere.length > 0) {
        const names = unpaidElsewhere.map((u) => u.dormName).join(", ");
        return NextResponse.json(
          {
            error: `This student has unpaid dues at another boarding house (${names}). Hold the application until balances are settled.`,
            unpaidElsewhere,
          },
          { status: 409 }
        );
      }
    }

    let rentPaymentStatus = row.rent_payment_status;
    if (
      body.rentPaymentStatus === "Paid" ||
      body.rentPaymentStatus === "Pending" ||
      body.rentPaymentStatus === "Overdue"
    ) {
      rentPaymentStatus = body.rentPaymentStatus;
    }

    const amountPaid =
      body.amountPaid != null ? Math.max(0, Number(body.amountPaid)) : 0;
    const methodRaw = (body.paymentMethod ?? "").trim() || "GCash";
    const method =
      methodRaw === "GCash" ||
      methodRaw === "Cash" ||
      methodRaw === "Bank Transfer"
        ? methodRaw
        : "GCash";

    if (amountPaid > 0 && status === "Confirmed") {
      rentPaymentStatus = "Paid";
      const ref = (body.referenceNo ?? "").trim() || null;
      const proof = (body.proofUrl ?? "").trim() || null;
      await pool.query(
        `INSERT INTO public.student_payment_records
          (student_user_id, reservation_id, amount, method, status, paid_at, receipt_url, description)
         VALUES ($1::uuid, $2::uuid, $3, $4, 'Paid', now(), $5, $6)`,
        [
          row.student_user_id,
          id,
          amountPaid,
          method,
          proof,
          ref ? `Ref: ${ref}` : "Recorded by landlord",
        ]
      );
    }

    const dep =
      body.depositAmount != null ? Math.max(0, Number(body.depositAmount)) : null;
    const adv =
      body.advanceAmount != null ? Math.max(0, Number(body.advanceAmount)) : null;
    const bal =
      body.balanceRemaining != null ? Math.max(0, Number(body.balanceRemaining)) : null;
    const due =
      body.nextPaymentDueDate !== undefined
        ? body.nextPaymentDueDate?.trim()
          ? body.nextPaymentDueDate.trim().slice(0, 10)
          : null
        : undefined;

    const notes =
      body.notes !== undefined
        ? (body.notes ?? "").trim() || null
        : body.holdApplication === true
          ? `Held by landlord: applicant has unpaid dues at another boarding house/dormitory.`
          : undefined;

    const setParts = ["status = $1", "rent_payment_status = $2", "updated_at = now()"];
    const vals: unknown[] = [status, rentPaymentStatus];
    let q = 3;
    if (notes !== undefined) {
      setParts.push(`notes = $${q++}`);
      vals.push(notes);
    }
    if (dep !== null) {
      setParts.push(`deposit_amount = $${q++}`);
      vals.push(dep);
    }
    if (adv !== null) {
      setParts.push(`advance_amount = $${q++}`);
      vals.push(adv);
    }
    if (bal !== null) {
      setParts.push(`balance_remaining = $${q++}`);
      vals.push(bal);
    }
    if (due !== undefined) {
      setParts.push(`next_payment_due_date = $${q++}::date`);
      vals.push(due);
    }
    vals.push(id);

    await pool.query(
      `UPDATE public.student_dorm_reservations
       SET ${setParts.join(", ")}
       WHERE id = $${q}::uuid`,
      vals
    );

    await refreshRoomFromStudentReservations(pool, row.room_id);
    await landlordLog(
      pool,
      ownerId,
      `Student reservation ${row.guest_name} → ${status} (rent ${rentPaymentStatus})`
    );

    const dormLabel = `${row.property_name} · Room ${row.room_no}`;
    try {
      if (status !== row.status) {
        if (status === "Confirmed") {
          await insertNotification(
            pool,
            row.student_user_id,
            "Reservation confirmed",
            `Your reservation at ${dormLabel} has been confirmed.`,
            "reservation"
          );
        } else if (status === "Cancelled") {
          await insertNotification(
            pool,
            row.student_user_id,
            "Reservation declined",
            `Your reservation at ${dormLabel} was not approved.`,
            "reservation"
          );
        }
      }
      if (body.holdApplication === true) {
        await insertNotification(
          pool,
          row.student_user_id,
          "Application on hold",
          `Your reservation at ${dormLabel} is on hold. Please settle outstanding dues at your current boarding house before this application can proceed.`,
          "reservation"
        );
      }
      if (
        rentPaymentStatus === "Paid" &&
        row.rent_payment_status !== "Paid"
      ) {
        await insertNotification(
          pool,
          row.student_user_id,
          "Payment confirmed",
          `Your rent payment for ${dormLabel} has been confirmed.`,
          "payment"
        );
      }
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
