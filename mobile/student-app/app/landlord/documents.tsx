import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordAccreditationRow,
} from "@/lib/api";
import { Badge, Button, Card, CenteredLoader, Screen, Subtitle, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { uploadMobileFile } from "@/lib/upload";
import { SelectField } from "@/components/select-field";

type AccreditationDetails = {
  formData?: unknown;
  dormName: string;
  address: string;
  propertyId: string | null;
};

const REPLACEABLE_DOCS = [
  { value: "businessPermit", label: "Business Permit" },
  { value: "barangayClearance", label: "Barangay Clearance" },
  { value: "fireSafetyCertificate", label: "Fire Safety Certificate" },
  { value: "occupancyPermit", label: "Occupancy Permit" },
  { value: "sanitaryPermit", label: "Sanitary Permit" },
];

function readHoldMessage(formData: unknown): string | null {
  if (!formData || typeof formData !== "object") return null;
  const remarks = (formData as Record<string, unknown>).osa_remarks;
  return typeof remarks === "string" && remarks.trim() ? remarks.trim() : null;
}

function isRenewalAvailable(item: LandlordAccreditationRow): boolean {
  if (item.status === "Expired") return true;
  if (item.status !== "Approved" || !item.expiresAt) return false;
  const daysUntilExpiry =
    (new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry <= 90;
}

export default function LandlordDocumentsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordAccreditationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<AccreditationDetails | null>(null);
  const [documentKey, setDocumentKey] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ requests: LandlordAccreditationRow[] }>(
      "/api/landlord/accreditation",
      { token }
    );
    setItems(res.requests ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setLoading(true);
        try {
          await load();
          if (active) setError(null);
        } catch (e) {
          if (active) setError(formatSignInError(e));
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [load])
  );

  const openDetails = async (item: LandlordAccreditationRow) => {
    setSelectedId((current) => (current === item.id ? null : item.id));
    if (selectedId === item.id) return;
    setDetails(null);
    try {
      const response = await apiRequest<AccreditationDetails>(
        `/api/landlord/accreditation/${item.id}`,
        { token }
      );
      setDetails(response);
    } catch (e) {
      setError(formatSignInError(e));
    }
  };

  const submitAdditionalDocument = async () => {
    if (!token || !selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const fileUrl = await uploadMobileFile(
        token,
        asset.uri,
        asset.name,
        asset.mimeType ?? "application/octet-stream"
      );
      await apiRequest(`/api/landlord/accreditation/${selectedId}`, {
        token,
        method: "PATCH",
        body: {
          documents: [
            {
              fileName: asset.name,
              mimeType: asset.mimeType,
              fileUrl,
              ...(documentKey ? { documentKey } : {}),
            },
          ],
        },
      });
      setDocumentKey("");
      await load();
      Alert.alert("Submitted", "Your document was sent to OSA for review.");
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  const renewAccreditation = async (item: LandlordAccreditationRow) => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const existing = await apiRequest<AccreditationDetails>(
        `/api/landlord/accreditation/${item.id}`,
        { token }
      );
      if (!existing.propertyId || !existing.formData) {
        throw new Error("The existing application is missing the information needed for renewal.");
      }
      await apiRequest("/api/landlord/accreditation", {
        token,
        method: "POST",
        body: {
          propertyId: existing.propertyId,
          dormName: existing.dormName,
          address: existing.address,
          formData: existing.formData,
        },
      });
      await load();
      Alert.alert("Renewal submitted", "Your accreditation renewal was sent to OSA.");
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
      setError(null);
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>Accreditation requests</Subtitle>
      <Text style={styles.hint}>
        Review application status, renew eligible accreditations, and submit
        requested documents without starting a new application.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>No accreditation requests.</Text>
          </Card>
        }
        renderItem={({ item }) => {
          const expanded = item.id === selectedId;
          const holdMessage = expanded ? readHoldMessage(details?.formData) : null;
          return (
            <Card>
              <Pressable onPress={() => void openDetails(item)}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.dormName}</Text>
                  <Badge label={item.status} tone={item.status === "Approved" ? "success" : item.status === "Hold" ? "warning" : "default"} />
                </View>
                <Text style={styles.meta}>{item.address}</Text>
                <Text style={styles.meta}>
                  {item.documentsCount} documents · Submitted {item.submittedDate}
                </Text>
                {item.expiresAt ? (
                  <Text style={styles.meta}>Accreditation expires {item.expiresAt}</Text>
                ) : null}
                <Text style={styles.tap}>{expanded ? "Hide details" : "View details and actions"}</Text>
              </Pressable>

              {expanded ? (
                <View style={styles.details}>
                  {item.status === "Hold" ? (
                    <>
                      <Text style={styles.section}>OSA correction / missing document note</Text>
                      <Text style={styles.meta}>
                        {holdMessage ?? "OSA has requested additional documents. Check the website for detailed corrections if none are listed here."}
                      </Text>
                      <SelectField
                        label="Replace existing document (optional)"
                        placeholder="Submit as additional document"
                        value={documentKey}
                        options={REPLACEABLE_DOCS}
                        onChange={setDocumentKey}
                      />
                      <Button
                        label={documentKey ? "Replace and resubmit document" : "Add document and resubmit"}
                        variant="brand"
                        loading={saving}
                        onPress={() => void submitAdditionalDocument()}
                      />
                    </>
                  ) : null}
                  {isRenewalAvailable(item) ? (
                    <Button
                      label="Renew accreditation"
                      variant="brand"
                      loading={saving}
                      onPress={() => void renewAccreditation(item)}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  error: { color: colors.red, marginBottom: 8, fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  tap: { fontSize: 12, color: colors.sky, marginTop: 8, fontWeight: "600" },
  section: { fontSize: 13, fontWeight: "700", color: colors.text },
  details: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  empty: { fontSize: 13, color: colors.muted },
});
