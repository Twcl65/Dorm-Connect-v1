import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAwareModal } from "@/components/keyboard-aware-modal";
import { Badge, Button, Card, colors } from "@/components/ui";
import {
  apiRequest,
  formatSignInError,
  type LandlordAccreditationRow,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { uploadMobileFile } from "@/lib/upload";

type Props = {
  item: LandlordAccreditationRow | null;
  hasRenewal: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
};

type AccreditationDetails = {
  id: string;
  propertyId: string | null;
  dormName: string;
  address: string;
  status: string;
  documentsCount: number;
  submittedAt: string;
  updatedAt: string;
  accreditationExpiresAt: string | null;
  formData: unknown;
  landlordName?: string;
  landlordLocation?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  campus?: string;
  campusDirectorName?: string;
};

type DocumentFile = {
  fileName: string;
  mimeType: string;
  url: string;
};

type LocalFile = {
  uri: string;
  name: string;
  mimeType: string;
};

type DocumentUpdate = {
  file: LocalFile;
  documentKey?: string;
  additionalDocumentIndex?: number;
};

const REPLACEABLE_DOCS = [
  { key: "businessPermit", label: "Business Permit" },
  { key: "barangayClearance", label: "Barangay Clearance" },
  { key: "fireSafetyCertificate", label: "Fire Safety Certificate" },
  { key: "occupancyPermit", label: "Occupancy Permit" },
  { key: "sanitaryPermit", label: "Sanitary Permit" },
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readDocumentFile(value: unknown): DocumentFile | null {
  if (typeof value === "string" && value.trim()) {
    return {
      fileName: value.split("/").pop()?.split("?")[0] ?? "Uploaded file",
      mimeType: "",
      url: value,
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

function collectOtherAttachments(formData: unknown): string[] {
  const data = asRecord(formData);
  const urls: string[] = [];
  const owner = asRecord(data.owner);
  for (const key of ["ownerIdFrontUrl", "ownerIdBackUrl"]) {
    if (typeof owner[key] === "string") urls.push(owner[key] as string);
  }
  if (Array.isArray(data.attachmentUrls)) {
    for (const url of data.attachmentUrls) {
      if (typeof url === "string") urls.push(url);
    }
  }
  const documents = asRecord(data.documents);
  const supporting = asRecord(documents.supporting);
  if (Array.isArray(supporting.urls)) {
    for (const url of supporting.urls) {
      if (typeof url === "string") urls.push(url);
    }
  }
  return Array.from(new Set(urls));
}

function canEditDocuments(status: string): boolean {
  return status === "Hold";
}

function readInspectionProposal(formData: unknown) {
  const proposal = asRecord(asRecord(formData).inspection_schedule_proposal);
  return typeof proposal.proposedDate === "string" &&
    typeof proposal.status === "string"
    ? {
        proposedDate: proposal.proposedDate,
        status: proposal.status,
        confirmedDate:
          typeof proposal.confirmedDate === "string"
            ? proposal.confirmedDate
            : null,
      }
    : null;
}

function localDateString(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseLocalDate(value: string | null | undefined): Date {
  if (value) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    if (year && month && day) return new Date(year, month - 1, day);
  }
  return new Date();
}

function canRenew(status: string, submittedAt: string, expiresAt: string | null) {
  if (status !== "Approved") return false;
  const expiry = expiresAt ? new Date(expiresAt) : new Date(submittedAt);
  if (!expiresAt) expiry.setFullYear(expiry.getFullYear() + 1);
  if (Number.isNaN(expiry.getTime())) return false;
  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  return daysUntilExpiry <= 90;
}

function isImage(file: DocumentFile): boolean {
  return (
    file.mimeType.toLowerCase().startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|heic)(?:$|[?#])/i.test(file.url) ||
    /\.(jpe?g|png|webp|gif|heic)$/i.test(file.fileName)
  );
}

export function LandlordAccreditationDetailsModal({
  item,
  hasRenewal,
  onClose,
  onUpdated,
}: Props) {
  const { token } = useAuth();
  const [details, setDetails] = useState<AccreditationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickedFiles, setPickedFiles] = useState<Record<string, LocalFile>>({});
  const [newFiles, setNewFiles] = useState<LocalFile[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!item || !token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<AccreditationDetails>(
        `/api/landlord/accreditation/${item.id}`,
        { token }
      );
      setDetails(response);
      setScheduleDate(
        readInspectionProposal(response.formData)?.proposedDate.slice(0, 10) ?? ""
      );
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setLoading(false);
    }
  }, [item, token]);

  useEffect(() => {
    setDetails(null);
    setPickedFiles({});
    setNewFiles([]);
    setError(null);
    setNotice(null);
    setShowCertificate(false);
    setShowDatePicker(false);
    if (item) void loadDetails();
  }, [item?.id, loadDetails]);

  const currentStatus = details?.status ?? item?.status ?? "";
  const formData = details?.formData;
  const form = asRecord(formData);
  const documents = asRecord(form.documents);
  const additionalDocuments = Array.isArray(form.additional_documents)
    ? form.additional_documents
    : [];
  const proposal = readInspectionProposal(formData) ?? item?.inspectionScheduleProposal;
  const canEdit = canEditDocuments(currentStatus);
  const requestId = item?.id ?? "";
  const scheduledInspection =
    readInspectionProposal(formData)?.confirmedDate ??
    item?.inspectionScheduledFor ??
    null;

  const otherAttachments = useMemo(() => {
    if (!formData) return [];
    const knownUrls = new Set<string>();
    for (const doc of REPLACEABLE_DOCS) {
      const saved = readDocumentFile(documents[doc.key]);
      if (saved) knownUrls.add(saved.url);
    }
    for (const value of additionalDocuments) {
      const saved = readDocumentFile(value);
      if (saved) knownUrls.add(saved.url);
    }
    return collectOtherAttachments(formData).filter(
      (url) => !knownUrls.has(url)
    );
  }, [formData, documents, additionalDocuments]);

  const chooseFile = async (multiple: boolean) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple,
      });
      if (result.canceled) return [];
      return result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
      }));
    } catch (e) {
      setError(formatSignInError(e));
      return [];
    }
  };

  const pickReplacement = async (key: string) => {
    const selected = await chooseFile(false);
    if (selected[0]) {
      setPickedFiles((current) => ({ ...current, [key]: selected[0] }));
      setError(null);
    }
  };

  const pickAdditionalFiles = async () => {
    const selected = await chooseFile(true);
    if (selected.length > 0) {
      setNewFiles((current) => [...current, ...selected]);
      setError(null);
    }
  };

  const openFile = async (file: DocumentFile) => {
    try {
      await Linking.openURL(file.url);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not open ${file.fileName}: ${e.message}`
          : `Could not open ${file.fileName}.`
      );
    }
  };

  const refreshAfterAction = async () => {
    await onUpdated();
    await loadDetails();
  };

  const saveDocuments = async () => {
    if (!token || !requestId) return;
    const updates: DocumentUpdate[] = [];
    for (const [key, file] of Object.entries(pickedFiles)) {
      if (key.startsWith("additional:")) {
        const index = Number(key.slice("additional:".length));
        if (Number.isInteger(index) && index >= 0 && index < additionalDocuments.length) {
          updates.push({ file, additionalDocumentIndex: index });
        }
      } else if (REPLACEABLE_DOCS.some((doc) => doc.key === key)) {
        updates.push({ file, documentKey: key });
      }
    }
    if (updates.length === 0 && newFiles.length === 0) {
      setError("Choose at least one replacement or supplemental document.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const allFiles = [...updates.map((update) => update.file), ...newFiles];
      const uploaded = await Promise.all(
        allFiles.map((file) =>
          uploadMobileFile(token, file.uri, file.name, file.mimeType)
        )
      );
      const submittedDocuments = updates.map((update, index) => ({
        fileName: update.file.name,
        mimeType: update.file.mimeType,
        fileUrl: uploaded[index],
        ...(update.documentKey ? { documentKey: update.documentKey } : {}),
        ...(update.additionalDocumentIndex !== undefined
          ? { additionalDocumentIndex: update.additionalDocumentIndex }
          : {}),
      }));
      submittedDocuments.push(
        ...newFiles.map((file, index) => ({
          fileName: file.name,
          mimeType: file.mimeType,
          fileUrl: uploaded[updates.length + index],
        }))
      );
      await apiRequest(`/api/landlord/accreditation/${requestId}`, {
        token,
        method: "PATCH",
        body: { documents: submittedDocuments },
      });
      setPickedFiles({});
      setNewFiles([]);
      setNotice("Documents saved and sent to OSA for review.");
      await refreshAfterAction();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  const respondToInspection = async (action: "approve" | "change") => {
    if (!token || !requestId || !proposal) return;
    const date =
      action === "approve" ? proposal.proposedDate.slice(0, 10) : scheduleDate;
    if (action === "change" && !date) {
      setError("Choose a date for the inspection.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/landlord/accreditation/${requestId}`, {
        token,
        method: "PATCH",
        body: {
          inspectionScheduleAction: action,
          inspectionScheduleDate: date,
        },
      });
      setNotice(
        action === "approve"
          ? "The proposed inspection date was approved."
          : "Your requested inspection date was sent to OSA."
      );
      await refreshAfterAction();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  const renewAccreditation = async () => {
    if (!token || !item) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const existing =
        details ??
        (await apiRequest<AccreditationDetails>(
          `/api/landlord/accreditation/${item.id}`,
          { token }
        ));
      if (!existing.propertyId || !existing.formData) {
        throw new Error(
          "The existing application is missing the information needed for renewal."
        );
      }
      await apiRequest("/api/landlord/accreditation", {
        token,
        method: "POST",
        body: {
          propertyId: existing.propertyId,
          renewalOfRequestId: item.id,
          dormName: existing.dormName,
          address: existing.address,
          formData: existing.formData,
        },
      });
      setNotice("Your accreditation renewal was sent to OSA.");
      await onUpdated();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (date && event.type === "set") setScheduleDate(localDateString(date));
    if (Platform.OS !== "ios" || event.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  const effectiveSubmittedAt = details?.submittedAt ?? item?.submittedDate ?? "";
  const effectiveExpiry = details?.accreditationExpiresAt ?? item?.expiresAt ?? null;
  const renewalAvailable =
    item !== null &&
    canRenew(currentStatus, effectiveSubmittedAt, effectiveExpiry) &&
    !hasRenewal;
  const holdMessage =
    typeof form.osa_remarks === "string" && form.osa_remarks.trim()
      ? form.osa_remarks.trim()
      : null;

  const renderDocument = (
    title: string,
    file: DocumentFile | null,
    replacementKey: string,
    allowReplacement = true
  ) => {
    const selected = pickedFiles[replacementKey];
    return (
      <Card key={replacementKey} style={styles.documentCard}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {file ? (
          <>
            <Text style={styles.fileName}>{file.fileName}</Text>
            {isImage(file) ? (
              <Image
                source={{ uri: file.url }}
                style={styles.previewImage}
                resizeMode="contain"
                accessibilityLabel={`${title} preview`}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => void openFile(file)}
                style={styles.openFile}
              >
                <Text style={styles.openFileText}>Open PDF / document</Text>
              </Pressable>
            )}
          </>
        ) : (
          <Text style={styles.meta}>No file uploaded.</Text>
        )}
        {selected ? (
          <Text style={styles.selectedFile}>Replacement: {selected.name}</Text>
        ) : null}
        {canEdit && allowReplacement ? (
          <Button
            label={selected ? "Choose another file" : file ? "Replace document" : "Add document"}
            variant="outline"
            onPress={() => void pickReplacement(replacementKey)}
          />
        ) : null}
      </Card>
    );
  };

  return (
    <KeyboardAwareModal
      visible={item !== null}
      onRequestClose={onClose}
      sheetStyle={styles.sheet}
    >
      {item ? (
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {showCertificate ? "Accreditation Certificate" : "Request Details"}
              </Text>
              <Text style={styles.subtitle}>{item.dormName}</Text>
            </View>
            {showCertificate ? (
              <Button
                label="Back"
                variant="outline"
                onPress={() => setShowCertificate(false)}
              />
            ) : (
              <Button label="Close" variant="outline" onPress={onClose} />
            )}
          </View>

          {loading && !details ? (
            <Text style={styles.meta}>Loading accreditation details…</Text>
          ) : showCertificate && details ? (
            <View style={styles.certificate}>
              <Text style={styles.certificateTop}>{details.campus ?? "USTP Jasaan Campus"}</Text>
              <Text style={styles.certificateOffice}>OFFICE OF STUDENT AFFAIRS</Text>
              <View style={styles.certificateRule} />
              <Text style={styles.certificateTitle}>CERTIFICATE OF ACCREDITATION</Text>
              <Text style={styles.certificateBody}>
                This certifies that the following lodging property has been
                accredited by the Office of Student Affairs.
              </Text>
              <Text style={styles.certificateName}>{details.dormName}</Text>
              <Text style={styles.certificateBody}>{details.address}</Text>
              <Text style={styles.certificateBody}>
                Property owner: {details.landlordName ?? "Landlord"}
              </Text>
              <Text style={styles.certificateBody}>
                Valid through: {details.accreditationExpiresAt ?? "Not specified"}
              </Text>
              <Text style={styles.certificateBody}>
                Issued: {details.updatedAt}
              </Text>
              <Text style={styles.certificateBody}>
                Request reference: {details.id}
              </Text>
              <View style={styles.certificateSignatures}>
                <View style={styles.signature}>
                  <Text style={styles.signatureName}>
                    {details.signatoryName ?? "OSA Authorized Representative"}
                  </Text>
                  <Text style={styles.meta}>
                    {details.signatoryTitle ?? "Office of Student Affairs"}
                  </Text>
                </View>
                <View style={styles.signature}>
                  <Text style={styles.signatureName}>
                    {details.campusDirectorName ?? "Campus Director"}
                  </Text>
                  <Text style={styles.meta}>Campus Director</Text>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.summary}>
                <View style={styles.row}>
                  <Text style={styles.sectionTitle}>Status</Text>
                  <Badge
                    label={currentStatus}
                    tone={currentStatus === "Approved" ? "success" : currentStatus === "Hold" ? "warning" : "default"}
                  />
                </View>
                <Text style={styles.meta}>Address: {details?.address ?? item.address}</Text>
                <Text style={styles.meta}>
                  Submitted: {details?.submittedAt ?? item.submittedDate}
                </Text>
                <Text style={styles.meta}>
                  Documents submitted: {details?.documentsCount ?? item.documentsCount}
                </Text>
                {effectiveExpiry ? (
                  <Text style={styles.meta}>Accreditation expires: {effectiveExpiry}</Text>
                ) : null}
                {scheduledInspection ? (
                  <Text style={styles.meta}>
                    Inspection scheduled for: {scheduledInspection}
                  </Text>
                ) : null}
              </View>

              {["Hold", "Rejected"].includes(currentStatus) ? (
                <View style={styles.reason}>
                  <Text style={styles.reasonTitle}>
                    {currentStatus === "Rejected" ? "Reason for rejection" : "Message from OSA"}
                  </Text>
                  <Text style={styles.reasonText}>
                    {holdMessage ??
                      (currentStatus === "Rejected"
                        ? "No rejection reason was provided."
                        : "OSA placed this request on hold without an additional message.")}
                  </Text>
                </View>
              ) : null}

              {proposal?.status === "pending" ? (
                <View style={styles.actionSection}>
                  <Text style={styles.sectionTitle}>Proposed inspection date</Text>
                  <Text style={styles.meta}>{proposal.proposedDate.slice(0, 10)}</Text>
                  <Button
                    label="Approve proposed date"
                    variant="brand"
                    loading={saving}
                    onPress={() => void respondToInspection("approve")}
                  />
                  <Button
                    label={scheduleDate ? `Choose another date (${scheduleDate})` : "Choose another date"}
                    variant="outline"
                    disabled={saving}
                    onPress={() => setShowDatePicker(true)}
                  />
                  {showDatePicker ? (
                    <View>
                      <DateTimePicker
                        value={parseLocalDate(scheduleDate || proposal.proposedDate)}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        minimumDate={new Date()}
                        onChange={onDateChange}
                      />
                      {Platform.OS === "ios" ? (
                        <Button
                          label="Use selected date"
                          variant="outline"
                          onPress={() => setShowDatePicker(false)}
                        />
                      ) : null}
                    </View>
                  ) : null}
                  {scheduleDate &&
                  scheduleDate !== proposal.proposedDate.slice(0, 10) ? (
                    <Button
                      label="Confirm chosen date"
                      variant="brand"
                      loading={saving}
                      onPress={() => void respondToInspection("change")}
                    />
                  ) : null}
                </View>
              ) : null}

              <View style={styles.actionSection}>
                <Text style={styles.sectionTitle}>Uploaded documents</Text>
                {details ? (
                  <>
                    {REPLACEABLE_DOCS.map((doc) =>
                      renderDocument(
                        doc.label,
                        readDocumentFile(documents[doc.key]),
                        doc.key
                      )
                    )}
                    {additionalDocuments.map((value, index) => {
                      const saved = readDocumentFile(value);
                      return saved
                        ? renderDocument(
                            `Supplemental document ${index + 1}`,
                            saved,
                            `additional:${index}`
                          )
                        : null;
                    })}
                    {otherAttachments.map((url) => {
                      const file = readDocumentFile(url);
                      return file
                        ? renderDocument(
                            "Other attachment",
                            file,
                            `other:${url}`,
                            false
                          )
                        : null;
                    })}
                    {canEdit ? (
                      <View style={styles.actionSection}>
                        <Text style={styles.sectionTitle}>
                          Add supplemental documents
                        </Text>
                        <Button
                          label={
                            newFiles.length
                              ? `Choose more files (${newFiles.length} selected)`
                              : "Choose files"
                          }
                          variant="outline"
                          disabled={saving}
                          onPress={() => void pickAdditionalFiles()}
                        />
                        {newFiles.map((file, index) => (
                          <Text key={`${file.uri}-${index}`} style={styles.selectedFile}>
                            {file.name}
                          </Text>
                        ))}
                        <Text style={styles.meta}>
                          Replacements and supplemental documents are sent to OSA
                          together. Saving returns the request to Pending review.
                        </Text>
                        <Button
                          label="Save documents and send to OSA"
                          variant="brand"
                          loading={saving}
                          onPress={() => void saveDocuments()}
                        />
                      </View>
                    ) : (
                      <Text style={styles.meta}>
                        {currentStatus === "Pending"
                          ? "Documents have been sent to OSA and are awaiting review. Editing is available again if the request is put on hold."
                          : "Documents can be changed while the request is on hold."}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.meta}>Uploaded documents will appear here.</Text>
                )}
              </View>

              {currentStatus === "Approved" && details ? (
                <Button
                  label="View accreditation certificate"
                  variant="outline"
                  onPress={() => setShowCertificate(true)}
                />
              ) : null}
              {renewalAvailable ? (
                <Button
                  label="Renew accreditation"
                  variant="brand"
                  loading={saving}
                  onPress={() => void renewAccreditation()}
                />
              ) : null}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>
      ) : null}
    </KeyboardAwareModal>
  );
}

const styles = StyleSheet.create({
  sheet: { height: "95%", maxHeight: "95%" },
  content: { gap: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  summary: { gap: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  actionSection: { gap: 8 },
  reason: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    backgroundColor: "#fffbeb",
    gap: 4,
  },
  reasonTitle: { color: "#92400e", fontWeight: "700", fontSize: 13 },
  reasonText: { color: "#78350f", fontSize: 13, lineHeight: 19 },
  documentCard: { marginBottom: 0, gap: 6 },
  fileName: { color: colors.muted, fontSize: 12 },
  previewImage: {
    width: "100%",
    height: 190,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  openFile: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  openFileText: { color: colors.navy, fontSize: 13, fontWeight: "600" },
  selectedFile: { color: colors.sky, fontSize: 12, lineHeight: 18 },
  error: { color: colors.red, fontSize: 13 },
  notice: { color: colors.emerald, fontSize: 13 },
  certificate: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    padding: 18,
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
  },
  certificateTop: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  certificateOffice: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  certificateRule: {
    alignSelf: "stretch",
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  certificateTitle: {
    color: colors.navy,
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 8,
  },
  certificateBody: {
    color: colors.text,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
  },
  certificateName: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  certificateSignatures: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
  },
  signature: { flex: 1, alignItems: "center", gap: 3 },
  signatureName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
});
