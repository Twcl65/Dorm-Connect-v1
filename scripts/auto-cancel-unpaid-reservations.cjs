#!/usr/bin/env node
/**
 * Cron script: Auto-cancel unpaid confirmed reservations.
 *
 * Finds student reservations that are:
 *   - status = 'Confirmed'
 *   - lease_start has passed by more than GRACE_DAYS
 *   - balance_remaining > 0 (deposit/advance/rent not fully paid)
 *
 * Cancels them with a pre-type remarks message and notifies the student.
 *
 * Run via Windows Task Scheduler or a cron-like scheduler:
 *   node scripts/auto-cancel-unpaid-reservations.cjs
 */
const { Client } = require("pg");

const GRACE_DAYS = parseInt(process.env.AUTO_CANCEL_GRACE_DAYS || "3", 10);
const PRE_TYPE_REMARK =
  "Reservation automatically cancelled: student has not completed payment (deposit, advance, and rent) within the grace period after the lease start date.";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`[auto-cancel] Starting check (grace: ${GRACE_DAYS} days)...`);

    // Find confirmed reservations where lease_start + grace days have passed
    // and balance_remaining > 0 (meaning deposit/advance/rent not fully paid)
    const { rows } = await client.query(
      `SELECT
         s.id,
         s.student_user_id,
         s.guest_name,
         p.name AS property_name,
         r.room_no,
         s.lease_start,
         s.balance_remaining,
         s.rent_payment_status
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE s.status = 'Confirmed'
         AND s.lease_start::date <= CURRENT_DATE - INTERVAL '${GRACE_DAYS} days'
         AND (s.balance_remaining::numeric > 0 OR s.rent_payment_status != 'Paid')
       ORDER BY s.lease_start ASC`,
    );

    if (rows.length === 0) {
      console.log("[auto-cancel] No unpaid reservations to cancel.");
      return;
    }

    console.log(
      `[auto-cancel] Found ${rows.length} reservation(s) to cancel:`,
    );

    for (const row of rows) {
      try {
        // Cancel the reservation
        await client.query(
          `UPDATE public.student_dorm_reservations
           SET status = 'Cancelled',
               notes = $1,
               updated_at = now()
           WHERE id = $2::uuid`,
          [PRE_TYPE_REMARK, row.id],
        );

        // Notify the student
        const dormLabel = `${row.property_name} · Room ${row.room_no}`;
        await client.query(
          `INSERT INTO public.app_notifications
           (user_id, category, title, body)
           VALUES ($1::uuid, $2, $3, $4)`,
          [
            row.student_user_id,
            "reservation",
            "Reservation auto-cancelled",
            `Your reservation at ${dormLabel} was automatically cancelled because payment was not received within the grace period after the lease start date.`,
          ],
        );

        console.log(
          `[auto-cancel] Cancelled reservation ${row.id} for ${row.guest_name} at ${dormLabel}. Balance remaining: ${row.balance_remaining}`,
        );
      } catch (rowErr) {
        console.error(
          `[auto-cancel] Failed to cancel reservation ${row.id}:`,
          rowErr instanceof Error ? rowErr.message : rowErr,
        );
      }
    }

    console.log("[auto-cancel] Done.");
  } catch (err) {
    console.error(
      "[auto-cancel] Error:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
