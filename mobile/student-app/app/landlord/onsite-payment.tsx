import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
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
import {
  Button,
  Card,
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

  const [roomId, setRoomId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [proofUri, setProofUri] = useState<string | null>(null);

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

  const selected = useMemo(
    () => rooms.find((r) => r.roomId === roomId),
    [rooms, roomId]
  );

  const pickRoom = (r: LandlordOnsiteRoom) => {
    setRoomId(r.roomId);
    setPayerName(r.suggestedTenantName ?? "");
  };

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
      setError("Room, tenant name, amount, and paid date are required.");
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
          tenantLeaseId: selected?.tenantLeaseId ?? undefined,
          studentUserId: selected?.studentUserId ?? undefined,
          payerName: payerName.trim(),
          amount: Number(amount),
          method: "Cash",
          status: "Paid",
          paidOn,
          proofUrl,
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
      <Subtitle>Add onsite cash payment</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView>
        <Text style={styles.label}>Room / tenant</Text>
        {rooms.map((r) => (
          <Pressable key={r.roomId} onPress={() => pickRoom(r)}>
            <Card>
              <View
                style={
                  roomId === r.roomId ? styles.roomCardActive : undefined
                }
              >
              <Text style={styles.roomTitle}>
                {r.propertyName} · Room {r.roomNo}
              </Text>
              <Text style={styles.meta}>
                {r.suggestedTenantName ?? "No tenant name on file"}
              </Text>
              </View>
            </Card>
          </Pressable>
        ))}

        <Text style={styles.label}>Tenant name</Text>
        <Input value={payerName} onChangeText={setPayerName} />

        <Text style={styles.label}>Amount (₱)</Text>
        <Input
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Paid on (YYYY-MM-DD)</Text>
        <Input value={paidOn} onChangeText={setPaidOn} />

        <Text style={styles.label}>Proof (optional)</Text>
        <Button label="Attach receipt photo" variant="outline" onPress={() => void pickProof()} />
        {proofUri ? (
          <Text style={styles.meta}>Photo selected.</Text>
        ) : null}

        <Button
          label={saving ? "Saving…" : "Save payment"}
          variant="brand"
          loading={saving}
          onPress={() => void submit()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  roomCardActive: {
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 8,
    padding: 2,
  },
  roomTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
