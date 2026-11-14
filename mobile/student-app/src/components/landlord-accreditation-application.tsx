import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Button,
  Card,
  Input,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { useAuth } from "@/context/AuthContext";
import {
  apiRequest,
  formatSignInError,
  type LandlordPropertyRow,
} from "@/lib/api";
import { uploadMobileFile } from "@/lib/upload";

type Props = {
  onCancel: () => void;
  onSubmitted: () => void;
};

type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

const REQUIRED_DOCUMENTS = [
  { key: "businessPermit", label: "Business Permit" },
  { key: "barangayClearance", label: "Barangay Clearance" },
  { key: "fireSafetyCertificate", label: "Fire Safety Certificate" },
  { key: "occupancyPermit", label: "Occupancy Permit" },
] as const;

const DOCUMENT_TYPES = [
  "application/pdf",
  "image/*",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const DECLARATIONS = [
  {
    key: "certify",
    label:
      "I certify that the information provided is true, complete, and accurate.",
  },
  {
    key: "understandSubmit",
    label: "I understand submission does not guarantee approval.",
  },
  {
    key: "understandRevoke",
    label: "I understand accreditation may be revoked if compliance is violated.",
  },
  {
    key: "understandInspect",
    label: "I understand OSA may inspect the premises.",
  },
] as const;

type DeclarationKey = (typeof DECLARATIONS)[number]["key"];

export function LandlordAccreditationApplication({
  onCancel,
  onSubmitted,
}: Props) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<LandlordPropertyRow[]>([]);
  const [ineligibleCount, setIneligibleCount] = useState(0);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerBusinessName, setOwnerBusinessName] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [documentFiles, setDocumentFiles] = useState<
    Partial<Record<(typeof REQUIRED_DOCUMENTS)[number]["key"] | "sanitaryPermit", PickedFile>>
  >({});
  const [sanitaryApplicable, setSanitaryApplicable] = useState(false);
  const [supportingFiles, setSupportingFiles] = useState<PickedFile[]>([]);
  const [checklist, setChecklist] = useState<Record<DeclarationKey, boolean>>({
    certify: false,
    understandSubmit: false,
    understandRevoke: false,
    understandInspect: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const response = await apiRequest<{
          properties: LandlordPropertyRow[];
          ineligibleCount?: number;
        }>("/api/landlord/properties?forAccreditation=true", { token });
        if (!active) return;
        setProperties(response.properties ?? []);
        setIneligibleCount(response.ineligibleCount ?? 0);
      } catch (e) {
        if (active) setError(formatSignInError(e));
      } finally {
        if (active) setPropertiesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const selectedProperty = properties.find(
    (property) => property.id === selectedPropertyId
  );
  const propertyOptions = properties.map((property) => ({
    value: property.id,
    label: property.name,
    subtitle: [property.address, property.city].filter(Boolean).join(", "),
  }));

  const selectProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const property = properties.find((item) => item.id === propertyId);
    if (!property) return;

    setOwnerName(user?.name ?? "");
    setOwnerBusinessName(property.name);
    setOwnerContact(property.contactPhone?.trim() ?? "");
    setOwnerEmail(property.contactEmail?.trim() || user?.email || "");
    setError(null);
  };

  const pickDocument = async (
    key: (typeof REQUIRED_DOCUMENTS)[number]["key"] | "sanitaryPermit"
  ) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setDocumentFiles((current) => ({
        ...current,
        [key]: {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
        },
      }));
      setError(null);
    } catch (e) {
      setError(formatSignInError(e));
    }
  };

  const pickSupportingFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_TYPES,
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      setSupportingFiles(
        result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
        }))
      );
      setError(null);
    } catch (e) {
      setError(formatSignInError(e));
    }
  };

  const submit = async () => {
    if (!token) return;
    const errors: string[] = [];
    if (!ownerName.trim()) errors.push("Owner full name is required.");
    if (!ownerBusinessName.trim()) errors.push("Business name is required.");
    if (!ownerContact.trim()) errors.push("Owner contact number is required.");
    if (!ownerEmail.trim()) errors.push("Owner email address is required.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      errors.push("Enter a valid owner email address.");
    }
    if (!selectedProperty) {
      errors.push("Select a property eligible for accreditation.");
    } else {
      if (!selectedProperty.address?.trim()) {
        errors.push("Add a property address before applying.");
      }
      if (!selectedProperty.city?.trim()) {
        errors.push("Add a property city before applying.");
      }
    }
    for (const document of REQUIRED_DOCUMENTS) {
      if (!documentFiles[document.key]) {
        errors.push(`${document.label} is required.`);
      }
    }
    if (sanitaryApplicable && !documentFiles.sanitaryPermit) {
      errors.push("Sanitary Permit is required when applicable.");
    }
    for (const declaration of DECLARATIONS) {
      if (!checklist[declaration.key]) {
        errors.push("Complete all declarations before submitting.");
        break;
      }
    }
    if (errors.length) {
      setError(errors.join("\n"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const documents: Record<string, unknown> = {};
      const attachmentUrls: string[] = [];
      const filesToUpload = [
        ...REQUIRED_DOCUMENTS.map((document) => ({
          key: document.key,
          file: documentFiles[document.key]!,
        })),
        ...(sanitaryApplicable && documentFiles.sanitaryPermit
          ? [{ key: "sanitaryPermit", file: documentFiles.sanitaryPermit }]
          : []),
      ];
      const uploadedDocuments = await Promise.all(
        filesToUpload.map(async ({ key, file }) => {
          const url = await uploadMobileFile(
            token,
            file.uri,
            file.name,
            file.mimeType ?? "application/octet-stream"
          );
          return {
            key,
            value: {
              fileName: file.name,
              mimeType: file.mimeType ?? "application/octet-stream",
              url,
            },
          };
        })
      );
      for (const document of uploadedDocuments) {
        documents[document.key] = document.value;
        attachmentUrls.push(document.value.url);
      }

      const supportingUrls = await Promise.all(
        supportingFiles.map((file) =>
          uploadMobileFile(
            token,
            file.uri,
            file.name,
            file.mimeType ?? "application/octet-stream"
          )
        )
      );
      if (supportingFiles.length) {
        documents.supporting = {
          fileNames: supportingFiles.map((file) => file.name),
          urls: supportingUrls,
        };
        attachmentUrls.push(...supportingUrls);
      }

      const address = [selectedProperty!.address, selectedProperty!.city]
        .filter(Boolean)
        .join(", ");
      await apiRequest("/api/landlord/accreditation", {
        token,
        method: "POST",
        body: {
          propertyId: selectedProperty!.id,
          dormName: selectedProperty!.name,
          address,
          formData: {
            dorm: {
              name: selectedProperty!.name,
              address: selectedProperty!.address,
              city: selectedProperty!.city,
              type: selectedProperty!.propertyType ?? "Dormitory",
              rooms: selectedProperty!.totalRooms ?? "",
              capacity: selectedProperty!.maxOccupancyCapacity ?? "",
            },
            owner: {
              name: ownerName.trim(),
              businessName: ownerBusinessName.trim(),
              contact: ownerContact.trim(),
              email: ownerEmail.trim(),
            },
            documents,
            attachmentUrls,
            declaration: { checklist },
          },
        },
      });
      onSubmitted();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Button label="Cancel" variant="outline" onPress={onCancel} />
          <Subtitle>Apply for accreditation</Subtitle>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            Select an eligible property to fill in its details and available
            owner contact information. Review the fields, upload the required
            documents, and accept the declarations for OSA review.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Card>
            <Text style={styles.section}>Owner / landlord information</Text>
            <Text style={styles.label}>Full name *</Text>
            <Input
              value={ownerName}
              onChangeText={setOwnerName}
              editable={!saving}
              autoCapitalize="words"
            />
            <Text style={styles.label}>Business name *</Text>
            <Input
              value={ownerBusinessName}
              onChangeText={setOwnerBusinessName}
              editable={!saving}
              autoCapitalize="words"
            />
            <Text style={styles.label}>Contact number *</Text>
            <Input
              value={ownerContact}
              onChangeText={setOwnerContact}
              editable={!saving}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Email address *</Text>
            <Input
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              editable={!saving}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <SelectField
              label="Dorm / boarding house *"
              placeholder={
                propertiesLoading ? "Loading properties…" : "Select a property"
              }
              value={selectedPropertyId}
              options={propertyOptions}
              onChange={selectProperty}
              disabled={propertiesLoading || saving}
              emptyMessage="No eligible properties. Add a property first or wait until its renewal window."
            />
            {propertiesLoading ? (
              <ActivityIndicator color={colors.brand} style={styles.loader} />
            ) : null}
            {!propertiesLoading && properties.length === 0 ? (
              <View style={styles.emptyProperties}>
                <Text style={styles.meta}>
                  {ineligibleCount
                    ? `${ineligibleCount} ${
                        ineligibleCount === 1 ? "property is" : "properties are"
                      } not currently eligible for a new application. Approved properties may apply within 3 months of expiry.`
                    : "Add a property before submitting an accreditation request."}
                </Text>
                <Button
                  label="Add property"
                  variant="outline"
                  onPress={() => router.push("/landlord/add-property")}
                />
              </View>
            ) : null}
            {selectedProperty ? (
              <View style={styles.propertyDetails}>
                <Text style={styles.meta}>
                  Address: {selectedProperty.address}, {selectedProperty.city}
                </Text>
                <Text style={styles.meta}>
                  Type: {selectedProperty.propertyType ?? "Dormitory"}
                </Text>
                <Text style={styles.meta}>
                  Available rooms: {selectedProperty.totalRooms ?? "—"}
                </Text>
                <Text style={styles.meta}>
                  Current capacity: {selectedProperty.maxOccupancyCapacity ?? "—"}
                </Text>
              </View>
            ) : null}
          </Card>

          <Card>
            <Text style={styles.section}>Required documents</Text>
            {REQUIRED_DOCUMENTS.map((document) => (
              <View key={document.key} style={styles.uploadRow}>
                <Text style={styles.label}>{document.label} *</Text>
                <Button
                  label={documentFiles[document.key]?.name ?? "Choose file"}
                  variant="outline"
                  disabled={saving}
                  onPress={() => void pickDocument(document.key)}
                />
              </View>
            ))}
            <Pressable
              style={styles.checkRow}
              onPress={() => {
                setSanitaryApplicable((current) => !current);
                if (sanitaryApplicable) {
                  setDocumentFiles((current) => ({
                    ...current,
                    sanitaryPermit: undefined,
                  }));
                }
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: sanitaryApplicable }}
            >
              <Ionicons
                name={sanitaryApplicable ? "checkbox" : "square-outline"}
                size={20}
                color={colors.brand}
              />
              <Text style={styles.checkText}>
                Sanitary Permit is applicable for my dorm
              </Text>
            </Pressable>
            {sanitaryApplicable ? (
              <View style={styles.uploadRow}>
                <Text style={styles.label}>Sanitary Permit *</Text>
                <Button
                  label={documentFiles.sanitaryPermit?.name ?? "Choose file"}
                  variant="outline"
                  disabled={saving}
                  onPress={() => void pickDocument("sanitaryPermit")}
                />
              </View>
            ) : null}
            <View style={styles.uploadRow}>
              <Text style={styles.label}>Other supporting documents (optional)</Text>
              <Button
                label={
                  supportingFiles.length
                    ? `${supportingFiles.length} file(s) selected`
                    : "Choose files"
                }
                variant="outline"
                disabled={saving}
                onPress={() => void pickSupportingFiles()}
              />
              {supportingFiles.map((file, index) => (
                <Text key={`${file.name}-${index}`} style={styles.meta}>
                  {file.name}
                </Text>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.section}>Declaration</Text>
            {DECLARATIONS.map((declaration) => (
              <Pressable
                key={declaration.key}
                style={styles.checkRow}
                onPress={() =>
                  setChecklist((current) => ({
                    ...current,
                    [declaration.key]: !current[declaration.key],
                  }))
                }
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: checklist[declaration.key],
                }}
              >
                <Ionicons
                  name={
                    checklist[declaration.key]
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={20}
                  color={colors.brand}
                />
                <Text style={styles.checkText}>{declaration.label}</Text>
              </Pressable>
            ))}
          </Card>

          <Button
            label="Submit for OSA review"
            variant="brand"
            fullWidth
            loading={saving}
            disabled={properties.length === 0 || propertiesLoading}
            onPress={() => void submit()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: 8, marginBottom: 8 },
  scroll: { flex: 1 },
  content: { gap: 12, paddingBottom: 24 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  error: { color: colors.red, fontSize: 13, lineHeight: 19 },
  section: { fontSize: 15, fontWeight: "700", color: colors.text },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 10,
    marginBottom: 4,
  },
  meta: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  loader: { marginVertical: 12 },
  emptyProperties: { gap: 8, marginTop: 10 },
  propertyDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 10,
    gap: 4,
  },
  uploadRow: { gap: 4, marginTop: 8 },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
  },
  checkText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
});
