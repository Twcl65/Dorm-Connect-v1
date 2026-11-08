import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  apiRequest,
  formatSignInError,
  type LandlordPropertyRow,
} from "@/lib/api";
import {
  normalizeLandlordPropertyForm,
  PROPERTY_TYPES,
  validateLandlordPropertyForm,
  type PropertyType,
} from "@/lib/landlord-property-validation";
import {
  pickImagesFromLibrary,
  uploadMobileImages,
} from "@/lib/landlord-rooms";
import {
  Button,
  Input,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const requiresFullPropertyInfo = (t: PropertyType) => t !== "Dormitory";

export default function AddPropertyScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const editing = Boolean(propertyId);
  const [loadingProperty, setLoadingProperty] = useState(editing);
  const [propertyLoaded, setPropertyLoaded] = useState(!editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("Dormitory");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [totalRooms, setTotalRooms] = useState("");
  const [maxOccupancy, setMaxOccupancy] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [galleryCount, setGalleryCount] = useState(0);
  const [galleryAssets, setGalleryAssets] = useState<
    { uri: string; fileName: string; mimeType: string }[]
  >([]);

  useEffect(() => {
    if (!token || !propertyId) {
      setLoadingProperty(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiRequest<{
          properties: LandlordPropertyRow[];
        }>("/api/landlord/properties", { token });
        const property = response.properties.find(
          (item) => item.id === propertyId
        );
        if (!property) {
          throw new Error("Property not found.");
        }
        if (cancelled) return;
        setName(property.name);
        setPropertyType(
          PROPERTY_TYPES.find((type) => type === property.propertyType) ??
            "Dormitory"
        );
        setDescription(property.description ?? "");
        setAddress(property.address ?? "");
        setCity(property.city ?? "");
        setContactPhone(property.contactPhone ?? "");
        setContactEmail(property.contactEmail ?? "");
        setTotalRooms(
          property.totalRooms == null ? "" : String(property.totalRooms)
        );
        setMaxOccupancy(
          property.maxOccupancyCapacity == null
            ? ""
            : String(property.maxOccupancyCapacity)
        );
        setLatitude(
          property.latitude == null ? "" : String(property.latitude)
        );
        setLongitude(
          property.longitude == null ? "" : String(property.longitude)
        );
        setGalleryCount(property.galleryImageUrls?.length ?? 0);
        setPropertyLoaded(true);
      } catch (e) {
        if (!cancelled) setError(formatSignInError(e));
      } finally {
        if (!cancelled) setLoadingProperty(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, propertyId]);

  const pickCover = async () => {
    const assets = await pickImagesFromLibrary(1);
    if (assets[0]) setCoverUri(assets[0].uri);
  };

  const pickGallery = async () => {
    const assets = await pickImagesFromLibrary(8);
    if (assets.length) {
      setGalleryAssets(assets);
      setGalleryCount(assets.length);
    }
  };

  const submit = async () => {
    if (!token) return;
    if (!propertyLoaded) {
      setError("Property information could not be loaded. Please try again.");
      return;
    }

    const formFields = {
      name,
      propertyType,
      description,
      address,
      city,
      contactPhone,
      contactEmail,
      totalRooms,
      maxOccupancyCapacity: maxOccupancy,
      latitude,
      longitude,
    };

    const validationErrors = validateLandlordPropertyForm(formFields);
    if (validationErrors.length > 0) {
      setError(validationErrors.join("\n"));
      return;
    }

    const normalized = normalizeLandlordPropertyForm(formFields);

    setSaving(true);
    setError(null);
    try {
      let coverImageUrl: string | undefined;
      if (coverUri) {
        const [url] = await uploadMobileImages(token, [
          {
            uri: coverUri,
            fileName: "cover.jpg",
            mimeType: "image/jpeg",
          },
        ]);
        coverImageUrl = url;
      }
      let galleryImageUrls: string[] | undefined;
      if (galleryAssets.length) {
        galleryImageUrls = await uploadMobileImages(token, galleryAssets);
      }

      await apiRequest(
        editing
          ? `/api/landlord/properties/${propertyId}`
          : "/api/landlord/properties",
        {
          token,
          method: editing ? "PATCH" : "POST",
          body: {
            ...normalized,
            ...(coverImageUrl ? { coverImageUrl } : {}),
            ...(galleryImageUrls ? { galleryImageUrls } : {}),
          },
        }
      );
      router.back();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Subtitle>{editing ? "Edit property" : "Add property"}</Subtitle>
      <Text style={styles.hint}>
        Same as the website — set address and map coordinates so rooms appear
        correctly for students.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loadingProperty ? (
        <Text style={styles.meta}>Loading property information…</Text>
      ) : null}

      {requiresFullPropertyInfo(propertyType) ? (
        <View style={styles.requirementsBox}>
          <Text style={styles.requirementsTitle}>Property requirements</Text>
          <Text style={styles.requirementsText}>
            Address, city, contact phone, description, current rooms, current capacity,
            and map coordinates are required. Use coordinates from the website map
            pin or GPS (e.g. 8.4542, 124.6319 near USTP).
          </Text>
        </View>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        pointerEvents={loadingProperty ? "none" : "auto"}
      >
        <Text style={styles.label}>Property name *</Text>
        <Input value={name} onChangeText={setName} placeholder="e.g. Sunrise Dorm" />

        <Text style={styles.label}>Type</Text>
        <View style={styles.row}>
          {PROPERTY_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setPropertyType(t)}
              style={[
                styles.chip,
                propertyType === t && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  propertyType === t && styles.chipTextActive,
                ]}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Description{requiresFullPropertyInfo(propertyType) ? " *" : ""}</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          multiline
          style={styles.textArea}
          placeholder={
            requiresFullPropertyInfo(propertyType)
              ? "Describe rooms, amenities, house rules, and nearby landmarks (min. 20 characters)"
              : "Brief description of your property"
          }
        />

        <Text style={styles.label}>Address{requiresFullPropertyInfo(propertyType) ? " *" : ""}</Text>
        <Input value={address} onChangeText={setAddress} placeholder="Street address" />

        <Text style={styles.label}>City{requiresFullPropertyInfo(propertyType) ? " *" : ""}</Text>
        <Input value={city} onChangeText={setCity} placeholder="e.g. Cagayan de Oro" />

        <Text style={styles.label}>Contact phone{requiresFullPropertyInfo(propertyType) ? " *" : ""}</Text>
        <Input
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
          placeholder="e.g. 09171234567"
        />

        <Text style={styles.label}>Contact email</Text>
        <Input
          value={contactEmail}
          onChangeText={setContactEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="e.g. landlord@email.com"
        />

        <Text style={styles.label}>
          Current number of rooms{requiresFullPropertyInfo(propertyType) ? " *" : " (optional)"}
        </Text>
        <Input
          value={totalRooms}
          onChangeText={setTotalRooms}
          keyboardType="number-pad"
          placeholder="e.g. 20"
        />

        <Text style={styles.label}>
          Current total capacity{requiresFullPropertyInfo(propertyType) ? " *" : " (optional)"}
        </Text>
        <Input
          value={maxOccupancy}
          onChangeText={setMaxOccupancy}
          keyboardType="number-pad"
          placeholder="e.g. 40"
        />

        <Text style={styles.label}>
          Latitude{requiresFullPropertyInfo(propertyType) ? " *" : " (optional)"}
        </Text>
        <Input
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="decimal-pad"
          placeholder="e.g. 8.4542"
        />

        <Text style={styles.label}>
          Longitude{requiresFullPropertyInfo(propertyType) ? " *" : " (optional)"}
        </Text>
        <Input
          value={longitude}
          onChangeText={setLongitude}
          keyboardType="decimal-pad"
          placeholder="e.g. 124.6319"
        />

        <Text style={styles.label}>Cover photo</Text>
        <Button label="Choose cover image" variant="outline" onPress={() => void pickCover()} />
        {coverUri ? <Text style={styles.meta}>Cover selected.</Text> : null}

        <Text style={styles.label}>Gallery photos</Text>
        <Button label="Choose gallery images" variant="outline" onPress={() => void pickGallery()} />
        {galleryCount > 0 ? (
          <Text style={styles.meta}>{galleryCount} gallery photo(s).</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={
              saving
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create property"
            }
            variant="brand"
            fullWidth
            loading={saving || loadingProperty}
            onPress={() => {
              if (!editing) {
                void submit();
                return;
              }
              Alert.alert(
                "Confirm property changes",
                "Save the updated information for this property?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Save changes",
                    onPress: () => void submit(),
                  },
                ]
              );
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  requirementsBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandDark ?? colors.brand,
    marginBottom: 4,
  },
  requirementsText: {
    fontSize: 12,
    color: "#9a3412",
    lineHeight: 17,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandMuted,
  },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.brand, fontWeight: "600" },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  actions: { marginTop: 24, marginBottom: 32 },
});
