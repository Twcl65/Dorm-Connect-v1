import type { Href } from "expo-router";

const STAFF_HOME = "/(staff-tabs)" as Href;

export function hrefForNotification(
  category: string,
  role: string
): Href {
  const c = (category ?? "").toLowerCase();
  if (role === "Landlord") {
    if (c.includes("payment")) return "/(landlord-tabs)/payments";
    if (c.includes("reservation")) return "/(landlord-tabs)/reservations";
    if (c.includes("incident")) return "/(landlord-tabs)/incidents";
    if (c.includes("announce")) return "/(landlord-tabs)/announcements";
    if (c.includes("review")) return "/landlord/reviews";
    if (c.includes("accreditation")) return "/landlord/documents";
    if (c.includes("tenant-report")) return "/landlord/tenant-reports";
    return "/(landlord-tabs)";
  }
  if (role === "Staff") {
    if (c.includes("accreditation")) return "/(staff-tabs)/inspections";
    if (c.includes("tenant-report") || c.includes("reservation")) {
      return "/(staff-tabs)/tenants";
    }
    return STAFF_HOME;
  }
  if (c.includes("payment")) return "/(tabs)/payments";
  if (c.includes("reservation")) return "/(tabs)/reservations";
  if (c.includes("incident")) return "/(tabs)/incidents";
  if (c.includes("announce")) return "/(tabs)/announcements";
  if (c.includes("review")) return "/(tabs)/browse";
  return "/(tabs)";
}
