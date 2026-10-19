import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Input, colors } from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { pickImagesFromLibrary } from "@/lib/landlord-rooms";
import { uploadMobileFile } from "@/lib/upload";
import { resolveMediaUrl } from "@/lib/config";
import { apiRequest } from "@/lib/api";

export type GcashPayTarget = {
  reservationId: string;
  amount: number;
  landlordName: string;
  gcashAccountName?: string | null;
  gcashPhone?: string | null;
  gcashQrCodeUrl?: string | null;
  monthNumber?: number | null;
  description?: string;
};

type MonthOption = {
  value: string;
  label: string;
  subtitle?: string;
};

type Props = {
  token: string;
  target: GcashPayTarget;
  monthOptions?: MonthOption[];
  onMonthChange?: (monthNumber: string) => void;
  selectedMonthValue?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
};

export function GcashPaymentForm({
  token,
  target,
  monthOptions,
  onMonthChange,
  selectedMonthValue,
  onSuccess,
  onError,
}: Props) {
  const [amount, setAmount] = useState(String(target.amount));
  const [gcashName, setGcashName] = useState(
    target.gcashAccountName?.trim() || target.landlordName
  );
  const [gcashPhone, setGcashPhone] = useState(target.gcashPhone?.trim() || "");
  const [gcashQr, setGcashQr] = useState(target.gcashQrCodeUrl ?? null);
  const [proof, setProof] = useState<{
    uri: string;
    fileName: string;
    mimeType: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    setAmount(String(target.amount));
  }, [target.amount]);

  useEffect(() => {
    setGcashName(target.gcashAccountName?.trim() || target.landlordName);
    setGcashPhone(target.gcashPhone?.trim() || "");
    setGcashQr(target.gcashQrCodeUrl ?? null);
  }, [
    target.gcashAccountName,
    target.gcashPhone,
    target.gcashQrCodeUrl,
    target.landlordName,
  ]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequest<{
          landlordName?: string;
          gcashAccountName?: string | null;
          gcashPhone?: string | null;
          gcashQrCodeUrl?: string | null;
        }>(
          `/api/student/gcash?reservationId=${encodeURIComponent(target.reservationId)}`,
          { token }
        );
        if (cancelled) return;
        const name =
          res.gcashAccountName?.trim() ||
          res.landlordName?.trim() ||
          target.gcashAccountName?.trim() ||
          target.landlordName;
        setGcashName(name);
        setGcashPhone(
          res.gcashPhone?.trim() || target.gcashPhone?.trim() || ""
        );
        setGcashQr(res.gcashQrCodeUrl ?? target.gcashQrCodeUrl ?? null);
      } catch {
        /* keep values already on the reservation */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    token,
    target.reservationId,
    target.gcashAccountName,
    target.gcashPhone,
    target.gcashQrCodeUrl,
    target.landlordName,
  ]);

  const qrUrl = resolveMediaUrl(gcashQr);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) {
      onError("Please enter a valid amount.");
      return;
    }
    if (!proof) {
      onError("Please attach a GCash receipt screenshot.");
      return;
    }
    setSubmitting(true);
    try {
      const imageUrl = await uploadMobileFile(
        token,
        proof.uri,
        proof.fileName,
        proof.mimeType
      );
      await apiRequest("/api/student/payments", {
        token,
        method: "POST",
        body: {
          reservationId: target.reservationId,
          amount: Number(amount),
          method: "GCash",
          status: "Pending",
          proofImageUrl: imageUrl,
          scheduleMonthNumber: target.monthNumber ?? undefined,
          description: target.description ?? "GCash payment",
        },
      });
      onSuccess();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <View style={styles.payBox}>
        <Text style={styles.payTitle}>Pay with GCash</Text>
        <Text style={styles.meta}>
          GCash name:{" "}
          <Text style={styles.strong}>{gcashName || "Landlord"}</Text>
        </Text>
        {gcashPhone ? (
          <Text style={styles.meta}>
            GCash number: <Text style={styles.strong}>{gcashPhone}</Text>
          </Text>
        ) : null}
        {qrUrl ? (
          <>
            <Pressable
              onPress={() => setQrOpen(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Open GCash QR code"
            >
              <Image
                source={{ uri: qrUrl }}
                style={styles.qr}
                resizeMode="contain"
              />
              <Text style={styles.tapHint}>Tap QR to open</Text>
            </Pressable>
            <Modal
              visible={qrOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setQrOpen(false)}
            >
              <Pressable style={styles.lightbox} onPress={() => setQrOpen(false)}>
                <Pressable
                  style={styles.lightboxClose}
                  onPress={() => setQrOpen(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </Pressable>
                <Image
                  source={{ uri: qrUrl }}
                  style={styles.lightboxQr}
                  resizeMode="contain"
                  accessibilityLabel="GCash QR code"
                />
              </Pressable>
            </Modal>
          </>
        ) : (
          <View style={styles.qrEmpty}>
            <Text style={styles.qrEmptyText}>
              Landlord has not uploaded a GCash QR code yet.
            </Text>
          </View>
        )}
        <Text style={styles.hint}>
          Scan the QR in GCash, then attach your receipt screenshot for the
          landlord to approve.
        </Text>
      </View>

      {monthOptions && onMonthChange ? (
        <SelectField
          label="Select rent month to pay"
          placeholder="Choose a month"
          value={selectedMonthValue ?? ""}
          options={monthOptions}
          onChange={onMonthChange}
          emptyMessage="No unpaid rent months"
        />
      ) : null}

      <Text style={styles.label}>Amount (₱)</Text>
      <Input
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
      />

      <Text style={styles.label}>Receipt proof</Text>
      {proof ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: proof.uri }} style={styles.preview} />
          <Text style={styles.fileName}>{proof.fileName}</Text>
          <Button
            label="Change photo"
            variant="outline"
            fullWidth
            onPress={async () => {
              const picked = await pickImagesFromLibrary(1);
              if (picked?.[0]) setProof(picked[0]);
            }}
          />
        </View>
      ) : (
        <Button
          label="Add receipt photo"
          variant="outline"
          fullWidth
          onPress={async () => {
            const picked = await pickImagesFromLibrary(1);
            if (picked?.[0]) setProof(picked[0]);
          }}
        />
      )}

      <View style={{ marginTop: 16 }}>
        <Button
          label={submitting ? "Submitting…" : "Submit payment"}
          variant="brand"
          fullWidth
          disabled={submitting || !proof}
          loading={submitting}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  payBox: {
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  payTitle: { fontSize: 15, fontWeight: "700", color: colors.navy },
  meta: { fontSize: 13, color: "#334155", marginTop: 6 },
  strong: { fontWeight: "700", color: colors.navy },
  qr: {
    width: "100%",
    height: 180,
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
  },
  tapHint: { fontSize: 11, color: "#0369a1", marginTop: 6, textAlign: "center" },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxClose: { position: "absolute", top: 48, right: 20, zIndex: 2 },
  lightboxQr: { width: "92%", height: "72%" },
  qrEmpty: {
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: colors.white,
  },
  qrEmptyText: { fontSize: 12, color: colors.muted, textAlign: "center" },
  hint: { fontSize: 12, color: "#0369a1", marginTop: 8, lineHeight: 18 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 8,
  },
  previewWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8fafc",
    marginBottom: 8,
  },
  preview: { width: "100%", height: 180, borderRadius: 8, marginBottom: 8 },
  fileName: { fontSize: 12, color: colors.muted, marginBottom: 8 },
});
