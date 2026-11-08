import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SelectField } from "@/components/select-field";
import {
  apiRequest,
  formatSignInError,
} from "@/lib/api";
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

type ChecklistItem = { key: string; label: string; category: string };
type Inspection = {
  accreditationRequestId: string;
  inspectionId: string | null;
  dormName: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  applicationStatus: string;
  scheduledFor: string | null;
  scheduleStatus: "upcoming" | "completed" | "overdue";
  result: string | null;
  notes: string;
  completedAt: string | null;
  checklist: Record<string, boolean>;
  canRecordResult: boolean;
};
type InspectionResponse = {
  schedules: Inspection[];
  checklistTemplate: ChecklistItem[];
};
type InspectionResult =
  | "Recommended for Approval"
  | "Rejected"
  | "Hold";

const resultOptions = [
  { value: "Recommended for Approval", label: "Recommended for Approval" },
  { value: "Rejected", label: "Rejected" },
  { value: "Hold", label: "On Hold" },
];

export default function StaffInspectionsScreen() {
  const { token } = useAuth();
  const [schedules, setSchedules] = useState<Inspection[]>([]);
  const [checklistTemplate, setChecklistTemplate] = useState<ChecklistItem[]>([]);
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [result, setResult] =
    useState<InspectionResult>("Recommended for Approval");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const response = await apiRequest<InspectionResponse>(
      "/api/osa/inspections",
      { token }
    );
    setSchedules(response.schedules ?? []);
    setChecklistTemplate(response.checklistTemplate ?? []);
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

  const openInspection = (row: Inspection) => {
    setSelected(row);
    setResult(
      row.result === "Rejected" || row.result === "Hold"
        ? row.result
        : "Recommended for Approval"
    );
    setChecklist({ ...row.checklist });
    setNotes(row.notes ?? "");
    setHoldReason(
      row.notes?.match(/^On hold:\s*(.*)$/m)?.[1]?.trim() ?? ""
    );
  };

  const submitResult = async () => {
    if (!token || !selected) return;
    if (result === "Hold" && !holdReason.trim()) {
      setError("Enter a reason for placing this application on hold.");
      return;
    }
    if (result === "Rejected" && !notes.trim()) {
      setError("Enter a reason for rejecting this application.");
      return;
    }
    if (
      result === "Recommended for Approval" &&
      checklistTemplate.some((item) => !checklist[item.key])
    ) {
      setError("Verify every checklist item before recommending approval.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/osa/inspections", {
        method: "POST",
        token,
        body: {
          accreditationRequestId: selected.accreditationRequestId,
          result,
          checklist,
          notes,
          holdReason,
        },
      });
      setSelected(null);
      await load();
      Alert.alert("Inspection saved", "The inspection result was recorded.");
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && schedules.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>Inspections</Title>
      <Subtitle>Review schedules and record on-site results</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={schedules}
        keyExtractor={(row) => row.accreditationRequestId}
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
            <Text style={styles.meta}>No inspections scheduled.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.dormName}</Text>
              <Badge
                label={
                  item.scheduleStatus === "completed"
                    ? "Completed"
                    : item.scheduleStatus === "overdue"
                      ? "Overdue"
                      : "Scheduled"
                }
                tone={
                  item.scheduleStatus === "completed"
                    ? "success"
                    : item.scheduleStatus === "overdue"
                      ? "danger"
                      : "warning"
                }
              />
            </View>
            <Text style={styles.meta}>{item.address}</Text>
            <Text style={styles.meta}>
              Landlord: {item.ownerName} · {item.ownerEmail}
            </Text>
            <Text style={styles.meta}>
              Date: {item.scheduledFor ?? "Not scheduled"}
            </Text>
            <Text style={styles.meta}>
              Result: {item.result ?? "Not recorded"}
            </Text>
            <View style={styles.cardAction}>
              <Button
                label={
                  item.canRecordResult
                    ? "Review inspection"
                    : "View inspection"
                }
                variant={item.canRecordResult ? "sky" : "outline"}
                onPress={() => openInspection(item)}
              />
            </View>
          </Card>
        )}
      />

      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Inspection checklist</Text>
              {selected ? (
                <>
                  <Text style={styles.meta}>
                    {selected.dormName} · {selected.address}
                  </Text>
                  {selected.ownerName ? (
                    <Text style={styles.meta}>
                      Landlord: {selected.ownerName}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {checklistTemplate.map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.checklistItem,
                    !selected?.canRecordResult && styles.readOnlyItem,
                  ]}
                  disabled={!selected?.canRecordResult}
                  onPress={() =>
                    setChecklist((current) => ({
                      ...current,
                      [item.key]: !current[item.key],
                    }))
                  }
                >
                  <View
                    style={[
                      styles.checkbox,
                      checklist[item.key] && styles.checkboxChecked,
                    ]}
                  >
                    {checklist[item.key] ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checklistLabel}>{item.label}</Text>
                    <Text style={styles.meta}>{item.category}</Text>
                  </View>
                </Pressable>
              ))}

              {selected?.canRecordResult ? (
                <>
                  <SelectField
                    label="Inspection result"
                    placeholder="Select result"
                    value={result}
                    options={resultOptions}
                    onChange={(value) => setResult(value as InspectionResult)}
                  />
                  {result === "Hold" ? (
                    <>
                      <Text style={styles.fieldLabel}>Reason for hold</Text>
                      <TextInput
                        value={holdReason}
                        onChangeText={setHoldReason}
                        placeholder="Explain what needs to be addressed"
                        multiline
                        style={styles.textArea}
                      />
                    </>
                  ) : null}
                  <Text style={styles.fieldLabel}>Inspection notes</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add inspection notes"
                    multiline
                    style={styles.textArea}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <View style={styles.modalActions}>
                    <Button
                      label="Cancel"
                      variant="outline"
                      onPress={() => setSelected(null)}
                      disabled={saving}
                    />
                    <Button
                      label="Submit result"
                      variant="sky"
                      onPress={() => void submitResult()}
                      loading={saving}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>
                    Result: {selected?.result ?? "Not recorded"}
                  </Text>
                  {selected?.notes ? (
                    <Text style={styles.meta}>{selected.notes}</Text>
                  ) : null}
                  <View style={styles.modalActions}>
                    <Button
                      label="Close"
                      variant="outline"
                      onPress={() => setSelected(null)}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginTop: 8 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  name: { color: colors.text, flex: 1, fontSize: 15, fontWeight: "600" },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  cardAction: { marginTop: 12 },
  modalOverlay: {
    backgroundColor: "rgba(15,23,42,0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 14,
  },
  modalCard: {
    maxHeight: "92%",
    width: "100%",
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  checklistItem: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  readOnlyItem: { opacity: 0.8 },
  checkbox: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxChecked: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  checkmark: { color: colors.white, fontSize: 15, fontWeight: "700" },
  checklistLabel: { color: colors.text, fontSize: 13, fontWeight: "500" },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  textArea: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.text,
    minHeight: 76,
    padding: 10,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 8, marginTop: 14 },
});
