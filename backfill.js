require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const { rows } = await pool.query(`SELECT id FROM public.student_dorm_reservations WHERE status = 'Confirmed'`);
  for (const row of rows) {
    const { rows: resRows } = await pool.query(
      `SELECT lease_start, lease_end, monthly_rent::text
       FROM public.student_dorm_reservations WHERE id = $1::uuid`,
      [row.id]
    );
    const r = resRows[0];
    if (!r) continue;

    const start = new Date(r.lease_start);
    start.setHours(12, 0, 0, 0);
    const e = new Date(r.lease_end);
    e.setHours(12, 0, 0, 0);

    let months = (e.getFullYear() - start.getFullYear()) * 12 + (e.getMonth() - start.getMonth()) + 1;
    if (months < 1) months = 1;

    const { rows: existing } = await pool.query(
      `SELECT COUNT(*)::text AS c FROM public.payment_due_dates WHERE reservation_id = $1::uuid`,
      [row.id]
    );
    const existingCount = Number(existing[0]?.c ?? 0);
    if (existingCount >= months) continue;

    for (let m = existingCount + 1; m <= months; m++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + m - 1);
      
      await pool.query(
        `INSERT INTO public.payment_due_dates
          (reservation_id, month_number, due_date, status, amount_due)
         VALUES ($1::uuid, $2, $3::date, 'Not Yet Paid', $4)`,
        [row.id, m, d.toISOString().slice(0, 10), r.monthly_rent]
      );
      console.log(`Inserted month ${m} for reservation ${row.id}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
