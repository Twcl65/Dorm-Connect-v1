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
  type LandlordPropertyRow,
} from "@/lib/api";
import { Card, CenteredLoader, Screen, Subtitle, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function LandlordPropertiesScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordPropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await apiRequest<{ properties: LandlordPropertyRow[] }>(
            "/api/landlord/properties",
            { token: token! }
          );
          setItems(res.properties ?? []);
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
      <Subtitle>Your properties</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => {}} />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>No properties yet.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.name}>{item.name}</Text>
            {item.address ? (
              <Text style={styles.meta}>{item.address}</Text>
            ) : null}
            {item.city ? <Text style={styles.meta}>{item.city}</Text> : null}
            <Text style={styles.meta}>
              {item.propertyType ?? "Property"} ·{" "}
              {item.operationalStatus ?? "—"} · Rooms:{" "}
              {item.totalRooms ?? "—"}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  empty: { fontSize: 13, color: colors.muted },
});
