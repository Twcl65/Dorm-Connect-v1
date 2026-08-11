import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type AnnouncementRow,
} from "@/lib/api";
import { Badge, Card, colors } from "@/components/ui";
import { CollapsibleAnnouncementList } from "@/components/collapsible-announcement-list";
import { useAuth } from "@/context/AuthContext";

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

  const items = rows.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    date: item.date,
    source: item.source,
    propertyName: item.propertyName,
  }));

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

      <CollapsibleAnnouncementList items={items} />
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
});
