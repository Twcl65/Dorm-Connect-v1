import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordPropertyRow,
} from "@/lib/api";
import {
  Button,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function LandlordPropertiesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<LandlordPropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ properties: LandlordPropertyRow[] }>(
      "/api/landlord/properties",
      { token }
    );
    setItems(res.properties ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
          setError(null);
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      setError(null);
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setRefreshing(false);
    }
  };

  const deleteProperty = (id: string, name: string) => {
    Alert.alert(
      "Delete Property",
      `Are you sure you want to delete ${name}? This will also delete all rooms inside it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setLoading(true);
            try {
              await apiRequest(`/api/landlord/properties/${id}`, {
                method: "DELETE",
                token,
              });
              await load();
            } catch (e) {
              Alert.alert("Failed", e instanceof Error ? e.message : "Request failed.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>Your properties</Subtitle>
      <Text style={styles.hint}>
        Add dorm properties here, then add rooms and post listings under Rooms.
      </Text>

      <View style={styles.actions}>
        <Button
          label="Add property"
          variant="brand"
          onPress={() => router.push("/landlord/add-property")}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>
              No properties yet. Tap Add property to create one (same as the
              website).
            </Text>
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
            <View style={styles.cardActions}>
              <Button
                label="Delete"
                variant="danger"
                onPress={() => deleteProperty(item.id, item.name)}
              />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  actions: { marginBottom: 12 },
  error: { color: colors.red, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  empty: { fontSize: 13, color: colors.muted },
  cardActions: { marginTop: 12 },
});
