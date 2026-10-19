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

type TabView = "reservations" | "history";

type HistoryRow = {
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
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString();
}

function formatCurrency(value?: number) {
  if (value == null || Number.isNaN(value)) return "—";
  return `₱${Number(value).toLocaleString()}`;
}

export default function LandlordReservationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("reservations");
  const [historyItems, setHistoryItems] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editingPayments, setEditingPayments] = useState<LandlordReservation | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    rentPaymentStatus: "",
    depositAmount: "",
    advanceAmount: "",
    balanceRemaining: "",
    nextPaymentDueDate: "",
  });

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<{ reservations: LandlordReservation[] }>(
      "/api/landlord/reservations",
      { token }
    );
    setItems(res.reservations ?? []);
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await apiRequest<{
        history: HistoryRow[];
      }>("/api/landlord/reservations/history", { token });
      setHistoryItems(res.history ?? []);
    } catch (e) {
      setHistoryError(formatSignInError(e));
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  const resetPaymentForm = (item: LandlordReservation) => {
    const raw = (item as unknown as Record<string, unknown>);
    setPaymentForm({
      rentPaymentStatus:
        (typeof raw.rent_payment_status === "string"
          ? raw.rent_payment_status
          : item.rentPaymentStatus) || "",
      depositAmount:
        (typeof raw.deposit_amount === "string"
          ? raw.deposit_amount
          : item.depositAmount != null
            ? String(item.depositAmount)
            : "") || "",
      advanceAmount:
        (typeof raw.advance_amount === "string"
          ? raw.advance_amount
          : item.advanceAmount != null
            ? String(item.advanceAmount)
            : "") || "",
      balanceRemaining:
        (typeof raw.balance_remaining === "string"
          ? raw.balance_remaining
          : item.balanceRemaining != null
            ? String(item.balanceRemaining)
            : "") || "",
      nextPaymentDueDate:
        (typeof raw.next_payment_due_date === "string"
          ? raw.next_payment_due_date
          : "") || "",
    });
    setEditingPayments(item);
  };

  const savePayments = async () => {
    if (!token || !editingPayments) return;
    setSavingId(editingPayments.id);
    try {
      await apiRequest(
        `/api/landlord/student-reservations/${editingPayments.id}`,
        {
          method: "PATCH",
          token,
          body: {
            rentPaymentStatus: paymentForm.rentPaymentStatus || undefined,
            depositAmount:
              paymentForm.depositAmount.trim() !== ""
                ? Number(paymentForm.depositAmount)
                : undefined,
            advanceAmount:
              paymentForm.advanceAmount.trim() !== ""
                ? Number(paymentForm.advanceAmount)
                : undefined,
            balanceRemaining:
              paymentForm.balanceRemaining.trim() !== ""
                ? Number(paymentForm.balanceRemaining)
                : undefined,
            nextPaymentDueDate:
              paymentForm.nextPaymentDueDate.trim() !== ""
                ? paymentForm.nextPaymentDueDate.trim()
                : null,
          },
        }
      );
      setEditingPayments(null);
      await load();
    } catch (e) {
      Alert.alert(
        "Could not update payments",
        e instanceof Error ? e.message : "Request failed."
      );
    } finally {
      setSavingId(null);
    }
  };

  const approveMoveOut = (item: LandlordReservation) => {
    Alert.alert(
      "Approve move-out?",
      `Mark ${item.name} as moved out from ${item.dormName} · Room ${item.roomNo}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          style: "default",
          onPress: async () => {
            if (!token) return;
            setSavingId(item.id);
            try {
              await apiRequest(
                `/api/landlord/student-reservations/${item.id}`,
                {
                  method: "PATCH",
                  token,
                  body: {
                    moveOut: true,
                    moveOutDate: item.leaseEndDate || undefined,
                    notes: "Approved by landlord",
                  },
                }
              );
              await load();
            } catch (e) {
              Alert.alert(
                "Could not approve move-out",
                e instanceof Error ? e.message : "Request failed."
              );
            } finally {
              setSavingId(null);
            }
          },
        },
      ]
    );
  };

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
      <Title style={{ color: colors.brand }}>Reservations</Title>
      <Subtitle>
        {activeTab === "reservations"
          ? "Student and manual reservations"
          : "Archived move-out records"}
      </Subtitle>

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
                      onPress={() =>
                        decideExtension(item, "Approved")
                      }
                      disabled={savingId === item.id}
                      loading={savingId === item.id}
                    />
                    <View style={{ height: 8 }} />
                    <Button
                      label="Decline extension"
                      variant="danger"
                      onPress={() =>
                        decideExtension(item, "Rejected")
                      }
                      disabled={savingId === item.id}
                    />
                  </View>
                </>
              ) : null}
              <View style={styles.actions}>
                <Button
                  label="Edit payments"
                  variant="outline"
                  onPress={() => resetPaymentForm(item)}
                />
                <View style={{ height: 8 }} />
                <Button
                  label="Approve move-out"
                  variant="danger"
                  onPress={() => approveMoveOut(item)}
                  disabled={savingId === item.id}
                  loading={savingId === item.id}
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
              <Text style={styles.name}>{item.tenantName}</Text>
              <Text style={styles.meta}>
                {item.propertyName} · Room {item.roomNo}
              </Text>
              <Text style={styles.meta}>
                Lease: {item.leaseStart} → {item.leaseEnd}
              </Text>
              <Text style={styles.meta}>
                Move-out: {item.moveOutDate || "—"}
              </Text>
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
              <Text style={styles.meta}>
                Advance: {formatCurrency(item.advanceAmount)} · Deposit:{" "}
                {formatCurrency(item.depositAmount)} · Balance:{" "}
                {formatCurrency(item.balanceRemaining)}
              </Text>
              {!!item.endedReason && (
                <Text style={styles.meta}>Note: {item.endedReason}</Text>
              )}
              <Text style={[styles.meta, styles.endedAt]}>
                Ended:{" "}
                {item.endedAt
                  ? new Date(item.endedAt).toLocaleString()
                  : "—"}
              </Text>
            </Card>
          )}
        />
      )}

      {editingPayments ? (
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit payments</Text>
            <Text style={styles.modalSubtitle}>
              {editingPayments.dormName} · Room {editingPayments.roomNo}
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>Rent payment status</Text>
              <View style={styles.pillRow}>
                {["Paid", "Pending", "Overdue"].map((option) => (
                  <Button
                    key={option}
                    label={option}
                    variant={
                      paymentForm.rentPaymentStatus === option
                        ? "sky"
                        : "outline"
                    }
                    size="sm"
                    onPress={() =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        rentPaymentStatus: option,
                      }))
                    }
                  />
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Deposit amount</Text>
              <Button
                label={paymentForm.depositAmount || "Set deposit"}
                variant="outline"
                size="sm"
                onPress={() =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    depositAmount: prev.depositAmount ? "" : "0",
                  }))
                }
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Advance amount</Text>
              <Button
                label={paymentForm.advanceAmount || "Set advance"}
                variant="outline"
                size="sm"
                onPress={() =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    advanceAmount: prev.advanceAmount ? "" : "0",
                  }))
                }
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Balance remaining</Text>
              <Button
                label={paymentForm.balanceRemaining || "Set balance"}
                variant="outline"
                size="sm"
                onPress={() =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    balanceRemaining: prev.balanceRemaining ? "" : "0",
                  }))
                }
              />
            </View>
            <View style={styles.actions}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setEditingPayments(null)}
              />
              <Button
                label="Save"
                variant="sky"
                onPress={savePayments}
                loading={savingId === editingPayments.id}
              />
            </View>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.muted },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  actions: { marginTop: 12 },
  endedAt: { marginTop: 4 },
  modalOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  field: {
    marginTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
