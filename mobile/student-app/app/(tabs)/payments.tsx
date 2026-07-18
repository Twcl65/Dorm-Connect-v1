import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type PaymentRow,
  type UnpaidRentMonth,
} from "@/lib/api";
import { PaymentDetailModal } from "@/components/payment-detail-modal";
import { Ionicons } from "@expo/vector-icons";
import { SelectField } from "@/components/select-field";
import {
  Badge,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  Title,
  colors,
  Input,
  Button,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { pickImagesFromLibrary } from "@/lib/landlord-rooms";
import { uploadMobileFile } from "@/lib/upload";

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

  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<UnpaidRentMonth | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payProofImage, setPayProofImage] = useState<{ uri: string; fileName: string; mimeType: string } | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
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

  const handlePaySubmit = async () => {
    if (!selectedMonth) {
      setPayError("Please select a month to pay.");
      return;
    }
    if (!payAmount || Number(payAmount) <= 0) {
      setPayError("Please enter a valid amount.");
      return;
    }
    if (!payProofImage) {
      setPayError("Please select a GCash receipt screenshot.");
      return;
    }

    setPaySubmitting(true);
    setPayError(null);
    try {
      const imageUrl = await uploadMobileFile(
        token!,
        payProofImage.uri,
        payProofImage.fileName,
        payProofImage.mimeType
      );

      await apiRequest("/api/student/payments", {
        token,
        method: "POST",
        body: {
          reservationId: selectedMonth.reservationId,
          amount: Number(payAmount),
          method: "GCash",
          status: "Pending",
          proofImageUrl: imageUrl,
          scheduleMonthNumber: selectedMonth.monthNumber,
        },
      });

      setPayModalVisible(false);
      setSelectedMonth(null);
      setPayAmount("");
      setPayProofImage(null);
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setPaySubmitting(false);
    }
  };

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

      {unpaidMonths.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Button
            label="Submit GCash Payment"
            variant="brand"
            onPress={() => {
              setPayModalVisible(true);
              setPayError(null);
              if (unpaidMonths.length > 0) {
                const first = unpaidMonths[0];
                setSelectedMonth(first);
                setPayAmount(String(first.amount));
              }
            }}
          />
        </View>
      )}

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
              <View style={{ marginTop: 10 }}>
                <Button
                  label="Pay Now"
                  variant="brand"
                  onPress={() => {
                    setPayModalVisible(true);
                    setPayError(null);
                    setSelectedMonth(m);
                    setPayAmount(String(m.amount));
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

      {/* Pay Modal */}
      <Modal visible={payModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit GCash Payment</Text>
              <Pressable
                onPress={() => setPayModalVisible(false)}
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 24 }}>
              {payError && <Text style={styles.modalError}>{payError}</Text>}

              <Text style={styles.modalLabel}>Select rent month to pay</Text>
              {unpaidMonths.map((m) => {
                const isSelected = selectedMonth?.monthNumber === m.monthNumber;
                return (
                  <Pressable
                    key={m.monthNumber}
                    onPress={() => {
                      setSelectedMonth(m);
                      setPayAmount(String(m.amount));
                    }}
                    style={[
                      styles.monthSelectBtn,
                      isSelected && styles.monthSelectBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthSelectText,
                        isSelected && styles.monthSelectTextActive,
                      ]}
                    >
                      Month {m.monthNumber} ({m.monthLabel}) - ₱{m.amount.toLocaleString()}
                    </Text>
                  </Pressable>
                );
              })}

              <Text style={[styles.modalLabel, { marginTop: 14 }]}>Amount (₱)</Text>
              <Input
                keyboardType="numeric"
                value={payAmount}
                onChangeText={setPayAmount}
                placeholder="0.00"
              />

              <Text style={styles.modalLabel}>Attach GCash Receipt screenshot</Text>
              {payProofImage ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: payProofImage.uri }} style={styles.imagePreview} />
                  <Text style={styles.imageName}>{payProofImage.fileName}</Text>
                  <Button
                    label="Change Photo"
                    variant="outline"
                    onPress={async () => {
                      const picked = await pickImagesFromLibrary(1);
                      if (picked && picked[0]) {
                        setPayProofImage(picked[0]);
                      }
                    }}
                  />
                </View>
              ) : (
                <Button
                  label="Select GCash Receipt Photo"
                  variant="outline"
                  onPress={async () => {
                    const picked = await pickImagesFromLibrary(1);
                    if (picked && picked[0]) {
                      setPayProofImage(picked[0]);
                    }
                  }}
                />
              )}

              <View style={{ marginTop: 24 }}>
                <Button
                  label={paySubmitting ? "Submitting..." : "Submit Payment"}
                  variant="brand"
                  disabled={paySubmitting || !selectedMonth || !payAmount || !payProofImage}
                  onPress={handlePaySubmit}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "600",
  },
  modalScroll: {
    padding: 16,
  },
  modalError: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 12,
    fontWeight: "500",
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  monthSelectBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  monthSelectBtnActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandMuted,
  },
  monthSelectText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },
  monthSelectTextActive: {
    color: colors.brandDark,
    fontWeight: "600",
  },
  imagePreviewWrap: {
    alignItems: "center",
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    resizeMode: "contain",
    marginBottom: 8,
  },
  imageName: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
  },
});
