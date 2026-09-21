import { useCallback, useMemo, useState } from "react";
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
  type PaymentRow,
  type UnpaidRentMonth,
} from "@/lib/api";
import { PaymentDetailModal } from "@/components/payment-detail-modal";
import { KeyboardAwareModal } from "@/components/keyboard-aware-modal";
import { GcashPaymentForm } from "@/components/gcash-payment-form";
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
import { Ionicons } from "@expo/vector-icons";
import { resolveMediaUrl } from "@/lib/config";

type PaymentFilter = "all" | "paid" | "not_yet_paid";

function isManualPayment(item: PaymentRow): boolean {
  return (
    item.source === "landlord_entry" &&
    (item.entrySource === "manual" || !item.entrySource)
  );
}

function sourceTypeLabel(item: PaymentRow): string {
  if (item.channelLabel) return item.channelLabel;
  return isManualPayment(item) ? "Manual" : "Student app";
}

export default function PaymentsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [unpaidMonths, setUnpaidMonths] = useState<UnpaidRentMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [payMonth, setPayMonth] = useState<UnpaidRentMonth | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<{
      payments: PaymentRow[];
      unpaidMonths?: UnpaidRentMonth[];
    }>("/api/student/payments", { token });
    setItems(res.payments ?? []);
    setUnpaidMonths(res.unpaidMonths ?? []);
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
          setUnpaidMonths([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const filteredPayments = useMemo(() => {
    if (filter === "paid") {
      return items.filter((p) => p.status === "Paid");
    }
    if (filter === "all") return items;
    return [];
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      all: items.length,
      paid: items.filter((p) => p.status === "Paid").length,
      notYetPaid: unpaidMonths.length,
    }),
    [items, unpaidMonths]
  );

  const showUnpaidMonths = filter === "not_yet_paid";
  const monthOptions = useMemo(
    () =>
      unpaidMonths.map((m) => ({
        value: String(m.monthNumber),
        label: `Month ${m.monthNumber} (${m.monthLabel})`,
        subtitle: `₱${m.amount.toLocaleString()} · Due ${m.dueDate}`,
      })),
    [unpaidMonths]
  );

  if (loading && items.length === 0 && unpaidMonths.length === 0) {
    return <CenteredLoader />;
  }

  return (
    <Screen>
      <Title>Payments</Title>
      <Subtitle>
        All recorded payments, paid receipts, and months not yet paid
      </Subtitle>


      <View style={styles.filters}>
        {(
          [
            ["all", "All", counts.all],
            ["paid", "Paid", counts.paid],
            ["not_yet_paid", "Not yet paid", counts.notYetPaid],
          ] as const
        ).map(([key, label, count]) => (
          <Pressable
            key={key}
            style={[
              styles.filterChip,
              filter === key && styles.filterChipActive,
            ]}
            onPress={() => setFilter(key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === key && styles.filterTextActive,
              ]}
            >
              {label}
              {count > 0 ? ` (${count})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {showUnpaidMonths ? (
        <FlatList
          data={unpaidMonths}
          keyExtractor={(m) => `${m.dueDate}-${m.monthNumber}`}
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
              <Text style={styles.empty}>
                All scheduled rent months are paid. Thank you!
              </Text>
            </Card>
          }
          renderItem={({ item: m }) => (
            <Card>
              <View style={styles.cardTop}>
                <Text style={styles.name}>
                  {m.dormName ?? "Your dorm"}
                  {m.roomNo ? ` · Room ${m.roomNo}` : ""}
                </Text>
                <Badge label="Not yet paid" tone="warning" />
              </View>
              <Text style={styles.monthTitle}>{m.monthLabel}</Text>
              <Text style={styles.meta}>
                ₱{m.amount.toLocaleString()} · Month {m.monthNumber}
              </Text>
              <Text style={styles.meta}>{m.dueLabel}</Text>
              <Text style={styles.meta}>Due date: {m.dueDate}</Text>
              <View style={styles.cardActions}>
                <Button
                  label="Pay now"
                  variant="brand"
                  onPress={() => {
                    setPayError(null);
                    setPayMonth(m);
                  }}
                />
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={filteredPayments}
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
              <Text style={styles.empty}>
                {items.length === 0
                  ? "No payments recorded yet."
                  : filter === "paid"
                    ? "No paid payments yet."
                    : "No payments match this filter."}
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.cardTop}>
                <Text style={styles.name}>
                  {item.dormName} · Room {item.roomNo}
                </Text>
                {item.status === "Paid" ? (
                  <Badge label="Paid" tone="success" />
                ) : (
                  <Badge
                    label={sourceTypeLabel(item)}
                    tone={isManualPayment(item) ? "default" : "success"}
                  />
                )}
              </View>
              <Text style={styles.meta}>
                ₱{item.amount.toLocaleString()} · {item.method}
              </Text>
              <Text style={styles.meta}>{item.date}</Text>
              {item.leasePeriod ? (
                <Text style={styles.meta}>{item.leasePeriod}</Text>
              ) : null}
              {item.paidAt ? (
                <Text style={styles.meta}>Paid: {item.paidAt}</Text>
              ) : null}
              {item.referenceNo ? (
                <Text style={styles.meta}>Ref: {item.referenceNo}</Text>
              ) : null}
              {item.status !== "Paid" ? (
                <View style={styles.badges}>
                  <Badge
                    label={item.status}
                    tone={
                      item.status === "Overdue" || item.status === "Failed"
                        ? "danger"
                        : "warning"
                    }
                  />
                </View>
              ) : null}
              <View style={styles.cardActions}>
                <Button
                  label="View details"
                  variant="sky"
                  onPress={() => setSelected(item)}
                />
              </View>
            </Card>
          )}
        />
      )}

      <PaymentDetailModal
        visible={selected != null}
        payment={selected}
        onClose={() => setSelected(null)}
      />

      <KeyboardAwareModal
        visible={payMonth != null}
        onRequestClose={() => setPayMonth(null)}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Pay now</Text>
          <Pressable onPress={() => setPayMonth(null)} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.navy} />
          </Pressable>
        </View>
        {payError ? <Text style={styles.error}>{payError}</Text> : null}
        {token && payMonth?.reservationId ? (
          <GcashPaymentForm
            key={`${payMonth.reservationId}-${payMonth.monthNumber}`}
            token={token}
            target={{
              reservationId: payMonth.reservationId,
              amount: payMonth.amount,
              landlordName: payMonth.landlordName || "Landlord",
              gcashAccountName: payMonth.gcashAccountName,
              gcashPhone: payMonth.gcashPhone,
              gcashQrCodeUrl: resolveMediaUrl(payMonth.gcashQrCodeUrl),
              monthNumber: payMonth.monthNumber,
              description: `GCash rent — ${payMonth.monthLabel}`,
            }}
            monthOptions={monthOptions}
            selectedMonthValue={String(payMonth.monthNumber)}
            onMonthChange={(val) => {
              const month = unpaidMonths.find(
                (m) => String(m.monthNumber) === val
              );
              if (month) setPayMonth(month);
            }}
            onSuccess={() => {
              setPayMonth(null);
              void load();
            }}
            onError={setPayError}
          />
        ) : (
          <Text style={styles.empty}>This month cannot be paid yet.</Text>
        )}
      </KeyboardAwareModal>


    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  filterChipActive: { backgroundColor: colors.navy },
  filterText: { fontSize: 13, color: "#475569", fontWeight: "500" },
  filterTextActive: { color: "#fff" },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  monthTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 6,
  },
  meta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  cardActions: { marginTop: 12 },
  empty: { fontSize: 13, color: "#64748b" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
});
