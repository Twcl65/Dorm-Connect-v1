import type { Pool } from "pg";

export async function insertNotification(
  pool: Pool,
  userId: string,
  title: string,
  body: string,
  category = "general"
): Promise<void> {
  await pool.query(
    `INSERT INTO public.app_notifications (user_id, category, title, body)
     VALUES ($1::uuid, $2, $3, $4)`,
    [userId, category, title, body]
  );
}
