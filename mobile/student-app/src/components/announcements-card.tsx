import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type AnnouncementRow,
} from "@/lib/api";
import { Badge, colors } from "@/components/ui";
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
  const hasNew = rows.some((r) => isNew(r.date));

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="megaphone-outline" size={22} color={colors.navy} />
        <View style={styles.headText}>
          <Text style={styles.title}>Announcements</Text>
          <Text style={styles.sub}>
            Official notices from OSA and your landlords
          </Text>
        </View>
        {rows.length > 0 && (
          <Badge
            label={`${rows.length}`}
            tone={hasNew ? "warning" : "default"}
          />
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <CollapsibleAnnouncementList items={items} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  headText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "800", color: colors.navy },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  error: { fontSize: 12, color: colors.red, marginBottom: 8 },
});
