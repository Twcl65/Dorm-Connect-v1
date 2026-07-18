import type { Pool } from "pg";

export async function insertNotification(
  pool: Pool,
  userId: string,
  title: string,
  body: string,
  category = "general"
): Promise<void> {
  // 1) Persist to DB (existing behaviour)
  await pool.query(
    `INSERT INTO public.app_notifications (user_id, category, title, body)
     VALUES ($1::uuid, $2, $3, $4)`,
    [userId, category, title, body]
  );

  // 2) Send Expo push notifications to all registered devices
  try {
    const { rows } = await pool.query<{ token: string }>(
      `SELECT token FROM public.push_tokens WHERE user_id = $1::uuid`,
      [userId]
    );
    if (rows.length === 0) return;

    const messages = rows.map((r) => ({
      to: r.token,
      sound: "default" as const,
      title,
      body,
      data: { category },
    }));

    // Expo Push API accepts batches of up to 100 messages
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });
    }
  } catch (pushErr) {
    // Don't let push failures break the main notification flow
    console.error("[push] Failed to send Expo push notification:", pushErr);
  }
}
