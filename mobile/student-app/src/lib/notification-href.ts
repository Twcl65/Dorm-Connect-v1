import type { Href } from "expo-router";

export function hrefForNotification(
  category: string,
  isLandlord: boolean
): Href {
  const c = (category ?? "").toLowerCase();
  if (isLandlord) {
    if (c.includes("payment")) return "/(landlord-tabs)/payments";
    if (c.includes("reservation")) return "/(landlord-tabs)/reservations";
    if (c.includes("incident")) return "/(landlord-tabs)/incidents";
    if (c.includes("announce")) return "/(landlord-tabs)/announcements";
    return "/(landlord-tabs)";
  }
  if (c.includes("payment")) return "/(tabs)/payments";
  if (c.includes("reservation")) return "/(tabs)/reservations";
  if (c.includes("incident")) return "/(tabs)/incidents";
  return "/(tabs)";
}
