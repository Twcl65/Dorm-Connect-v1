import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type PaymentRow,
  type UnpaidRentMonth,
} from "@/lib/api";
import { PaymentDetailModal } from "@/components/payment-detail-modal";
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

type PaymentFilter = "all" | "manual" | "not_yet_paid";

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
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [unpaidMonths, setUnpaidMonths] = useState<UnpaidRentMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [selected, setSelected] = useState<PaymentRow | null>(null);

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
    if (filter === "manual") {
      return items.filter(isManualPayment);
    }
    if (filter === "all") return items;
    return [];
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      all: items.length,
      manual: items.filter(isManualPayment).length,
      notYetPaid: unpaidMonths.length,
    }),
    [items, unpaidMonths]
  );

  const showUnpaidMonths = filter === "not_yet_paid";

  if (loading && items.length === 0 && unpaidMonths.length === 0) {
    return <CenteredLoader />;
  }

  return (
    <Screen>
      <Title>Payments</Title>
      <Subtitle>
        Student app and manual payments, plus rent months not yet paid
      </Subtitle>

      <View style={styles.filters}>
        {(
          [
            ["all", "All", counts.all],
            ["manual", "Manual", counts.manual],
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
                  : filter === "manual"
                    ? "No manual payments recorded."
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
                <Badge
                  label={sourceTypeLabel(item)}
                  tone={isManualPayment(item) ? "default" : "success"}
                />
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
              <View style={styles.badges}>
                <Badge
                  label={item.status}
                  tone={
                    item.status === "Paid"
                      ? "success"
                      : item.status === "Overdue" || item.status === "Failed"
                        ? "danger"
                        : "warning"
                  }
                />
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.receiptBtn}
                  onPress={() =>
                    router.push(
                      `/payment-receipt/${encodeURIComponent(item.id)}`
                    )
                  }
                >
                  <Text style={styles.receiptBtnText}>Receipt</Text>
                </Pressable>
                <Pressable onPress={() => setSelected(item)}>
                  <Text style={styles.detailsLink}>View details</Text>
                </Pressable>
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
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  receiptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.sky,
    backgroundColor: "#f0f9ff",
  },
  receiptBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.sky,
  },
  detailsLink: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy,
    flex: 1,
    textAlign: "right",
  },
  empty: { fontSize: 13, color: "#64748b" },
});
