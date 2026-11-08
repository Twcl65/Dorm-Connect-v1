import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordPayment,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/config";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function TenantPaymentsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    leaseId?: string;
    tenantName?: string;
    roomNo?: string;
  }>();
  const leaseId = params.leaseId ?? "";
  const tenantName = params.tenantName ?? "Tenant";
  const roomNo = params.roomNo ?? "";

  const [items, setItems] = useState<LandlordPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentToConfirm, setPaymentToConfirm] =
    useState<LandlordPayment | null>(null);
  const [confirmationStatus, setConfirmationStatus] = useState<
    "Paid" | "Pending"
  >("Pending");
  const [savingConfirmation, setSavingConfirmation] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null
  );
  const selectedProofUrl = paymentToConfirm?.proofOfPaymentUrl
    ? resolveMediaUrl(paymentToConfirm.proofOfPaymentUrl)
    : null;

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ payments: LandlordPayment[] }>(
      "/api/landlord/payments",
      { token }
    );
    setItems(res.payments ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const filtered = useMemo(() => {
    const name = tenantName.toLowerCase();
    return items.filter((p) => {
      if (leaseId && p.tenantLeaseId === leaseId) return true;
      return p.name.toLowerCase() === name;
    });
  }, [items, leaseId, tenantName]);

  const openConfirmation = (payment: LandlordPayment) => {
    setPaymentToConfirm(payment);
    setConfirmationStatus(payment.status === "Paid" ? "Paid" : "Pending");
    setConfirmationError(null);
  };

  const saveConfirmation = async () => {
    if (!token || !paymentToConfirm) return;
    setSavingConfirmation(true);
    setConfirmationError(null);
    try {
      await apiRequest(`/api/landlord/payments/${paymentToConfirm.id}`, {
        token,
        method: "PATCH",
        body: { status: confirmationStatus },
      });
      setItems((current) =>
        current.map((payment) =>
          payment.id === paymentToConfirm.id
            ? { ...payment, status: confirmationStatus }
            : payment
        )
      );
      setPaymentToConfirm(null);
      try {
        await load();
      } catch (e) {
        setError(formatSignInError(e));
      }
    } catch (e) {
      setConfirmationError(formatSignInError(e));
    } finally {
      setSavingConfirmation(false);
    }
  };

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>{`${tenantName} · Room ${roomNo}`}</Subtitle>
      <Text style={styles.hint}>All payment transactions for this tenant</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(p) => `${p.source}-${p.id}`}
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
            <Text style={styles.empty}>No payments recorded for this tenant.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.amount}>{item.amount}</Text>
            <Text style={styles.meta}>
              {item.method} · {item.periodLabel ?? item.date ?? "—"}
            </Text>
            <Text style={styles.meta}>
              {item.propertyName ? `${item.propertyName} · ` : ""}
              Room {item.roomNo}
            </Text>
            <Badge
              label={item.status}
              tone={
                item.status === "Paid"
                  ? "success"
                  : item.status === "Overdue"
                    ? "danger"
                    : "warning"
              }
            />
            <View style={styles.cardActions}>
              {item.status === "Pending" ? (
                <Pressable
                  style={styles.confirmBtn}
                  onPress={() => openConfirmation(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm payment"
                >
                  <Text style={styles.confirmBtnText}>Confirm Payment</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.receiptBtn}
                onPress={() =>
                  router.push(
                    `/payment-receipt/${encodeURIComponent(item.id)}?source=${item.source}`
                  )
                }
              >
                <Text style={styles.receiptBtnText}>Receipt</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />
      <Modal
        visible={paymentToConfirm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingConfirmation) setPaymentToConfirm(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>Confirm Payment</Text>
              {paymentToConfirm ? (
                <>
                  <Text style={styles.modalMeta}>
                    {paymentToConfirm.name} · Room {paymentToConfirm.roomNo}
                  </Text>
                  <Text style={styles.modalAmount}>
                    {paymentToConfirm.amount}
                  </Text>
                  <Text style={styles.modalMeta}>
                    {paymentToConfirm.method} ·{" "}
                    {paymentToConfirm.periodLabel ??
                      paymentToConfirm.date ??
                      "—"}
                  </Text>
                  <Text style={styles.modalMeta}>
                    Current status: {paymentToConfirm.status}
                  </Text>

                  <Text style={styles.modalLabel}>Proof of payment</Text>
                  {paymentToConfirm.proofOfPaymentUrl ? (
                    <>
                      {selectedProofUrl ? (
                        <Image
                          source={{ uri: selectedProofUrl }}
                          style={styles.proofImage}
                          resizeMode="contain"
                        />
                      ) : null}
                      <Pressable
                        onPress={() => {
                          const uri = resolveMediaUrl(
                            paymentToConfirm.proofOfPaymentUrl
                          );
                          if (uri) void Linking.openURL(uri);
                        }}
                      >
                        <Text style={styles.proofLink}>
                          Open proof of payment
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={styles.modalMeta}>
                      No payment proof was attached.
                    </Text>
                  )}

                  <Text style={styles.modalLabel}>Payment status</Text>
                  <View style={styles.statusOptions}>
                    {(["Paid", "Pending"] as const).map((status) => {
                      const selected = confirmationStatus === status;
                      return (
                        <Pressable
                          key={status}
                          style={[
                            styles.statusOption,
                            selected && styles.statusOptionSelected,
                          ]}
                          onPress={() => setConfirmationStatus(status)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.statusOptionText,
                              selected && styles.statusOptionTextSelected,
                            ]}
                          >
                            {status}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              {confirmationError ? (
                <Text style={styles.error}>{confirmationError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setPaymentToConfirm(null)}
                  disabled={savingConfirmation}
                />
                <Button
                  label="Confirm"
                  variant="brand"
                  loading={savingConfirmation}
                  onPress={() => void saveConfirmation()}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.muted },
  amount: { fontSize: 18, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  source: { fontSize: 11, color: colors.muted, marginTop: 6 },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  confirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.brand,
  },
  confirmBtnText: { fontSize: 12, fontWeight: "600", color: colors.white },
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
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    padding: 20,
  },
  modalCard: {
    maxHeight: "85%",
    borderRadius: 14,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  modalContent: { padding: 18 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  modalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginTop: 10,
  },
  modalMeta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginTop: 18,
    marginBottom: 8,
  },
  proofImage: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  proofLink: {
    color: colors.sky,
    fontSize: 13,
    textDecorationLine: "underline",
    marginTop: 8,
  },
  statusOptions: { flexDirection: "row", gap: 10 },
  statusOption: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 11,
  },
  statusOptionSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandMuted,
  },
  statusOptionText: { color: colors.muted, fontWeight: "500" },
  statusOptionTextSelected: { color: colors.text, fontWeight: "700" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 22,
  },
});
