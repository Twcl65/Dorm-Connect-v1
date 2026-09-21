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
  type LandlordReservation,
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

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString();
}

export default function LandlordReservationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
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

  const decideExtension = (
    item: LandlordReservation,
    decision: "Approved" | "Rejected"
  ) => {
    Alert.alert(
      decision === "Approved" ? "Approve extension?" : "Decline extension?",
      `${item.name} asked to stay through ${formatDate(item.leaseExtension?.requestedEnd)}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: decision === "Approved" ? "Approve" : "Decline",
          style: decision === "Rejected" ? "destructive" : "default",
          onPress: () => {
            void (async () => {
              if (!token) return;
              setSavingId(item.id);
              try {
                await apiRequest(
                  `/api/landlord/student-reservations/${item.id}`,
                  {
                    method: "PATCH",
                    token,
                    body: { leaseExtension: decision },
                  }
                );
                await load();
              } catch (e) {
                Alert.alert(
                  "Could not update",
                  e instanceof Error ? e.message : "Request failed."
                );
              } finally {
                setSavingId(null);
              }
            })();
          },
        },
      ]
    );
  };

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
            {item.leaseExtension?.status === "Pending" ? (
              <>
                <View style={{ marginTop: 8 }}>
                  <Badge label="Extension request" tone="warning" />
                </View>
                <Text style={styles.meta}>
                  Requested last day: {formatDate(item.leaseExtension.requestedEnd)}
                </Text>
                <View style={styles.actions}>
                  <Button
                    label="Approve extension"
                    variant="sky"
                    onPress={() => decideExtension(item, "Approved")}
                    disabled={savingId === item.id}
                    loading={savingId === item.id}
                  />
                  <View style={{ height: 8 }} />
                  <Button
                    label="Decline extension"
                    variant="danger"
                    onPress={() => decideExtension(item, "Rejected")}
                    disabled={savingId === item.id}
                  />
                </View>
              </>
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
  actions: { marginTop: 12 },
});
