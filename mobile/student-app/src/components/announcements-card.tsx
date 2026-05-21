import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type AnnouncementRow,
} from "@/lib/api";
import { Badge, Card, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const PREVIEW_COUNT = 3;
const NEW_DAYS = 7;

function isNew(dateStr: string) {
  const diff =
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return diff <= NEW_DAYS;
}

export function AnnouncementsCard() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest<{ announcements: AnnouncementRow[] }>(
        "/api/student/announcements",
        { token }
      );
      setRows(res.announcements ?? []);
      setError(null);
    } catch (e) {
      setError(formatSignInError(e));
      setRows([]);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const preview = rows.slice(0, PREVIEW_COUNT);

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.title}>Announcements</Text>
        {rows.length > 0 && (
          <Badge
            label={`${rows.length}`}
            tone={rows.some((r) => isNew(r.date)) ? "warning" : "default"}
          />
        )}
      </View>
      <Text style={styles.sub}>
        Official notices from OSA and your landlords.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {preview.length === 0 && !error ? (
        <Text style={styles.empty}>No announcements right now.</Text>
      ) : (
        preview.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.itemHead}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {isNew(item.date) && <Badge label="New" tone="warning" />}
            </View>
            <Text style={styles.itemMeta}>
              {item.source === "landlord" ? "Landlord" : "OSA"}
              {item.propertyName ? ` · ${item.propertyName}` : ""} ·{" "}
              {new Date(item.date).toLocaleDateString()}
            </Text>
            <Text style={styles.itemBody} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        ))
      )}

      {rows.length > PREVIEW_COUNT && (
        <Text style={styles.more}>
          +{rows.length - PREVIEW_COUNT} more announcement
          {rows.length - PREVIEW_COUNT === 1 ? "" : "s"}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 16, fontWeight: "600", color: colors.navy },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 8 },
  error: { fontSize: 12, color: colors.red, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.muted },
  item: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
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
  more: { fontSize: 12, color: colors.sky, marginTop: 10, fontWeight: "500" },
});
