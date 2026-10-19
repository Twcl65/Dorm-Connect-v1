import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordIncident,
} from "@/lib/api";
import {
  Badge,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

function statusTone(
  status: string
): "success" | "warning" | "danger" | "default" {
  if (status === "Resolved") return "success";
  if (status === "Acknowledged") return "warning";
  if (status === "Open") return "danger";
  return "default";
}

export default function LandlordIncidentsTab() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<LandlordIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ reports: LandlordIncident[] }>(
      "/api/landlord/incidents",
      { token }
    );
    setItems(res.reports ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  if (loading && items.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>Incident report</Title>
      <Subtitle>Reports from your tenants</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } catch (e) {
                setError(formatSignInError(e));
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>No incident reports yet.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/landlord/incident/[id]",
                params: { id: item.id },
              })
            }
          >
            <Card>
              <View style={styles.top}>
                <Text style={styles.title}>{item.title}</Text>
                <Badge label={item.status} tone={statusTone(item.status)} />
              </View>
              <Text style={styles.meta} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={styles.meta}>
                {item.propertyName ?? "—"} · Room {item.roomNo ?? "—"} ·{" "}
                {item.reporterName}
              </Text>
              <Text style={styles.tap}>Tap for full details →</Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.muted },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  title: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  tap: { fontSize: 12, color: colors.sky, marginTop: 8, fontWeight: "500" },
});
