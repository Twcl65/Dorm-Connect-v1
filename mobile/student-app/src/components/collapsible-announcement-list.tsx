import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, colors } from "@/components/ui";

const NEW_DAYS = 7;

function isNew(dateStr: string) {
  const diff =
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return diff <= NEW_DAYS;
}

export type AnnouncementItem = {
  id: string;
  title: string;
  message: string;
  date: string;
  source?: "landlord" | "osa";
  propertyName?: string | null;
  meta?: string;
};

function AnnouncementRow({
  item,
  isFirst,
}: {
  item: AnnouncementItem;
  isFirst?: boolean;
}) {
  return (
    <View style={[styles.item, isFirst && styles.itemFirst]}>
      <View style={styles.itemHead}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {isNew(item.date) && <Badge label="New" tone="warning" />}
      </View>
      {item.meta ? (
        <Text style={styles.itemMeta}>{item.meta}</Text>
      ) : (
        <Text style={styles.itemMeta}>
          {item.source === "landlord" ? "Landlord" : "OSA"}
          {item.propertyName ? ` · ${item.propertyName}` : ""} ·{" "}
          {new Date(item.date).toLocaleDateString()}
        </Text>
      )}
      <Text style={styles.itemBody} numberOfLines={2}>
        {item.message}
      </Text>
    </View>
  );
}

export function CollapsibleAnnouncementList({
  items,
  emptyMessage = "No announcements right now.",
}: {
  items: AnnouncementItem[];
  emptyMessage?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  const latest = items[0];
  const rest = items.slice(1);
  const hiddenCount = rest.length;

  return (
    <>
      <AnnouncementRow item={latest} isFirst />

      {hiddenCount > 0 && !expanded ? (
        <Pressable
          style={styles.toggle}
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={`Show ${hiddenCount} more announcements`}
        >
          <Text style={styles.toggleText}>+{hiddenCount}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.sky} />
        </Pressable>
      ) : null}

      {expanded
        ? rest.map((item) => <AnnouncementRow key={item.id} item={item} />)
        : null}

      {expanded && hiddenCount > 0 ? (
        <Pressable
          style={styles.toggle}
          onPress={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel="Hide additional announcements"
        >
          <Text style={styles.toggleText}>Show less</Text>
          <Ionicons name="chevron-up" size={16} color={colors.sky} />
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: colors.muted },
  item: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
  },
  itemFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
    marginTop: 0,
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  itemMeta: { fontSize: 11, color: colors.muted, marginTop: 4 },
  itemBody: { fontSize: 13, color: "#334155", marginTop: 4, lineHeight: 18 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f0f9ff",
  },
  toggleText: { fontSize: 13, color: colors.sky, fontWeight: "600" },
});
