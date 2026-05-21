import type { Href } from "expo-router";

/** Roles supported in the unified DormConnect mobile app. */
export const MOBILE_APP_ROLES = ["Student", "Landlord"] as const;
export type MobileAppRole = (typeof MOBILE_APP_ROLES)[number];

export function isMobileAppRole(role: string): role is MobileAppRole {
  return MOBILE_APP_ROLES.includes(role as MobileAppRole);
}

const STUDENT_HOME = "/(tabs)" as Href;
const LANDLORD_HOME = "/(landlord-tabs)" as Href;

export function homeHrefForRole(role: string): Href | null {
  if (role === "Student") return STUDENT_HOME;
  if (role === "Landlord") return LANDLORD_HOME;
  return null;
}
