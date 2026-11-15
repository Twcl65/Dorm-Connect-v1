import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
  type LandlordAccreditationRow,
  type LandlordPropertyRow,
} from "@/lib/api";
import { uploadMobileFile } from "@/lib/upload";

type Props = {
  onCancel: () => void;
  onSubmitted: (isRenewal: boolean) => void;
  renewalRequest?: LandlordAccreditationRow | null;
};

type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

type SavedFile = {
  url: string;
  fileName: string;
  mimeType: string;
};

const REQUIRED_DOCUMENTS = [
  { key: "businessPermit", label: "Business Permit" },
  { key: "barangayClearance", label: "Barangay Clearance" },
  { key: "fireSafetyCertificate", label: "Fire Safety Certificate" },
  { key: "occupancyPermit", label: "Occupancy Permit" },
] as const;

type DocumentKey =
  | (typeof REQUIRED_DOCUMENTS)[number]["key"]
  | "sanitaryPermit";
type SavedDocuments = Partial<Record<DocumentKey, SavedFile>>;

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

type AccreditationDetails = {
  propertyId: string | null;
  dormName: string;
  address: string;
  formData: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readSavedFile(value: unknown): SavedFile | null {
  if (typeof value === "string" && value.trim()) {
    return {
      url: value,
      fileName: value.split("/").pop()?.split("?")[0] ?? "Uploaded file",
      mimeType: "",
    };
  }
  const file = asRecord(value);
  const url =
    typeof file.url === "string"
      ? file.url
      : typeof file.fileUrl === "string"
        ? file.fileUrl
        : "";
  if (!url.trim()) return null;
  return {
    url,
    fileName:
      typeof file.fileName === "string" && file.fileName.trim()
        ? file.fileName
        : url.split("/").pop()?.split("?")[0] ?? "Uploaded file",
    mimeType: typeof file.mimeType === "string" ? file.mimeType : "",
  };
}

function collectFormAttachmentUrls(formData: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const owner = asRecord(formData.owner);
  for (const key of ["ownerIdFrontUrl", "ownerIdBackUrl"]) {
    if (typeof owner[key] === "string") urls.push(owner[key] as string);
  }
  const documents = asRecord(formData.documents);
  const keys: DocumentKey[] = [
    ...REQUIRED_DOCUMENTS.map((document) => document.key),
    "sanitaryPermit",
  ];
  for (const key of keys) {
    const file = readSavedFile(documents[key]);
    if (file) urls.push(file.url);
  }
  const supporting = asRecord(documents.supporting);
  if (Array.isArray(supporting.urls)) {
    for (const url of supporting.urls) {
      if (typeof url === "string") urls.push(url);
    }
  }
  return Array.from(new Set(urls));
}

export function LandlordAccreditationApplication({
  onCancel,
  onSubmitted,
  renewalRequest = null,
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
    Partial<Record<DocumentKey, PickedFile>>
  >({});
  const [savedDocuments, setSavedDocuments] = useState<SavedDocuments>({});
  const [renewalFormData, setRenewalFormData] =
    useState<Record<string, unknown> | null>(null);
  const [renewalLoading, setRenewalLoading] = useState(false);
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

  useEffect(() => {
    if (!token || !renewalRequest) return;
    let active = true;
    setRenewalLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await apiRequest<AccreditationDetails>(
          `/api/landlord/accreditation/${renewalRequest.id}`,
          { token }
        );
        if (!active) return;
        const formData = asRecord(response.formData);
        if (Object.keys(formData).length === 0) {
          throw new Error(
            "The approved accreditation has no saved application data."
          );
        }

        const dorm = asRecord(formData.dorm);
        const owner = asRecord(formData.owner);
        const documents = asRecord(formData.documents);
        const savedFiles: SavedDocuments = {};
        for (const document of REQUIRED_DOCUMENTS) {
          const file = readSavedFile(documents[document.key]);
          if (file) savedFiles[document.key] = file;
        }
        const sanitaryPermit = readSavedFile(documents.sanitaryPermit);
        if (sanitaryPermit) savedFiles.sanitaryPermit = sanitaryPermit;

        const checklist = asRecord(
          asRecord(formData.declaration).checklist
        );
        setSelectedPropertyId(
          response.propertyId ?? renewalRequest.propertyId ?? ""
        );
        setOwnerName(
          typeof owner.name === "string" ? owner.name : user?.name ?? ""
        );
        setOwnerBusinessName(
          typeof owner.businessName === "string"
            ? owner.businessName
            : response.dormName
        );
        setOwnerContact(typeof owner.contact === "string" ? owner.contact : "");
        setOwnerEmail(
          typeof owner.email === "string" ? owner.email : user?.email ?? ""
        );
        setSavedDocuments(savedFiles);
        setDocumentFiles({});
        setRenewalFormData(formData);
        setSanitaryApplicable(Boolean(sanitaryPermit));
        setChecklist({
          certify:
            typeof checklist.certify === "boolean" ? checklist.certify : true,
          understandSubmit:
            typeof checklist.understandSubmit === "boolean"
              ? checklist.understandSubmit
              : true,
          understandRevoke:
            typeof checklist.understandRevoke === "boolean"
              ? checklist.understandRevoke
              : true,
          understandInspect:
            typeof checklist.understandInspect === "boolean"
              ? checklist.understandInspect
              : true,
        });
      } catch (e) {
        if (active) setError(formatSignInError(e));
      } finally {
        if (active) setRenewalLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, renewalRequest, user?.name, user?.email]);

  const selectedProperty = properties.find(
    (property) => property.id === selectedPropertyId
  );
  const savedDorm = asRecord(renewalFormData?.dorm);
  const dormAddress =
    selectedProperty?.address ??
    (typeof savedDorm.address === "string" ? savedDorm.address : "");
  const dormCity =
    selectedProperty?.city ??
    (typeof savedDorm.city === "string" ? savedDorm.city : "");
  const propertyOptions = properties.map((property) => ({
    value: property.id,
    label: property.name,
    subtitle: [property.address, property.city].filter(Boolean).join(", "),
  }));
  const savedSupporting = asRecord(
    asRecord(renewalFormData?.documents).supporting
  );
  const savedSupportingNames = Array.isArray(savedSupporting.fileNames)
    ? savedSupporting.fileNames.filter(
        (name): name is string => typeof name === "string"
      )
    : [];
  const progress = useMemo(() => {
    const checks = [
      Boolean(ownerName.trim()),
      Boolean(ownerBusinessName.trim()),
      Boolean(ownerContact.trim()),
      Boolean(ownerEmail.trim()),
      Boolean(selectedPropertyId.trim()),
      Boolean(dormAddress.trim()),
      Boolean(dormCity.trim()),
      ...REQUIRED_DOCUMENTS.map((document) =>
        Boolean(documentFiles[document.key] || savedDocuments[document.key])
      ),
      sanitaryApplicable
        ? Boolean(
            documentFiles.sanitaryPermit || savedDocuments.sanitaryPermit
          )
        : true,
      ...DECLARATIONS.map((declaration) => checklist[declaration.key]),
    ];
    return Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }, [
    ownerName,
    ownerBusinessName,
    ownerContact,
    ownerEmail,
    selectedPropertyId,
    dormAddress,
    dormCity,
    documentFiles,
    savedDocuments,
    sanitaryApplicable,
    checklist,
  ]);

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
    if (renewalRequest && !renewalFormData) {
      setError("Load the saved accreditation details before submitting a renewal.");
      return;
    }
    const errors: string[] = [];
    if (!ownerName.trim()) errors.push("Owner full name is required.");
    if (!ownerBusinessName.trim()) errors.push("Business name is required.");
    if (!ownerContact.trim()) errors.push("Owner contact number is required.");
    if (!ownerEmail.trim()) errors.push("Owner email address is required.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      errors.push("Enter a valid owner email address.");
    }
    if (!selectedProperty && !renewalRequest?.propertyId) {
      errors.push("Select a property eligible for accreditation.");
    }
    if (!dormAddress.trim()) {
      errors.push("Add a property address before applying.");
    }
    if (!dormCity.trim()) {
      errors.push("Add a property city before applying.");
    }
    for (const document of REQUIRED_DOCUMENTS) {
      if (!documentFiles[document.key] && !savedDocuments[document.key]) {
        errors.push(`${document.label} is required.`);
      }
    }
    if (
      sanitaryApplicable &&
      !documentFiles.sanitaryPermit &&
      !savedDocuments.sanitaryPermit
    ) {
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
      const documents: Record<string, unknown> = {
        ...asRecord(renewalFormData?.documents),
      };
      for (const [key, file] of Object.entries(savedDocuments)) {
        if (file) documents[key] = file;
      }
      if (!sanitaryApplicable) delete documents.sanitaryPermit;

      const documentKeys: DocumentKey[] = [
        ...REQUIRED_DOCUMENTS.map((document) => document.key),
        ...(sanitaryApplicable ? ["sanitaryPermit" as const] : []),
      ];
      const filesToUpload = documentKeys.flatMap((key) =>
        documentFiles[key] ? [{ key, file: documentFiles[key]! }] : []
      );
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
      const previousSupporting = asRecord(documents.supporting);
      const oldSupportingUrls = Array.isArray(previousSupporting.urls)
        ? previousSupporting.urls.filter(
            (url): url is string => typeof url === "string"
          )
        : [];
      const oldSupportingNames = Array.isArray(previousSupporting.fileNames)
        ? previousSupporting.fileNames.filter(
            (name): name is string => typeof name === "string"
          )
        : [];
      if (supportingFiles.length > 0) {
        documents.supporting = {
          ...previousSupporting,
          fileNames: [
            ...oldSupportingNames,
            ...supportingFiles.map((file) => file.name),
          ],
          urls: [...oldSupportingUrls, ...supportingUrls],
        };
      }

      const owner = {
        ...asRecord(renewalFormData?.owner),
        name: ownerName.trim(),
        businessName: ownerBusinessName.trim(),
        contact: ownerContact.trim(),
        email: ownerEmail.trim(),
      };
      const dorm = renewalRequest
        ? {
            ...savedDorm,
            name: selectedProperty?.name ?? renewalRequest.dormName,
            address: dormAddress,
            city: dormCity,
          }
        : {
            name: selectedProperty?.name ?? "",
            address: dormAddress,
            city: dormCity,
            type: selectedProperty?.propertyType ?? "Dormitory",
            rooms: selectedProperty?.totalRooms ?? "",
            capacity: selectedProperty?.maxOccupancyCapacity ?? "",
          };
      const formData: Record<string, unknown> = {
        ...asRecord(renewalFormData),
        dorm,
        owner,
        documents,
        declaration: {
          ...asRecord(renewalFormData?.declaration),
          checklist,
        },
        attachmentUrls: null,
      };
      formData.attachmentUrls = collectFormAttachmentUrls(formData);
      const address = renewalRequest
        ? renewalRequest.address
        : [dormAddress, dormCity].filter(Boolean).join(", ");
      const propertyId = selectedProperty?.id ?? renewalRequest?.propertyId;
      await apiRequest("/api/landlord/accreditation", {
        token,
        method: "POST",
        body: {
          propertyId,
          renewalOfRequestId: renewalRequest?.id,
          dormName: selectedProperty?.name ?? renewalRequest?.dormName,
          address,
          formData,
        },
      });
      onSubmitted(Boolean(renewalRequest));
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
          <Subtitle>
            {renewalRequest ? "Renew accreditation" : "Apply for accreditation"}
          </Subtitle>
        </View>
        <View style={styles.progress}>
          <View style={styles.progressLabel}>
            <Text style={styles.progressText}>Application progress</Text>
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityLabel="Application progress"
            accessibilityValue={{ min: 0, max: 100, now: progress }}
          >
            <View
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            {renewalRequest
              ? "Review the saved application details. Existing documents and declarations are reused; replace any documents that need updating before submitting the renewal."
              : "Select an eligible property to fill in its details and available owner contact information. Review the fields, upload the required documents, and accept the declarations for OSA review."}
          </Text>
          {renewalLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.meta}>Loading saved application details…</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Card>
            <Text style={styles.section}>Owner / landlord information</Text>
            <Text style={styles.label}>Full name *</Text>
            <Input
              value={ownerName}
              onChangeText={setOwnerName}
              editable={!saving && !renewalLoading}
              autoCapitalize="words"
            />
            <Text style={styles.label}>Business name *</Text>
            <Input
              value={ownerBusinessName}
              onChangeText={setOwnerBusinessName}
              editable={!saving && !renewalLoading}
              autoCapitalize="words"
            />
            <Text style={styles.label}>Contact number *</Text>
            <Input
              value={ownerContact}
              onChangeText={setOwnerContact}
              editable={!saving && !renewalLoading}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Email address *</Text>
            <Input
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              editable={!saving && !renewalLoading}
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
              disabled={
                propertiesLoading ||
                renewalLoading ||
                saving ||
                Boolean(renewalRequest)
              }
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
                  Address: {dormAddress}, {dormCity}
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
                  label={
                    documentFiles[document.key]?.name ??
                    savedDocuments[document.key]?.fileName ??
                    "Choose file"
                  }
                  variant="outline"
                  disabled={saving || renewalLoading}
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
                  label={
                    documentFiles.sanitaryPermit?.name ??
                    savedDocuments.sanitaryPermit?.fileName ??
                    "Choose file"
                  }
                  variant="outline"
                  disabled={saving || renewalLoading}
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
                disabled={saving || renewalLoading}
                onPress={() => void pickSupportingFiles()}
              />
              {savedSupportingNames.map((name, index) => (
                <Text key={`saved-${name}-${index}`} style={styles.meta}>
                  Existing: {name}
                </Text>
              ))}
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
            label={
              renewalRequest ? "Submit renewal for OSA review" : "Submit for OSA review"
            }
            variant="brand"
            fullWidth
            loading={saving}
            disabled={
              propertiesLoading ||
              renewalLoading ||
              (Boolean(renewalRequest) && !renewalFormData) ||
              (!selectedProperty && !renewalRequest?.propertyId)
            }
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
  progress: { gap: 4, marginBottom: 12 },
  progressLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: { fontSize: 12, color: colors.muted },
  progressValue: { fontSize: 12, fontWeight: "600", color: colors.text },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#10b981",
  },
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
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
