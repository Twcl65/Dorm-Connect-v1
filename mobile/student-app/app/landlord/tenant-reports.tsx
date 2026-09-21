import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiRequest, formatSignInError, type LandlordReservation } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

type OSAReport = {
  id: string;
  tenant_name: string;
  room_no?: string;
  property_name?: string;
  reason: string;
  details: string;
  status: "Open" | "In Review" | "Resolved";
  created_at: string;
};

export default function LandlordTenantReportsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<OSAReport[]>([]);
  const [tenants, setTenants] = useState<LandlordReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showTenantPicker, setShowTenantPicker] = useState(false);
  const [reportTenantId, setReportTenantId] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [rRes, tRes] = await Promise.all([
      apiRequest<{ reports: OSAReport[] }>("/api/landlord/reports/osa", { token }),
      apiRequest<{ leases: LandlordReservation[] }>("/api/landlord/leases", { token })
    ]);
    setItems(rRes.reports ?? []);
    setTenants(tRes.leases ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const getStatusTone = (status: string) => {
    if (status === "Resolved") return "success";
    if (status === "In Review") return "warning";
    return "danger";
  };

  const submitReport = async () => {
    const selectedTenant = tenants.find((t) => t.id === reportTenantId);
    if (!selectedTenant || !reportTitle.trim() || !reportDescription.trim()) {
      Alert.alert("Missing details", "Please select a tenant and provide a reason and details.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/landlord/reports/osa", {
        method: "POST",
        token: token!,
        body: {
          leaseId: selectedTenant.id,
          tenantName: selectedTenant.name,
          propertyName: selectedTenant.dormName,
          roomNo: selectedTenant.roomNo,
          title: reportTitle.trim(),
          description: reportDescription.trim(),
        },
      });
      setShowModal(false);
      setReportTenantId("");
      setReportTitle("");
      setReportDescription("");
      await load();
    } catch (e) {
      Alert.alert("Could not submit", e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && items.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <View style={{ marginBottom: 16 }}>
        <Title style={{ color: colors.brand }}>Tenant Reports (OSA)</Title>
        <Subtitle>Formal reports submitted to OSA</Subtitle>
        <View style={{ marginTop: 12 }}>
          <Button
            label="Report Tenant"
            variant="sky"
            onPress={() => {
              setReportTenantId(tenants[0]?.id ?? "");
              setReportTitle("");
              setReportDescription("");
              setShowModal(true);
            }}
          />
        </View>
      </View>
      
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } catch (e) {
                setError(formatSignInError(e));
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>No tenant reports have been filed.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.top}>
              <Text style={styles.title}>{item.tenant_name}</Text>
              <Badge label={item.status} tone={getStatusTone(item.status)} />
            </View>
            <Text style={styles.meta}>
              {new Date(item.created_at).toLocaleDateString()} · {item.property_name} (Room {item.room_no})
            </Text>
            <Text style={styles.reasonLabel}>{item.reason}</Text>
            <Text style={styles.details}>{item.details}</Text>
          </Card>
        )}
      />

      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Report Tenant to OSA</Text>
          <Text style={styles.modalSub}>
            Submit a formal report to the University Office of Student Affairs regarding a tenant's behavior or rule violations.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Tenant</Text>
            <Pressable
              style={styles.pickerTrigger}
              onPress={() => setShowTenantPicker(true)}
            >
              <Text style={reportTenantId ? styles.pickerTriggerText : styles.pickerTriggerPlaceholder}>
                {reportTenantId
                  ? tenants.find(t => t.id === reportTenantId)?.name + ` (Room ${tenants.find(t => t.id === reportTenantId)?.roomNo})`
                  : "-- Select a tenant --"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>▼</Text>
            </Pressable>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Reason / Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Unpaid Rent, Destructive Behavior..."
              value={reportTitle}
              onChangeText={setReportTitle}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Details</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Please describe the issue in detail..."
              multiline
              textAlignVertical="top"
              value={reportDescription}
              onChangeText={setReportDescription}
            />
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setShowModal(false)}
                disabled={submitting}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Button
                label="Submit Report"
                variant="sky"
                onPress={submitReport}
                loading={submitting}
                disabled={submitting || !reportTitle.trim() || !reportDescription.trim() || !reportTenantId}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTenantPicker} animationType="fade" transparent>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerModalTitle}>Select a tenant</Text>
            <FlatList
              data={tenants}
              keyExtractor={(t) => t.id}
              ListEmptyComponent={
                <Text style={styles.emptyPicker}>No tenants found.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerItem}
                  onPress={() => {
                    setReportTenantId(item.id);
                    setShowTenantPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>
                    {item.name} (Room {item.roomNo})
                  </Text>
                </Pressable>
              )}
            />
            <Button
              label="Close"
              variant="outline"
              onPress={() => setShowTenantPicker(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.muted },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  title: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 8 },
  reasonLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 4 },
  details: { fontSize: 13, color: colors.text, lineHeight: 18 },
  
  modalContent: {
    flex: 1,
    padding: 24,
    backgroundColor: colors.white,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brand,
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 24,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.white,
  },
  pickerTrigger: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerTriggerText: {
    fontSize: 15,
    color: colors.text,
  },
  pickerTriggerPlaceholder: {
    fontSize: 15,
    color: colors.muted,
  },
  textArea: {
    height: 120,
  },
  actions: {
    flexDirection: "row",
    marginTop: 24,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pickerModalContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxHeight: "80%",
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
  },
  pickerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.text,
  },
  emptyPicker: {
    fontSize: 15,
    color: colors.muted,
    paddingVertical: 16,
    textAlign: "center",
  }
});
