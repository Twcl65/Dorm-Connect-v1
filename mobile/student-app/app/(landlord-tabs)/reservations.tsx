import { useCallback, useState } from "react";
import {
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
  type LandlordReservation,
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

export default function LandlordReservationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<{ reservations: LandlordReservation[] }>(
      "/api/landlord/reservations",
      { token }
    );
    setItems(res.reservations ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
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
      <Title style={{ color: colors.brand }}>Reservations</Title>
      <Subtitle>Student and manual reservations</Subtitle>
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
            <Text style={styles.empty}>No reservations yet.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.top}>
              <Text style={styles.name}>{item.name}</Text>
              <Badge
                label={item.reservationStatus}
                tone={
                  item.reservationStatus === "Confirmed"
                    ? "success"
                    : item.reservationStatus === "Cancelled"
                      ? "danger"
                      : "warning"
                }
              />
            </View>
            <Text style={styles.meta}>
              {item.dormName} · Room {item.roomNo}
            </Text>
            <Text style={styles.meta}>{item.leasePeriod}</Text>
            {item.rentPaymentStatus ? (
              <Text style={styles.meta}>Rent: {item.rentPaymentStatus}</Text>
            ) : null}
          </Card>
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
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
});
