import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordOnsiteRoom,
} from "@/lib/api";
import { uploadMobileFile } from "@/lib/upload";
import { SelectField } from "@/components/select-field";
import {
  Button,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function OnsitePaymentScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<LandlordOnsiteRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [propertyId, setPropertyId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [tenantLeaseId, setTenantLeaseId] = useState("");
  const [studentUserId, setStudentUserId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Advance" | "Security deposit">("Cash");
  const [scheduleMonthNumber, setScheduleMonthNumber] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ rooms: LandlordOnsiteRoom[] }>(
      "/api/landlord/payments/onsite-hints",
      { token }
    );
    setRooms(res.rooms ?? []);
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

  const properties = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rooms) {
      map.set(r.propertyId, r.propertyName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rooms]);

  const roomsForProperty = useMemo(() => {
    if (!propertyId) return [];
    return rooms.filter((r) => r.propertyId === propertyId);
  }, [rooms, propertyId]);

  const selected = useMemo(
    () => rooms.find((r) => r.roomId === roomId) ?? null,
    [rooms, roomId]
  );

  const applyRoomSelection = (hint: LandlordOnsiteRoom | null) => {
    setScheduleMonthNumber(null);
    setPaymentMethod("Cash");
    if (!hint) {
      setRoomId("");
      setPayerName("");
      setTenantLeaseId("");
      setStudentUserId("");
      return;
    }
    setRoomId(hint.roomId);
    setPayerName(hint.suggestedTenantName?.trim() ?? "");
    setTenantLeaseId(hint.tenantLeaseId ?? "");
    setStudentUserId(hint.studentUserId ?? "");
  };

  const onPropertyChange = (id: string) => {
    setPropertyId(id);
    applyRoomSelection(null);
  };

  const tenantRoomOptions = useMemo(
    () =>
      roomsForProperty.map((r) => {
        const tenant = r.suggestedTenantName?.trim();
        return {
          value: r.roomId,
          label: tenant ?? `Room ${r.roomNo} (no tenant)`,
          subtitle: tenant
            ? `Room ${r.roomNo}${
                r.studentUserId ? " · Student app account" : ""
              }`
            : "Payment saved by room only",
        };
      }),
    [roomsForProperty]
  );

  const monthOptions = useMemo(() => {
    if (!selected || !selected.unpaidMonths) return [];
    return selected.unpaidMonths.map((m) => ({
      value: `${m.monthNumber}`,
      label: m.monthLabel,
    }));
  }, [selected]);

  const pickProof = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo access to attach proof.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setProofUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(
        "Image picker unavailable",
        "Install expo-image-picker or add proof on the website."
      );
    }
  };

  const submit = async () => {
    if (!token || !roomId || !payerName.trim() || !amount || !paidOn) {
      setError("Property, student/tenant, amount, and paid date are required.");
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }
    if (paymentMethod === "Advance" && selected && numAmount > (selected.advanceAmount ?? 0)) {
      setError(`Insufficient advance payment balance (₱${(selected.advanceAmount ?? 0).toLocaleString()} available).`);
      return;
    }
    if (paymentMethod === "Security deposit" && selected && numAmount > (selected.depositAmount ?? 0)) {
      setError(`Insufficient security deposit balance (₱${(selected.depositAmount ?? 0).toLocaleString()} available).`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let proofUrl: string | undefined;
      if (proofUri) {
        proofUrl = await uploadMobileFile(
          token,
          proofUri,
          "receipt.jpg",
          "image/jpeg"
        );
      }
      await apiRequest("/api/landlord/payments", {
        token,
        method: "POST",
        body: {
          roomId,
          roomNo: selected?.roomNo,
          tenantLeaseId: tenantLeaseId || undefined,
          studentUserId: studentUserId || undefined,
          payerName: payerName.trim(),
          amount: numAmount,
          method: paymentMethod,
          status: "Paid",
          paidOn,
          proofUrl,
          scheduleMonthNumber: scheduleMonthNumber ?? undefined,
        },
      });
      router.back();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>Record onsite payment</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView keyboardShouldPersistTaps="handled">
        <SelectField
          label="Dorm / property"
          placeholder="Select property"
          value={propertyId}
          options={properties}
          onChange={onPropertyChange}
          emptyMessage="Add a property and rooms under Properties & Rooms first."
        />

        <SelectField
          label="Student / tenant"
          placeholder={
            propertyId ? "Select student or tenant" : "Select a property first"
          }
          value={roomId}
          options={tenantRoomOptions}
          onChange={(id) => {
            const hint = roomsForProperty.find((r) => r.roomId === id) ?? null;
            applyRoomSelection(hint);
          }}
          disabled={!propertyId}
          emptyMessage={
            propertyId
              ? "No rooms or tenants for this property."
              : undefined
          }
        />

        <Text style={styles.hint}>
          Choosing a student or tenant fills the name and links the payment to
          their account when they booked through the app.
        </Text>

        {selected ? (
          <View style={styles.balancesContainer}>
            <Text style={styles.balancesTitle}>Tenant Balances</Text>
            <View style={styles.balancesRow}>
              <View style={styles.balanceCol}>
                <Text style={styles.balanceLabel}>Remaining Balance</Text>
                <Text style={styles.balanceVal}>₱{(selected.balanceRemaining ?? 0).toLocaleString()}</Text>
              </View>
              <View style={styles.balanceCol}>
                <Text style={styles.balanceLabel}>Advance Payment</Text>
                <Text style={styles.balanceVal}>₱{(selected.advanceAmount ?? 0).toLocaleString()}</Text>
              </View>
              <View style={styles.balanceCol}>
                <Text style={styles.balanceLabel}>Security Deposit</Text>
                <Text style={styles.balanceVal}>₱{(selected.depositAmount ?? 0).toLocaleString()}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {roomId ? (
          <SelectField
            label="Payment method"
            placeholder="Select payment method"
            value={paymentMethod}
            options={[
              { value: "Cash", label: "Cash" },
              { value: "Advance", label: "Advance payment" },
              { value: "Security deposit", label: "Security deposit" },
            ]}
            onChange={(val) => setPaymentMethod(val as any)}
          />
        ) : null}

        {selected && selected.unpaidMonths && selected.unpaidMonths.length > 0 ? (
          <SelectField
            label="Month to pay"
            placeholder="Select rent month (optional)"
            value={scheduleMonthNumber ? `${scheduleMonthNumber}` : ""}
            options={monthOptions}
            onChange={(val) => setScheduleMonthNumber(val ? Number(val) : null)}
          />
        ) : null}

        {selected ? (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedLabel}>Selected tenant</Text>
            <Text style={styles.selectedValue}>
              {payerName.trim() || "No tenant name on file"}
            </Text>
            <Text style={styles.selectedMeta}>
              {selected.propertyName} · Room {selected.roomNo}
            </Text>
            {studentUserId ? (
              <Text style={styles.linked}>
                Linked to student app account — payment will appear in their
                Payments tab.
              </Text>
            ) : (
              <Text style={styles.warn}>
                No student app account linked. Payment is saved under the tenant
                name only.
              </Text>
            )}
          </View>
        ) : null}

        {!selected || !payerName.trim() ? (
          <>
            <Text style={styles.fieldLabel}>Tenant name (if not in list)</Text>
            <Input
              value={payerName}
              onChangeText={setPayerName}
              placeholder="Student full name"
              editable={!!roomId || !!propertyId}
            />
          </>
        ) : null}

        <Text style={styles.fieldLabel}>Amount (₱)</Text>
        <Input
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Text style={styles.fieldLabel}>Paid on</Text>
        <Input value={paidOn} onChangeText={setPaidOn} placeholder="YYYY-MM-DD" />

        <Text style={styles.fieldLabel}>Proof (optional)</Text>
        <Button
          label="Attach receipt photo"
          variant="outline"
          onPress={() => void pickProof()}
        />
        {proofUri ? <Text style={styles.meta}>Photo selected.</Text> : null}

        <View style={styles.submitWrap}>
          <Button
            label={saving ? "Saving…" : "Save payment"}
            variant="brand"
            loading={saving}
            disabled={!roomId || !payerName.trim() || !amount || !paidOn}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  hint: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  selectedBox: {
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  selectedLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#166534",
    textTransform: "uppercase",
  },
  selectedValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 4,
  },
  selectedMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  linked: {
    fontSize: 11,
    color: "#166534",
    marginTop: 8,
    lineHeight: 16,
  },
  warn: {
    fontSize: 11,
    color: "#b45309",
    marginTop: 8,
    lineHeight: 16,
  },
  meta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  submitWrap: { marginTop: 16, marginBottom: 24 },
  balancesContainer: {
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  balancesTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  balancesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  balanceCol: {
    minWidth: 80,
    flex: 1,
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  balanceVal: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 2,
  },
});
