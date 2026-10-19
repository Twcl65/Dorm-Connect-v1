import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const PAIRS: Record<string, { on: IoniconName; off: IoniconName }> = {
  home: { on: "home", off: "home-outline" },
  browse: { on: "map", off: "map-outline" },
  reservations: { on: "calendar", off: "calendar-outline" },
  payments: { on: "wallet", off: "wallet-outline" },
  incidents: { on: "warning", off: "warning-outline" },
  announcements: { on: "megaphone", off: "megaphone-outline" },
  more: { on: "menu", off: "menu-outline" },
};

export function TabBarIcon({
  id,
  color,
  focused,
  size = 22,
}: {
  id: keyof typeof PAIRS;
  color: string;
  focused: boolean;
  size?: number;
}) {
  const pair = PAIRS[id];
  return (
    <Ionicons
      name={focused ? pair.on : pair.off}
      size={size}
      color={color}
    />
  );
}
