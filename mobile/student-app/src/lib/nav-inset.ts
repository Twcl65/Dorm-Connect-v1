import { Platform } from "react-native";

/** Extra space so primary actions sit above the 3-button Android nav bar. */
export function bottomNavPad(insetBottom: number, iosMin = 16): number {
  if (Platform.OS === "android") return Math.max(insetBottom, 48);
  return Math.max(insetBottom, iosMin);
}
