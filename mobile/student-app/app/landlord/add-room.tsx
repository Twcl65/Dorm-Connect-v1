import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiRequest, formatSignInError } from "@/lib/api";
import {
  formatPropertyAddress,
  pickImagesFromLibrary,
  uploadMobileImages,
  type LandlordPropertyOption,
  type LandlordRoomsDataResponse,
} from "@/lib/landlord-rooms";
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

export default function AddRoomScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ propertyId?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<LandlordPropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState("");

  const [roomNo, setRoomNo] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [rate, setRate] = useState("");
  const [roomSizeLabel, setRoomSizeLabel] = useState("");
  const [roomDetails, setRoomDetails] = useState("");
  const [remarks, setRemarks] = useState("");
  const [photoCount, setPhotoCount] = useState(0);
  const [photoAssets, setPhotoAssets] = useState<
    { uri: string; fileName: string; mimeType: string }[]
  >([]);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<LandlordRoomsDataResponse>(
      "/api/landlord/rooms-data",
      { token }
    );
    setProperties(res.properties ?? []);
    const initial =
      params.propertyId?.trim() ||
      res.selectedPropertyId ||
      res.properties[0]?.id ||
      "";
    setPropertyId(initial);
  }, [token, params.propertyId]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
          setError(null);
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const selectedProperty = properties.find((p) => p.id === propertyId);

  const pickPhotos = async () => {
    const assets = await pickImagesFromLibrary(12);
    if (assets.length) {
      setPhotoAssets(assets);
      setPhotoCount(assets.length);
    }
  };

  const submit = async () => {
    if (!token || !propertyId) {
      setError("Select a property first.");
      return;
    }
    if (!roomNo.trim()) {
      setError("Room number is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let roomImageUrls: string[] | undefined;
      if (photoAssets.length) {
        roomImageUrls = await uploadMobileImages(token, photoAssets);
      }
      await apiRequest("/api/landlord/rooms", {
        token,
        method: "POST",
        body: {
          propertyId,
          roomNo: roomNo.trim(),
          capacity: Number(capacity) || 1,
          rate: Number(rate) || 0,
          status: "Available",
          roomSizeLabel: roomSizeLabel.trim() || undefined,
          roomDetails: roomDetails.trim() || undefined,
          remarks: remarks.trim() || undefined,
          roomImageUrls,
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
      <Subtitle>Add room</Subtitle>
      <Text style={styles.hint}>
        Room is saved under the selected property (same as website Manage Rooms).
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {properties.length === 0 ? (
        <Card>
          <Text style={styles.meta}>
            Add a property first, then come back to create rooms.
          </Text>
        </Card>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Property *</Text>
          {properties.map((p) => (
            <Pressable key={p.id} onPress={() => setPropertyId(p.id)}>
              <Card>
                <View
                  style={
                    propertyId === p.id ? styles.propertyActive : undefined
                  }
                >
                  <Text style={styles.propertyName}>{p.name}</Text>
                  {formatPropertyAddress(p) ? (
                    <Text style={styles.meta}>{formatPropertyAddress(p)}</Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          ))}

          {selectedProperty ? (
            <Card>
              <Text style={styles.sectionTitle}>Location (from property)</Text>
              <Text style={styles.meta}>
                Address: {formatPropertyAddress(selectedProperty) || "—"}
              </Text>
              <Text style={styles.meta}>
                Map pin:{" "}
                {selectedProperty.latitude != null &&
                selectedProperty.longitude != null
                  ? `${selectedProperty.latitude.toFixed(5)}, ${selectedProperty.longitude.toFixed(5)}`
                  : "Not set — edit property to add coordinates"}
              </Text>
            </Card>
          ) : null}

          <Text style={styles.label}>Room number *</Text>
          <Input value={roomNo} onChangeText={setRoomNo} placeholder="e.g. 101" />

          <Text style={styles.label}>Capacity</Text>
          <Input
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Monthly rate (₱)</Text>
          <Input
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            placeholder="e.g. 3000"
          />

          <Text style={styles.label}>Room size</Text>
          <Input
            value={roomSizeLabel}
            onChangeText={setRoomSizeLabel}
            placeholder="e.g. 12 sqm"
          />

          <Text style={styles.label}>Other details</Text>
          <Input
            value={roomDetails}
            onChangeText={setRoomDetails}
            multiline
            style={styles.textArea}
            placeholder="Amenities, furnishing…"
          />

          <Text style={styles.label}>Remarks</Text>
          <Input
            value={remarks}
            onChangeText={setRemarks}
            multiline
            style={styles.textArea}
            placeholder="Optional notes"
          />

          <Text style={styles.label}>Room photos</Text>
          <Button label="Choose photos" variant="outline" onPress={() => void pickPhotos()} />
          {photoCount > 0 ? (
            <Text style={styles.meta}>{photoCount} photo(s) selected.</Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={saving ? "Saving…" : "Add room"}
              variant="brand"
              loading={saving}
              disabled={!propertyId || !roomNo.trim()}
              onPress={() => void submit()}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  propertyActive: {
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 8,
    padding: 4,
  },
  propertyName: { fontSize: 14, fontWeight: "600", color: colors.text },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  actions: { marginTop: 24, marginBottom: 32 },
});
