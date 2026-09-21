import { Alert, Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { PaymentRow } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/config";
import { Badge, Button, Card, colors } from "@/components/ui";
import { InfoGrid } from "@/components/info-grid";
import { bottomNavPad } from "@/lib/nav-inset";

type Props = {
  visible: boolean;
  payment: PaymentRow | null;
  onClose: () => void;
};

function statusTone(status: string): "success" | "warning" | "danger" | "default" {
  if (status === "Paid") return "success";
  if (status === "Overdue" || status === "Failed") return "danger";
  return "warning";
}

function paymentTypeLabel(payment: PaymentRow) {
  return (
    payment.channelLabel ??
    (payment.source === "landlord_entry" ? "Manual" : "Student app")
  );
}

export function PaymentDetailModal({ visible, payment, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!payment) return null;

  const receiptFile =
    resolveMediaUrl(payment.receiptUrl) ??
    resolveMediaUrl(payment.proofImageUrl) ??
    resolveMediaUrl(payment.landlordProofUrl);
  const openOfficialReceipt = () => {
    onClose();
    router.push(`/payment-receipt/${encodeURIComponent(payment.id)}`);
  };

  const downloadReceipt = async () => {
    if (receiptFile) {
      try {
        await Linking.openURL(receiptFile);
      } catch {
        Alert.alert("Receipt", "Could not open the receipt file.");
      }
      return;
    }
    try {
      await Share.share({
        title: "DormConnect payment receipt",
        message: [
          `DormConnect receipt`,
          `${payment.dormName} · Room ${payment.roomNo}`,
          `Amount: ₱${payment.amount.toLocaleString()}`,
          `Status: ${payment.status}`,
          payment.paidAt ? `Paid: ${payment.paidAt}` : `Recorded: ${payment.date}`,
          payment.referenceNo ? `Ref: ${payment.referenceNo}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } catch {
      openOfficialReceipt();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {payment.dormName} · Room {payment.roomNo}
              </Text>
              {payment.location ? (
                <Text style={styles.sub}>{payment.location}</Text>
              ) : null}
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            <Card>
              <View style={styles.statusRow}>
                <Badge
                  label={payment.status}
                  tone={statusTone(payment.status)}
                />
                {payment.status !== "Paid" ? (
                  <Badge label={paymentTypeLabel(payment)} />
                ) : null}
              </View>
              <InfoGrid
                rows={[
                  [
                    {
                      label: "Amount",
                      value: `₱${payment.amount.toLocaleString()}`,
                    },
                    { label: "Method", value: payment.method || "—" },
                  ],
                  [
                    { label: "Recorded on", value: payment.date || "—" },
                    { label: "Paid on", value: payment.paidAt || "—" },
                  ],
                  [
                    {
                      label: "Paid for",
                      value: payment.leasePeriod || "—",
                    },
                    {
                      label: "Reference no.",
                      value: payment.referenceNo || "—",
                    },
                  ],
                  [
                    { label: "Landlord", value: payment.landlord || "—" },
                    { label: "Dorm", value: payment.dormName },
                  ],
                ]}
              />
              {payment.description ? (
                <Text style={styles.note}>{payment.description}</Text>
              ) : null}
            </Card>

            <Card>
              <Text style={styles.receiptLabel}>Receipt</Text>
              {receiptFile ? (
                <Image
                  source={{ uri: receiptFile }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.note}>
                  No receipt image is attached. Use View Receipt for the official
                  record.
                </Text>
              )}
            </Card>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: bottomNavPad(insets.bottom, 20) }]}>
            <Button
              label="View Receipt"
              variant="brand"
              fullWidth
              onPress={openOfficialReceipt}
            />
            <Button
              label="Download Receipt"
              variant="outline"
              fullWidth
              onPress={() => {
                void downloadReceipt();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "92%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: "700", color: colors.navy },
  sub: { fontSize: 13, color: "#64748b", marginTop: 4 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  note: { fontSize: 13, color: "#64748b", marginTop: 12, lineHeight: 18 },
  receiptLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
  },
  receiptImage: {
    width: "100%",
    height: 240,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
});
