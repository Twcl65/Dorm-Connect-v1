import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type ActivityLogRow,
} from "@/lib/api";
import { Card, CenteredLoader, Screen, Subtitle, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function LandlordActivityLogsScreen() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await apiRequest<{ logs: ActivityLogRow[] }>(
            "/api/landlord/activity-logs?page=1&pageSize=30",
            { token: token! }
          );
          setLogs(res.logs ?? []);
          setError(null);
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [token])
  );

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>Recent activity</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={logs}
        keyExtractor={(l) => l.id}
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>No activity yet.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.desc}>{item.description}</Text>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, marginBottom: 8 },
  desc: { fontSize: 14, color: colors.text },
  time: { fontSize: 11, color: colors.muted, marginTop: 6 },
  empty: { fontSize: 13, color: colors.muted },
});
