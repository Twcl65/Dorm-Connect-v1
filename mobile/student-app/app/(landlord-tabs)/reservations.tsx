import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordOnsiteRoom,
  type LandlordPayment,
  type LandlordReservation,
} from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { SelectField } from "@/components/select-field";

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
  const [viewingPayments, setViewingPayments] = useState<LandlordReservation | null>(null);
  const [paymentTotal, setPaymentTotal] = useState<number | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [balanceAction, setBalanceAction] = useState<{
    type: "advance" | "deposit";
    action: "withdraw" | "use";
  } | null>(null);
  const [balanceEditType, setBalanceEditType] = useState<
    "advance" | "deposit" | null
  >(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceActionError, setBalanceActionError] = useState<string | null>(null);
  const [balanceActionSaving, setBalanceActionSaving] = useState(false);
  const [balanceActionLoading, setBalanceActionLoading] = useState(false);
  const [onsiteRoom, setOnsiteRoom] = useState<LandlordOnsiteRoom | null>(null);
  const [selectedMonthNumber, setSelectedMonthNumber] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");

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

  const openPaymentDetails = async (item: LandlordReservation) => {
    setViewingPayments(item);
    setPaymentTotal(null);
    setDetailsError(null);
    setBalanceAction(null);
    setDetailsLoading(true);
    try {
      const res = await apiRequest<{ payments: LandlordPayment[] }>(
        "/api/landlord/payments",
        { token }
      );
      const total = (res.payments ?? [])
        .filter(
          (payment) =>
            payment.reservationId === item.id &&
            payment.status === "Paid" &&
            payment.source !== "advance" &&
            payment.source !== "deposit"
        )
        .reduce((sum, payment) => sum + Number(payment.amountValue ?? 0), 0);
      setPaymentTotal(total);
    } catch (e) {
      setDetailsError(formatSignInError(e));
    } finally {
      setDetailsLoading(false);
    }
  };

  const startBalanceAction = async (
    type: "advance" | "deposit",
    action: "withdraw" | "use"
  ) => {
    setBalanceEditType(null);
    setBalanceAction({ type, action });
    setBalanceAmount("");
    setBalanceActionError(null);
    setOnsiteRoom(null);
    setSelectedMonthNumber("");
    if (action !== "use" || !token || !viewingPayments) return;

    setBalanceActionLoading(true);
    try {
      const res = await apiRequest<{ rooms: LandlordOnsiteRoom[] }>(
        "/api/landlord/payments/onsite-hints",
        { token }
      );
      const room = (res.rooms ?? []).find(
        (candidate) => candidate.studentReservationId === viewingPayments.id
      );
      if (!room) {
        setBalanceActionError("Could not find this tenant's payment schedule.");
        return;
      }
      setOnsiteRoom(room);
      setSelectedMonthNumber(
        room.unpaidMonths[0] ? String(room.unpaidMonths[0].monthNumber) : ""
      );
    } catch (e) {
      setBalanceActionError(formatSignInError(e));
    } finally {
      setBalanceActionLoading(false);
    }
  };

  const submitBalanceAction = async () => {
    if (!token || !viewingPayments || !balanceAction) return;
    const amount = Number(balanceAmount);
    const available =
      balanceAction.type === "advance"
        ? Number(viewingPayments.advanceAmount ?? 0)
        : Number(viewingPayments.depositAmount ?? 0);
    if (
      balanceAction.action === "withdraw" &&
      (!Number.isFinite(amount) || amount <= 0)
    ) {
      setBalanceActionError("Enter an amount greater than zero.");
      return;
    }
    if (balanceAction.action === "withdraw" && amount > available) {
      setBalanceActionError(
        `Amount exceeds the available ${balanceAction.type === "advance" ? "advance" : "security deposit"} balance of ${formatCurrency(available)}.`
      );
      return;
    }
    if (balanceAction.action === "use" && (!onsiteRoom || !selectedMonthNumber)) {
      setBalanceActionError("Select an unpaid rent month.");
      return;
    }

    setBalanceActionSaving(true);
    setBalanceActionError(null);
    try {
      let appliedAmount = amount;
      if (balanceAction.action === "withdraw") {
        await apiRequest(
          `/api/landlord/student-reservations/${viewingPayments.id}/balance-actions`,
          {
            method: "POST",
            token,
            body: { type: balanceAction.type, amount },
          }
        );
      } else {
        const result = await apiRequest<{
          advanceRemaining: number;
          depositRemaining: number;
        }>("/api/landlord/lease-payment-monitoring/apply-credit", {
          method: "POST",
          token,
          body: {
            reservationId: viewingPayments.id,
            fundSource: balanceAction.type,
            monthNumber: Number(selectedMonthNumber),
            paidOn: new Date().toISOString().slice(0, 10),
          },
        });
        const remaining =
          balanceAction.type === "advance"
            ? Number(result.advanceRemaining)
            : Number(result.depositRemaining);
        appliedAmount = Math.max(0, available - remaining);
      }
      const actionLabel =
        balanceAction.action === "withdraw" ? "withdrawn" : "applied to rent";
      setViewingPayments(null);
      setBalanceAction(null);
      try {
        await load();
      } catch (e) {
        setError(formatSignInError(e));
      }
      Alert.alert(
        "Balance updated",
        `${formatCurrency(appliedAmount)} ${actionLabel}.`
      );
    } catch (e) {
      setBalanceActionError(formatSignInError(e));
    } finally {
      setBalanceActionSaving(false);
    }
  };

  const decideExtension = async (
    item: LandlordReservation,
    decision: "Approved" | "Rejected"
  ) => {
    if (!token) return;
    setSavingId(item.id);
    try {
      await apiRequest(`/api/landlord/student-reservations/${item.id}`, {
        method: "PATCH",
        token,
        body: { leaseExtension: decision },
      });
      await load();
    } catch (e) {
      Alert.alert(
        "Could not update extension",
        e instanceof Error ? e.message : "Request failed."
      );
    } finally {
      setSavingId(null);
    }
  };

  const confirmReservation = async (item: LandlordReservation) => {
    if (!token) return;
    setSavingId(item.id);
    try {
      const path =
        item.source === "student"
          ? `/api/landlord/student-reservations/${item.id}`
          : `/api/landlord/reservations/${item.id}`;
      await apiRequest(path, {
        method: "PATCH",
        token,
        body: { status: "Confirmed" },
      });
      await load();
    } catch (e) {
      Alert.alert(
        "Could not confirm reservation",
        e instanceof Error ? e.message : "Request failed."
      );
    } finally {
      setSavingId(null);
    }
  };

  const rejectReservation = async (item: LandlordReservation) => {
    if (!token || !rejectRemarks.trim()) return;
    setSavingId(item.id);
    try {
      const path =
        item.source === "student"
          ? `/api/landlord/student-reservations/${item.id}`
          : `/api/landlord/reservations/${item.id}`;
      await apiRequest(path, {
        method: "PATCH",
        token,
        body: { status: "Cancelled", notes: rejectRemarks.trim() },
      });
      setRejectingId(null);
      setRejectRemarks("");
      await load();
    } catch (e) {
      Alert.alert(
        "Could not decline reservation",
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
          onPress={() => setActiveTab("reservations")}
        />
        <Button
          label="History"
          variant={activeTab === "history" ? "sky" : "outline"}
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
          renderItem={({ item }) => {
            return (
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
              {item.reservationStatus === "Pending" ? (
                <Text style={styles.meta}>
                  Awaiting your confirmation; this is not an active stay.
                </Text>
              ) : null}
              {item.rentPaymentStatus ? (
                <Text style={styles.meta}>Rent: {item.rentPaymentStatus}</Text>
              ) : null}
              {item.reservationStatus === "Pending" ? (
                <View style={styles.actions}>
                  <Button
                    label="Confirm reservation"
                    variant="brand"
                    onPress={() => void confirmReservation(item)}
                    disabled={savingId === item.id}
                    loading={savingId === item.id}
                  />
                  <Button
                    label="Reject reservation"
                    variant="danger"
                    onPress={() => {
                      setRejectingId(item.id);
                      setRejectRemarks("");
                    }}
                    disabled={savingId === item.id}
                  />
                </View>
              ) : null}
              {rejectingId === item.id ? (
                <View style={styles.rejectBox}>
                  <Text style={styles.label}>Reason for rejection (required)</Text>
                  <TextInput
                    value={rejectRemarks}
                    onChangeText={setRejectRemarks}
                    placeholder="Room already reserved, no longer available, or another reason"
                    multiline
                    textAlignVertical="top"
                    style={styles.rejectInput}
                  />
                  <View style={styles.actions}>
                    <Button
                      label="Back"
                      variant="outline"
                      onPress={() => setRejectingId(null)}
                      disabled={savingId === item.id}
                    />
                    <Button
                      label="Send rejection"
                      variant="danger"
                      onPress={() => void rejectReservation(item)}
                      disabled={!rejectRemarks.trim() || savingId === item.id}
                      loading={savingId === item.id}
                    />
                  </View>
                </View>
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
              {item.source === "student" &&
              item.reservationStatus === "Confirmed" ? (
                <View style={styles.actions}>
                  {item.leaseExtension?.status === "Pending" ? (
                    <Button
                      label="Approve extend lease"
                      variant="sky"
                      onPress={() => decideExtension(item, "Approved")}
                      disabled={savingId === item.id}
                      loading={savingId === item.id}
                    />
                  ) : (
                    <Button
                      label="View Balance & Payment Details"
                      variant="outline"
                      onPress={() => void openPaymentDetails(item)}
                    />
                  )}
                  <View style={{ height: 8 }} />
                  <Button
                    label="Approve move-out"
                    variant="danger"
                    onPress={() => approveMoveOut(item)}
                    disabled={savingId === item.id}
                    loading={savingId === item.id}
                  />
                </View>
              ) : null}
            </Card>
            );
          }}
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

      {viewingPayments ? (
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Balance & Payment Details</Text>
              <Text style={styles.modalSubtitle}>
                {viewingPayments.name} · {viewingPayments.dormName} · Room{" "}
                {viewingPayments.roomNo}
              </Text>
              {detailsLoading ? (
                <Text style={styles.meta}>Loading payment details…</Text>
              ) : null}
              {detailsError ? (
                <Text style={styles.error}>{detailsError}</Text>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Total Balance</Text>
                <Text style={styles.balanceValue}>
                  {formatCurrency(viewingPayments.balanceRemaining ?? 0)}
                </Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Total Payments Made</Text>
                <Text style={styles.balanceValue}>
                  {paymentTotal === null
                    ? detailsLoading
                      ? "Loading…"
                      : "Unavailable"
                    : formatCurrency(paymentTotal)}
                </Text>
              </View>

              {([
                {
                  type: "deposit" as const,
                  label: "Security Deposit Amount",
                  amount: viewingPayments.depositAmount ?? 0,
                },
                {
                  type: "advance" as const,
                  label: "Advance Payment Amount",
                  amount: viewingPayments.advanceAmount ?? 0,
                },
              ]).map((balance) => (
                <View key={balance.type} style={styles.balanceSection}>
                  <View style={styles.balanceRow}>
                    <View style={styles.balanceInfo}>
                      <Text style={styles.label}>{balance.label}</Text>
                      <Text style={styles.balanceValue}>
                        {formatCurrency(balance.amount)}
                      </Text>
                    </View>
                    <Button
                      label={
                        balanceEditType === balance.type ? "Done" : "Edit"
                      }
                      variant="outline"
                      onPress={() =>
                        setBalanceEditType((current) =>
                          current === balance.type ? null : balance.type
                        )
                      }
                      disabled={balanceActionSaving}
                    />
                  </View>
                  {balanceEditType === balance.type ? (
                    <View style={styles.balanceActions}>
                      <Button
                        label="Withdraw"
                        variant="outline"
                        onPress={() =>
                          void startBalanceAction(balance.type, "withdraw")
                        }
                        disabled={balance.amount <= 0 || balanceActionSaving}
                      />
                      <Button
                        label="Use for rent"
                        variant="sky"
                        onPress={() =>
                          void startBalanceAction(balance.type, "use")
                        }
                        disabled={balance.amount <= 0 || balanceActionSaving}
                      />
                    </View>
                  ) : null}
                </View>
              ))}

              {balanceAction ? (
                <View style={styles.actionPanel}>
                  <Text style={styles.label}>
                    {balanceAction.action === "withdraw"
                      ? "Withdraw amount"
                      : "Apply to rent"}
                    {" · "}
                    {balanceAction.type === "advance"
                      ? "Advance payment"
                      : "Security deposit"}
                  </Text>
                  <Text style={styles.meta}>
                    Available:{" "}
                    {formatCurrency(
                      balanceAction.type === "advance"
                        ? viewingPayments.advanceAmount ?? 0
                        : viewingPayments.depositAmount ?? 0
                    )}
                  </Text>
                  {balanceActionLoading ? (
                    <Text style={styles.meta}>Loading unpaid rent months…</Text>
                  ) : null}
                  {balanceAction.action === "use" && onsiteRoom ? (
                    <SelectField
                      label="Rent month due"
                      placeholder="Select an unpaid month"
                      value={selectedMonthNumber}
                      options={onsiteRoom.unpaidMonths.map((month) => ({
                        value: String(month.monthNumber),
                        label: month.monthLabel,
                      }))}
                      onChange={setSelectedMonthNumber}
                      emptyMessage="There are no unpaid rent months."
                    />
                  ) : null}
                  {balanceAction.action === "withdraw" ? (
                    <Input
                      value={balanceAmount}
                      onChangeText={setBalanceAmount}
                      keyboardType="decimal-pad"
                      placeholder="Amount (₱)"
                    />
                  ) : (
                    <Text style={styles.meta}>
                      The full amount due for the selected month will be deducted
                      from this balance.
                    </Text>
                  )}
                  {balanceActionError ? (
                    <Text style={styles.error}>{balanceActionError}</Text>
                  ) : null}
                  <View style={styles.actions}>
                    <Button
                      label="Cancel"
                      variant="outline"
                      onPress={() => {
                        setBalanceAction(null);
                        setBalanceEditType(null);
                      }}
                      disabled={balanceActionSaving}
                    />
                    <Button
                      label={
                        balanceAction.action === "withdraw"
                          ? "Confirm withdrawal"
                          : "Apply to selected month"
                      }
                      variant="sky"
                      onPress={() => void submitBalanceAction()}
                      loading={balanceActionSaving}
                      disabled={
                        balanceActionLoading ||
                        (balanceAction.action === "use" &&
                          (!onsiteRoom || onsiteRoom.unpaidMonths.length === 0))
                      }
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Button
                  label="Close"
                  variant="outline"
                  onPress={() => setViewingPayments(null)}
                  disabled={balanceActionSaving}
                />
              </View>
            </ScrollView>
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
  balanceSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  actionPanel: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: colors.border,
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
  rejectBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  rejectInput: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.white,
  },
});
