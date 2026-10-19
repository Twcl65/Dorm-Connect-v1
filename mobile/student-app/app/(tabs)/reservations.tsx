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

type TabView = "reservations" | "history";

export default function ReservationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<StudentReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentReservation | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("reservations");
  const [historyItems, setHistoryItems] = useState<
    Array<{
      id: string;
      reservationId: string;
      tenantName: string;
      roomNo: string;
      propertyName: string;
      leaseStart: string;
      leaseEnd: string;
      moveOutDate: string;
      status: string;
      rentPaymentStatus: string;
      advanceAmount: number;
      depositAmount: number;
      balanceRemaining: number;
      endedBy: string;
      endedReason: string;
      endedAt: string;
    }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

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

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await apiRequest<{
        history: Array<{
          id: string;
          reservationId: string;
          tenantName: string;
          roomNo: string;
          propertyName: string;
          leaseStart: string;
          leaseEnd: string;
          moveOutDate: string;
          status: string;
          rentPaymentStatus: string;
          advanceAmount: number;
          depositAmount: number;
          balanceRemaining: number;
          endedBy: string;
          endedReason: string;
          endedAt: string;
        }>;
      }>("/api/student/reservations/history", { token });
      setHistoryItems(res.history ?? []);
    } catch (e) {
      setHistoryError(formatSignInError(e));
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          if (activeTab === "reservations") {
            await load();
          } else {
            await loadHistory();
          }
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [load, loadHistory, activeTab])
  );

  if (loading && items.length === 0 && historyItems.length === 0)
    return <CenteredLoader />;

  return (
    <Screen>
      <Title>My reservations</Title>
      <Subtitle>Active stays and move-out history</Subtitle>

      <View style={styles.tabRow}>
        <Button
          label="Reservations"
          variant={activeTab === "reservations" ? "sky" : "outline"}
          size="sm"
          onPress={() => setActiveTab("reservations")}
        />
        <Button
          label="History"
          variant={activeTab === "history" ? "sky" : "outline"}
          size="sm"
          onPress={() => setActiveTab("history")}
        />
      </View>

      {activeTab === "reservations" && error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
      {activeTab === "history" && historyError ? (
        <Text style={styles.error}>{historyError}</Text>
      ) : null}

      {activeTab === "reservations" ? (
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
              <Text style={styles.empty}>No active reservations yet.</Text>
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
      ) : (
        <FlatList
          data={historyItems}
          keyExtractor={(x) => x.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await loadHistory();
                } catch (e) {
                  setHistoryError(formatSignInError(e));
                } finally {
                  setRefreshing(false);
                }
              }}
            />
          }
          ListEmptyComponent={
            <Card>
              <Text style={styles.empty}>
                {historyLoading ? "Loading history…" : "No move-out history yet."}
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Card>
              <InfoGrid
                rows={[
                  [
                    { label: "Dorm", value: item.propertyName },
                    { label: "Room", value: item.roomNo },
                  ],
                  [
                    { label: "Lease start", value: item.leaseStart },
                    { label: "Lease end", value: item.leaseEnd },
                  ],
                  [
                    { label: "Move-out date", value: item.moveOutDate || "—" },
                    {
                      label: "Ended",
                      value: item.endedAt
                        ? new Date(item.endedAt).toLocaleString()
                        : "—",
                    },
                  ],
                  [
                    {
                      label: "Advance",
                      value:
                        item.advanceAmount > 0
                          ? `₱${item.advanceAmount.toLocaleString()}`
                          : "—",
                    },
                    {
                      label: "Deposit",
                      value:
                        item.depositAmount > 0
                          ? `₱${item.depositAmount.toLocaleString()}`
                          : "—",
                    },
                  ],
                ]}
              />
              <View style={styles.badges}>
                <Badge
                  label={item.status}
                  tone={item.status === "MoveOut" ? "success" : "warning"}
                />
                <Badge
                  label={item.rentPaymentStatus || "—"}
                  tone={
                    item.rentPaymentStatus === "Paid"
                      ? "success"
                      : item.rentPaymentStatus === "Overdue"
                        ? "danger"
                        : "warning"
                  }
                />
              </View>
              {!!item.endedReason && (
                <Text style={styles.note}>Note: {item.endedReason}</Text>
              )}
            </Card>
          )}
        />
      )}

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
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  actions: { marginTop: 12 },
  note: { fontSize: 12, color: "#475569", marginTop: 8 },
});
