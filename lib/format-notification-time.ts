/** Fixed display for when a notification was sent (not a live/updating clock). */
export function formatNotificationSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Stable ISO timestamp for synthetic alerts (same each day, not Date.now()). */
export function syntheticNotificationSentAt(day: Date, hour = 8): string {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
