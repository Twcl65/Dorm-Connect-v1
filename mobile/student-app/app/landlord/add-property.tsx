import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest, formatSignInError } from "@/lib/api";
import {
  normalizeLandlordPropertyForm,
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

const isBoardingHouse = (t: PropertyType) => t === "Boarding House";

export default function AddPropertyScreen() {
  const { token } = useAuth();
  const router = useRouter();
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

      await apiRequest("/api/landlord/properties", {
        token,
        method: "POST",
        body: {
          ...normalized,
          coverImageUrl: coverImageUrl ?? null,
          galleryImageUrls,
        },
      });
      router.back();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Subtitle>Add property</Subtitle>
      <Text style={styles.hint}>
        Same as the website — set address and map coordinates so rooms appear
        correctly for students.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isBoardingHouse(propertyType) ? (
        <View style={styles.requirementsBox}>
          <Text style={styles.requirementsTitle}>Boarding house requirements</Text>
          <Text style={styles.requirementsText}>
            Address, city, contact phone, description, total rooms, max occupancy,
            and map coordinates are required. Use coordinates from the website map
            pin or GPS (e.g. 8.4542, 124.6319 near USTP).
          </Text>
        </View>
      ) : null}

      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Property name *</Text>
        <Input value={name} onChangeText={setName} placeholder="e.g. Sunrise Dorm" />

        <Text style={styles.label}>Type</Text>
        <View style={styles.row}>
          {(["Dormitory", "Boarding House"] as PropertyType[]).map((t) => (
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

        <Text style={styles.label}>Description{isBoardingHouse(propertyType) ? " *" : ""}</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          multiline
          style={styles.textArea}
          placeholder={
            isBoardingHouse(propertyType)
              ? "Describe rooms, amenities, house rules, and nearby landmarks (min. 20 characters)"
              : "Brief description of your property"
          }
        />

        <Text style={styles.label}>Address{isBoardingHouse(propertyType) ? " *" : ""}</Text>
        <Input value={address} onChangeText={setAddress} placeholder="Street address" />

        <Text style={styles.label}>City{isBoardingHouse(propertyType) ? " *" : ""}</Text>
        <Input value={city} onChangeText={setCity} placeholder="e.g. Cagayan de Oro" />

        <Text style={styles.label}>Contact phone{isBoardingHouse(propertyType) ? " *" : ""}</Text>
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
          Total rooms{isBoardingHouse(propertyType) ? " *" : " (optional)"}
        </Text>
        <Input
          value={totalRooms}
          onChangeText={setTotalRooms}
          keyboardType="number-pad"
          placeholder="e.g. 20"
        />

        <Text style={styles.label}>
          Max occupancy{isBoardingHouse(propertyType) ? " *" : " (optional)"}
        </Text>
        <Input
          value={maxOccupancy}
          onChangeText={setMaxOccupancy}
          keyboardType="number-pad"
          placeholder="e.g. 40"
        />

        <Text style={styles.label}>
          Latitude{isBoardingHouse(propertyType) ? " *" : " (optional)"}
        </Text>
        <Input
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="decimal-pad"
          placeholder="e.g. 8.4542"
        />

        <Text style={styles.label}>
          Longitude{isBoardingHouse(propertyType) ? " *" : " (optional)"}
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
          <Text style={styles.meta}>{galleryCount} photo(s) selected.</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={saving ? "Saving…" : "Create property"}
            variant="brand"
            fullWidth
            loading={saving}
            onPress={() => void submit()}
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
