import { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { PaymentRow } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/config";
import { Badge, Button, Card, colors } from "@/components/ui";

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

function isImageAttachment(url: string): boolean {
  const lower = url.split("?")[0]?.toLowerCase() ?? "";
  return (
    !lower.endsWith(".pdf") &&
    !lower.endsWith(".doc") &&
    !lower.endsWith(".docx")
  );
}

function ProofAttachment({
  label,
  url,
  caption,
}: {
  label: string;
  url: string;
  caption?: string;
}) {
  const resolved = resolveMediaUrl(url);
  const [lightbox, setLightbox] = useState(false);

  if (!resolved) return null;

  const showImage = isImageAttachment(resolved);

  return (
    <View style={styles.proofBlock}>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.proofCaption}>{caption}</Text> : null}
      {showImage ? (
        <>
          <Pressable
            onPress={() => setLightbox(true)}
            style={styles.proofImageWrap}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${label}, tap to enlarge`}
          >
            <Image
              source={{ uri: resolved }}
              style={styles.proofImage}
              resizeMode="contain"
            />
          </Pressable>
          <Text style={styles.tapHint}>Tap to enlarge</Text>
          <Modal visible={lightbox} transparent animationType="fade">
            <Pressable style={styles.lightbox} onPress={() => setLightbox(false)}>
              <Pressable
                style={styles.lightboxClose}
                onPress={() => setLightbox(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
              <Image
                source={{ uri: resolved }}
                style={styles.lightboxImage}
                resizeMode="contain"
                accessibilityLabel={label}
              />
            </Pressable>
          </Modal>
        </>
      ) : (
        <Pressable
          onPress={() => void Linking.openURL(resolved)}
          style={styles.docLink}
        >
          <Ionicons name="document-outline" size={18} color={colors.sky} />
          <Text style={styles.docLinkText}>Open document</Text>
        </Pressable>
      )}
    </View>
  );
}

export function PaymentDetailModal({ visible, payment, onClose }: Props) {
  const router = useRouter();
  const attachments = useMemo(() => {
    if (!payment) return [];
    const list: { key: string; label: string; url: string; caption?: string }[] =
      [];
    if (payment.proofImageUrl) {
      list.push({
        key: "proof",
        label: "Payment proof",
        url: payment.proofImageUrl,
        caption: "Attachment from your payment submission.",
      });
    }
    if (payment.landlordProofUrl) {
      list.push({
        key: "landlord",
        label: "Landlord proof",
        url: payment.landlordProofUrl,
        caption: "Uploaded when your landlord recorded this payment.",
      });
    }
    if (payment.receiptUrl) {
      list.push({
        key: "receipt",
        label: "Receipt",
        url: payment.receiptUrl,
        caption: "Uploaded receipt reference.",
      });
    }
    return list;
  }, [payment]);

  if (!payment) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
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
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.navy} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            <Card>
              <Text style={styles.label}>Payment type</Text>
              <Text style={styles.value}>
                {payment.channelLabel ??
                  (payment.source === "landlord_entry"
                    ? "Manual"
                    : "Student app")}
              </Text>
              <Text style={styles.label}>Status</Text>
              <Badge label={payment.status} tone={statusTone(payment.status)} />
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.value}>
                ₱{payment.amount.toLocaleString()}
              </Text>
              <Text style={styles.label}>Method</Text>
              <Text style={styles.value}>{payment.method}</Text>
              <Text style={styles.label}>Recorded on</Text>
              <Text style={styles.value}>{payment.date}</Text>
              {payment.paidAt ? (
                <>
                  <Text style={styles.label}>Paid on</Text>
                  <Text style={styles.value}>{payment.paidAt}</Text>
                </>
              ) : null}
              {payment.referenceNo ? (
                <>
                  <Text style={styles.label}>Reference no.</Text>
                  <Text style={styles.value}>{payment.referenceNo}</Text>
                </>
              ) : null}
              {payment.leasePeriod ? (
                <>
                  <Text style={styles.label}>Lease period</Text>
                  <Text style={styles.value}>{payment.leasePeriod}</Text>
                </>
              ) : null}
              {payment.landlord ? (
                <>
                  <Text style={styles.label}>Landlord</Text>
                  <Text style={styles.value}>{payment.landlord}</Text>
                </>
              ) : null}
              {payment.description ? (
                <>
                  <Text style={styles.label}>Note</Text>
                  <Text style={styles.value}>{payment.description}</Text>
                </>
              ) : null}
              {payment.source === "landlord_entry" ? (
                <Text style={styles.hint}>
                  Manual entry recorded by your landlord (onsite cash, GCash, or
                  bank transfer).
                </Text>
              ) : (
                <Text style={styles.hint}>
                  Payment submitted through the student app (GCash, bank
                  transfer, or cash).
                </Text>
              )}
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Proof & receipt</Text>
              {attachments.length > 0 ? (
                attachments.map((a) => (
                  <ProofAttachment
                    key={a.key}
                    label={a.label}
                    url={a.url}
                    caption={a.caption}
                  />
                ))
              ) : (
                <Text style={styles.noProof}>No proof image attached.</Text>
              )}
              <View style={styles.receiptBtn}>
                <Button
                  label="View official receipt"
                  variant="outline"
                  onPress={() => {
                    onClose();
                    router.push(
                      `/payment-receipt/${encodeURIComponent(payment.id)}`
                    );
                  }}
                />
              </View>
            </Card>
          </ScrollView>
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerText: { flex: 1, paddingRight: 12 },
  title: { fontSize: 17, fontWeight: "700", color: colors.navy },
  sub: { fontSize: 13, color: "#64748b", marginTop: 4 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 10,
    textTransform: "uppercase",
  },
  value: { fontSize: 14, color: colors.text, marginTop: 2 },
  hint: { fontSize: 12, color: "#64748b", marginTop: 12, lineHeight: 18 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 4,
  },
  proofBlock: { marginTop: 12 },
  proofCaption: { fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 17 },
  proofImageWrap: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  proofImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#f1f5f9",
  },
  tapHint: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
  noProof: { fontSize: 13, color: "#64748b", marginTop: 8 },
  receiptBtn: { marginTop: 14 },
  docLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  docLinkText: { fontSize: 14, color: colors.sky, fontWeight: "600" },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxClose: { position: "absolute", top: 48, right: 20, zIndex: 2 },
  lightboxImage: { width: "100%", height: "80%" },
});
