import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ReservationDetailModal } from "@/components/reservation-detail-modal";
import { InfoGrid } from "@/components/info-grid";
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
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { formatLeaseEndLabel } from "@/lib/listing-utils";

export default function ReservationsScreen() {
  const { token } = useAuth();
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
    const next = res.reservations ?? [];
    setItems(next);
    setSelected((prev) =>
      prev ? next.find((r) => r.id === prev.id) ?? prev : prev
    );
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
            <InfoGrid
              rows={[
                [
                  { label: "Dorm name", value: item.dorm },
                  { label: "Room #", value: `Room ${item.room}` },
                ],
                [
                  {
                    label: "Lease duration",
                    value: `${item.leaseMonths} ${item.leaseMonths === 1 ? "month" : "months"}`,
                  },
                  {
                    label: "Move-out date",
                    value: item.leaseEndDate
                      ? formatLeaseEndLabel(item.leaseEndDate)
                      : "—",
                  },
                ],
                [
                  { label: "Stay", value: item.stayLabel ?? item.status },
                  { label: "Rent", value: item.rentLabel ?? "—" },
                ],
              ]}
            />
            <View style={styles.badges}>
              <Badge
                label={item.stayLabel ?? item.status}
                tone={
                  item.status === "Approved" || item.status === "Active"
                    ? "success"
                    : item.status === "Cancelled"
                      ? "danger"
                      : "warning"
                }
              />
              {item.paymentSent ? (
                <Badge label="Payment submitted" tone="success" />
              ) : null}
              {item.leaseExtension?.status === "Pending" ? (
                <Badge label="Extension pending" tone="warning" />
              ) : null}
            </View>
            <View style={styles.actions}>
              <Button
                label="View details"
                variant="sky"
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
        onChanged={() => {
          void load();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, color: "#64748b" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  actions: { marginTop: 12 },
});
