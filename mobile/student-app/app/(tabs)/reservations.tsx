import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ReservationDetailModal } from "@/components/reservation-detail-modal";
import {
  apiRequest,
  formatSignInError,
  type StudentReservation,
} from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function ReservationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<StudentReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentReservation | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<{ reservations: StudentReservation[] }>(
      "/api/student/reservations",
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
      <Title>My reservations</Title>
      <Subtitle>Pending and approved bookings</Subtitle>
      {error && <Text style={styles.error}>{error}</Text>}
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
            <Text style={styles.name}>
              {item.dorm} · Room {item.room}
            </Text>
            <Text style={styles.meta}>{item.leasePeriod ?? item.moveInDate}</Text>
            <Text style={styles.meta}>{item.location}</Text>
            <Text style={styles.meta}>Landlord: {item.landlord}</Text>
            <Text style={styles.meta}>
              ₱{item.monthlyRent.toLocaleString()} / month
            </Text>
            <Badge
              label={item.status}
              tone={
                item.status === "Approved" || item.status === "Active"
                  ? "success"
                  : item.status === "Cancelled"
                    ? "danger"
                    : "warning"
              }
            />
            {item.paymentSent && (
              <Badge label="Payment submitted" tone="success" />
            )}
            <View style={styles.actions}>
              <Button
                label="View details"
                variant="outline"
                onPress={() => setSelected(item)}
              />
            </View>
          </Card>
        )}
      />

      <ReservationDetailModal
        visible={selected != null}
        reservation={selected}
        onClose={() => setSelected(null)}
        onPay={() => {
          setSelected(null);
          router.push("/(tabs)/payments");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  empty: { fontSize: 13, color: "#64748b" },
  actions: { marginTop: 12 },
});
