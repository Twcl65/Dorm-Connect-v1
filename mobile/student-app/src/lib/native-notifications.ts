import { isRunningInExpoGo } from "expo";

/** Remote push tokens are unavailable in Expo Go from SDK 53. */
export const nativeNotificationsSupported = !isRunningInExpoGo();

export async function loadNotifications() {
  if (!nativeNotificationsSupported) return null;
  return import("expo-notifications");
}
