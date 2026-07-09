import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
  listingDescriptionFromRoom,
  pickImagesFromLibrary,
  uploadMobileImages,
  type LandlordPropertyOption,
  type LandlordRoomDetail,
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

export default function PostListingScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ propertyId?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [propertyName, setPropertyName] = useState("");
  const [properties, setProperties] = useState<LandlordPropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [rooms, setRooms] = useState<LandlordRoomDetail[]>([]);

  const [roomId, setRoomId] = useState("");
  const [listingLocation, setListingLocation] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [extraPhotoCount, setExtraPhotoCount] = useState(0);
  const [extraPhotoAssets, setExtraPhotoAssets] = useState<
    { uri: string; fileName: string; mimeType: string }[]
  >([]);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [baseRoomImages, setBaseRoomImages] = useState<string[]>([]);

  const loadProperty = useCallback(
    async (pid: string) => {
      if (!token || !pid) return;
      const qs = `?propertyId=${encodeURIComponent(pid)}`;
      const res = await apiRequest<LandlordRoomsDataResponse>(
        `/api/landlord/rooms-data${qs}`,
        { token }
      );
      setPropertyName(res.propertyName ?? "");
      setRooms(res.rooms ?? []);
    },
    [token]
  );

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
    const prop = res.properties.find((p) => p.id === initial);
    setListingLocation(formatPropertyAddress(prop) || prop?.name || "");
    if (initial) await loadProperty(initial);
  }, [token, params.propertyId, loadProperty]);

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

  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === "Available"),
    [rooms]
  );

  const selectProperty = async (pid: string) => {
    setPropertyId(pid);
    setRoomId("");
    setListingDescription("");
    setBaseRoomImages([]);
    const prop = properties.find((p) => p.id === pid);
    setListingLocation(formatPropertyAddress(prop) || prop?.name || "");
    try {
      await loadProperty(pid);
    } catch (e) {
      setError(formatSignInError(e));
    }
  };

  const selectRoom = (room: LandlordRoomDetail) => {
    setRoomId(room.id);
    setListingDescription(listingDescriptionFromRoom(room));
    setBaseRoomImages(room.roomImageUrls ?? []);
  };

  const pickExtraPhotos = async () => {
    const assets = await pickImagesFromLibrary(4);
    if (assets.length) {
      setExtraPhotoAssets(assets);
      setExtraPhotoCount(assets.length);
    }
  };

  const pickCover = async () => {
    const assets = await pickImagesFromLibrary(1);
    if (assets[0]) setCoverUri(assets[0].uri);
  };

  const submit = async () => {
    if (!token || !roomId) {
      setError("Select an available room.");
      return;
    }
    if (!listingLocation.trim() || !listingDescription.trim()) {
      setError("Location and description are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let extra: string[] = [];
      if (extraPhotoAssets.length) {
        extra = await uploadMobileImages(token, extraPhotoAssets);
      }
      const merged = [...new Set([...baseRoomImages, ...extra])];

      let listingBackgroundUrl: string | undefined;
      if (coverUri) {
        const [url] = await uploadMobileImages(token, [
          {
            uri: coverUri,
            fileName: "listing-cover.jpg",
            mimeType: "image/jpeg",
          },
        ]);
        listingBackgroundUrl = url;
      }

      const body: Record<string, unknown> = {
        isListed: true,
        listingLocation: listingLocation.trim(),
        listingDescription: listingDescription.trim(),
        listingImageUrls: merged,
      };
      if (listingBackgroundUrl) {
        body.listingBackgroundUrl = listingBackgroundUrl;
      }

      await apiRequest(`/api/landlord/rooms/${roomId}`, {
        token,
        method: "PATCH",
        body,
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
      <Subtitle>Post listing</Subtitle>
      <Text style={styles.hint}>
        Publish an available room for students to browse (same as website).
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Property</Text>
        {properties.map((p) => (
          <Pressable key={p.id} onPress={() => void selectProperty(p.id)}>
            <Card>
              <View
                style={propertyId === p.id ? styles.propertyActive : undefined}
              >
                <Text style={styles.propertyName}>{p.name}</Text>
              </View>
            </Card>
          </Pressable>
        ))}

        <Text style={styles.label}>Dorm name</Text>
        <Input value={propertyName} editable={false} style={styles.disabled} />

        <Text style={styles.label}>Location *</Text>
        <Input
          value={listingLocation}
          onChangeText={setListingLocation}
          placeholder="e.g. Near USTP main gate"
        />
        {selectedProperty &&
        selectedProperty.latitude == null &&
        selectedProperty.longitude == null ? (
          <Text style={styles.warn}>
            Map pin not set on this property — students may not see it on the map
            until coordinates are added on the website or in Add property.
          </Text>
        ) : null}

        <Text style={styles.label}>Available room *</Text>
        {availableRooms.length === 0 ? (
          <Card>
            <Text style={styles.meta}>
              No available rooms. Add a room first or mark one as Available.
            </Text>
          </Card>
        ) : (
          availableRooms.map((r) => (
            <Pressable key={r.id} onPress={() => selectRoom(r)}>
              <Card>
                <View style={roomId === r.id ? styles.propertyActive : undefined}>
                  <Text style={styles.propertyName}>
                    Room {r.roomNo} · ₱{r.rate.toLocaleString()}/mo
                  </Text>
                  {r.isListed ? (
                    <Text style={styles.listed}>Already posted</Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          ))
        )}

        <Text style={styles.label}>Listing description *</Text>
        <Input
          value={listingDescription}
          onChangeText={setListingDescription}
          multiline
          style={styles.textArea}
          placeholder="Describe the room for students"
        />

        {baseRoomImages.length > 0 ? (
          <Text style={styles.meta}>
            {baseRoomImages.length} photo(s) from room record will be included.
          </Text>
        ) : null}

        <Text style={styles.label}>Extra listing photos</Text>
        <Button
          label="Add photos"
          variant="outline"
          onPress={() => void pickExtraPhotos()}
        />
        {extraPhotoCount > 0 ? (
          <Text style={styles.meta}>{extraPhotoCount} extra photo(s).</Text>
        ) : null}

        <Text style={styles.label}>Cover image (optional)</Text>
        <Button label="Choose cover" variant="outline" onPress={() => void pickCover()} />
        {coverUri ? <Text style={styles.meta}>Cover selected.</Text> : null}

        <View style={styles.actions}>
          <Button
            label={saving ? "Posting…" : "Post listing"}
            variant="brand"
            loading={saving}
            disabled={
              !roomId ||
              !listingLocation.trim() ||
              !listingDescription.trim()
            }
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  warn: { fontSize: 12, color: colors.amber, marginTop: 4 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  textArea: { minHeight: 96, textAlignVertical: "top" },
  disabled: { backgroundColor: "#f1f5f9", color: colors.muted },
  propertyActive: {
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 8,
    padding: 4,
  },
  propertyName: { fontSize: 14, fontWeight: "600", color: colors.text },
  listed: { fontSize: 11, color: colors.emerald, marginTop: 4 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  actions: { marginTop: 24, marginBottom: 32 },
});
