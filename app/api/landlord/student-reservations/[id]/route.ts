import { NextResponse } from "next/server";
import { invalidateLandlordUser, invalidateStudentUser } from "@/lib/api-cache";
import { getPool } from "@/lib/db";
import {
  landlordLog,
  refreshRoomFromStudentReservations,
} from "@/lib/landlord-db";
import { insertNotification } from "@/lib/notify-user";
import { fetchStudentUnpaidStaysElsewhere } from "@/lib/student-outstanding-balance";
import { requireLandlord } from "@/lib/require-owner";
import {
  applyApprovedLeaseExtension,
  ensureLeaseExtensionColumns,
} from "@/lib/lease-extension";
import { markAllPendingPaymentsAsPaidForMoveOut } from "@/lib/payment-schedule";

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
      leaseExtension?: "Approved" | "Rejected";
      moveOut?: boolean;
      moveOutDate?: string;
      releaseSecurityDeposit?: boolean;
    };

    const pool = await getPool();
    await ensureLeaseExtensionColumns(pool);
    const { rows: cur } = await pool.query<{
      room_id: string;
      student_user_id: string;
      status: string;
      rent_payment_status: string;
      guest_name: string;
      property_name: string;
      property_id: string;
      room_no: string;
      lease_extension_status: string | null;
      lease_extension_requested_end: string | null;
      lease_start: string;
      lease_end: string;
      monthly_rent: string;
      advance_amount: string;
      deposit_amount: string;
      balance_remaining: string;
    }>(
      `SELECT s.room_id, s.student_user_id, s.status, s.rent_payment_status, s.guest_name,
              p.name AS property_name, p.id AS property_id, r.room_no,
              s.lease_extension_status, s.lease_extension_requested_end::text,
              s.lease_start::text, s.lease_end::text, s.monthly_rent::text,
              s.advance_amount::text, s.deposit_amount::text, s.balance_remaining::text
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

    if (body.moveOut === true) {
      const client = await pool.connect();
      let transactionStarted = false;
      let moveOutRow = row;
      let releasedDeposit = 0;
      try {
        await client.query("BEGIN");
        transactionStarted = true;
        const { rows: lockedRows } = await client.query<typeof row>(
          `SELECT s.room_id, s.student_user_id, s.status, s.rent_payment_status, s.guest_name,
                  p.name AS property_name, p.id AS property_id, r.room_no,
                  s.lease_extension_status, s.lease_extension_requested_end::text,
                  s.lease_start::text, s.lease_end::text, s.monthly_rent::text,
                  s.advance_amount::text, s.deposit_amount::text, s.balance_remaining::text
           FROM public.student_dorm_reservations s
           JOIN public.landlord_rooms r ON r.id = s.room_id
           JOIN public.landlord_properties p ON p.id = r.property_id
           WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid
           FOR UPDATE OF s`,
          [id, ownerId]
        );
        if (!lockedRows[0]) {
          await client.query("ROLLBACK");
          transactionStarted = false;
          return NextResponse.json({ error: "Not found." }, { status: 404 });
        }
        moveOutRow = lockedRows[0];
        if (moveOutRow.status === "MoveOut") {
          await client.query("ROLLBACK");
          transactionStarted = false;
          return NextResponse.json(
            { error: "This reservation has already been moved out." },
            { status: 409 }
          );
        }

        const depositBalance = Math.max(Number(moveOutRow.deposit_amount) || 0, 0);
        const depositReleaseAmount =
          body.releaseSecurityDeposit === true && depositBalance > 0
            ? moveOutRow.deposit_amount
            : null;
        releasedDeposit = depositReleaseAmount
          ? Number(depositReleaseAmount)
          : 0;
        const moveOutDate =
          body.moveOutDate?.trim()?.slice(0, 10) ??
          moveOutRow.lease_end.slice(0, 10);

        await client.query(
          `UPDATE public.student_dorm_reservations
           SET status = 'MoveOut',
               move_out_date = $1::date,
               moved_out_at = now(),
               deposit_amount = CASE WHEN $2::boolean THEN 0 ELSE deposit_amount END,
               updated_at = now()
           WHERE id = $3::uuid`,
          [moveOutDate, depositReleaseAmount !== null, id]
        );

        await client.query(
          `INSERT INTO public.student_reservation_history
            (reservation_id, student_user_id, property_id, room_id,
             tenant_name, lease_start, lease_end, move_out_date,
             status, rent_payment_status, advance_amount, deposit_amount,
             balance_remaining, ended_by, ended_reason)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid,
                   $5, $6::date, $7::date, $8::date,
                   'MoveOut', $9, $10, $11, $12, 'landlord', $13)`,
          [
            id,
            moveOutRow.student_user_id,
            moveOutRow.property_id,
            moveOutRow.room_id,
            moveOutRow.guest_name,
            moveOutRow.lease_start,
            moveOutRow.lease_end,
            moveOutDate,
            moveOutRow.rent_payment_status,
            Number(moveOutRow.advance_amount),
            depositReleaseAmount !== null
              ? 0
              : Number(moveOutRow.deposit_amount),
            Number(moveOutRow.balance_remaining),
            body.notes?.trim() || "Approved move-out",
          ]
        );

        await client.query(
          `UPDATE public.landlord_tenant_leases
           SET lease_end = $1::date,
               payment_status = 'Completed',
               updated_at = now()
           WHERE student_reservation_id = $2::uuid`,
          [moveOutDate, id]
        );

        if (depositReleaseAmount !== null) {
          await client.query(
            `INSERT INTO public.landlord_payments
              (owner_user_id, room_id, tenant_lease_id, payer_name, amount,
               method, status, reference_no, paid_on, entry_source)
             VALUES (
               $1::uuid,
               $2::uuid,
               (SELECT id FROM public.landlord_tenant_leases
                WHERE student_reservation_id = $3::uuid),
               $4,
               $5::numeric,
               'Security deposit release',
               'Paid',
               'Move-out security deposit release: ' || $3::text,
               $6::date,
               'deposit_release'
             )`,
            [
              ownerId,
              moveOutRow.room_id,
              id,
              moveOutRow.guest_name,
              depositReleaseAmount,
              moveOutDate,
            ]
          );
        }

        await client.query("COMMIT");
        transactionStarted = false;
      } catch (e) {
        if (transactionStarted) await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      await markAllPendingPaymentsAsPaidForMoveOut(pool, { reservationId: id });

      await refreshRoomFromStudentReservations(pool, moveOutRow.room_id);
      await landlordLog(
        pool,
        ownerId,
        `Approved move-out for ${moveOutRow.guest_name} · Room ${moveOutRow.room_no}${releasedDeposit > 0 ? ` and released ₱${releasedDeposit.toLocaleString("en-PH")}` : ""}`
      );
      try {
        await insertNotification(
          pool,
          moveOutRow.student_user_id,
          "Move-out approved",
          `Your move-out request for ${moveOutRow.property_name} · Room ${moveOutRow.room_no} has been approved. Your lease has been marked as completed.${releasedDeposit > 0 ? ` The security deposit of ₱${releasedDeposit.toLocaleString("en-PH")} has been released to you.` : ""}`,
          "reservation"
        );
      } catch {
        /* non-fatal */
      }
      invalidateLandlordUser(session.sub);
      invalidateStudentUser(moveOutRow.student_user_id);
      return NextResponse.json({ ok: true, releasedDeposit });
    }

    if (body.leaseExtension === "Approved" || body.leaseExtension === "Rejected") {
      if (row.lease_extension_status !== "Pending" || !row.lease_extension_requested_end) {
        return NextResponse.json(
          { error: "No pending lease extension to review." },
          { status: 400 }
        );
      }
      const nextEnd = row.lease_extension_requested_end.slice(0, 10);
      if (body.leaseExtension === "Approved") {
        await applyApprovedLeaseExtension(pool, {
          reservationId: id,
          roomId: row.room_id,
          studentUserId: row.student_user_id,
          ownerUserId: ownerId,
          nextEnd,
          propertyName: row.property_name,
          roomNo: row.room_no,
        });
        await landlordLog(
          pool,
          ownerId,
          `Approved lease extension for ${row.guest_name} through ${nextEnd}`
        );
      } else {
        await pool.query(
          `UPDATE public.student_dorm_reservations
           SET lease_extension_status = 'Rejected', updated_at = now()
           WHERE id = $1::uuid`,
          [id]
        );
        try {
          await insertNotification(
            pool,
            row.student_user_id,
            "Lease extension declined",
            `Your request to extend ${row.property_name} · Room ${row.room_no} was not approved.`,
            "reservation"
          );
        } catch {
          /* non-fatal */
        }
        invalidateLandlordUser(ownerId);
        invalidateStudentUser(row.student_user_id);
      }
      return NextResponse.json({ ok: true });
    }

    let status = row.status;
    if (body.holdApplication === true) {
      status = "Pending";
    } else if (
      body.status === "Confirmed" ||
      body.status === "Pending" ||
      body.status === "Cancelled"
    ) {
      if (row.status === "TerminatePending" && body.status === "Cancelled") {
        status = row.status;
      } else {
        status = body.status;
      }
    }

    if (
      status === "Cancelled" &&
      row.status === "Pending" &&
      !body.notes?.trim()
    ) {
      return NextResponse.json(
        { error: "Add a reason before declining this reservation." },
        { status: 400 }
      );
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
            `Your reservation at ${dormLabel} has been confirmed. Proceed to Payments to submit the required advance payment (₱${Number(row.advance_amount) || 0}) and security deposit (₱${Number(row.deposit_amount) || 0}).`,
            "reservation"
          );
        } else if (status === "Cancelled") {
          await insertNotification(
            pool,
            row.student_user_id,
            "Reservation declined",
            notes
              ? `Your reservation at ${dormLabel} was not approved. Reason: ${notes}`
              : `Your reservation at ${dormLabel} was not approved.`,
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

    invalidateLandlordUser(session.sub);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
