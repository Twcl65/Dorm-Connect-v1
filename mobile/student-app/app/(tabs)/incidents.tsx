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
import { useFocusEffect } from "expo-router";
import {
  ApiError,
  apiRequest,
  type IncidentReport,
  type IncidentRoom,
  formatSignInError,
} from "@/lib/api";
import { KeyboardAwareModal } from "@/components/keyboard-aware-modal";
import { SelectField } from "@/components/select-field";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function IncidentsTab() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<IncidentRoom[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const [rRooms, rRep] = await Promise.all([
      apiRequest<{ rooms: IncidentRoom[] }>("/api/student/incidents/rooms", {
        token,
      }),
      apiRequest<{ reports: IncidentReport[] }>("/api/student/incidents", {
        token,
      }),
    ]);
    setRooms(rRooms.rooms ?? []);
    setReports(rRep.reports ?? []);
    setRoomId((prev) => prev || rRooms.rooms?.[0]?.roomId || "");
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

  const closeForm = () => {
    setShowForm(false);
    setTitle("");
    setDescription("");
  };

  const openForm = () => {
    setShowForm(true);
    setRoomId((prev) => prev || rooms[0]?.roomId || "");
  };

  const submit = async () => {
    if (!token) return;
    if (!title.trim() || !description.trim()) {
      Alert.alert("Missing fields", "Enter a title and description.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/api/student/incidents", {
        method: "POST",
        token,
        body: {
          roomId: roomId || undefined,
          title: title.trim(),
          description: description.trim(),
          imageUrls: [],
        },
      });
      closeForm();
      await load();
      Alert.alert("Submitted", "Your incident report was sent to the landlord.");
    } catch (e) {
      Alert.alert(
        "Could not submit",
        e instanceof ApiError ? e.message : "Request failed."
      );
    } finally {
      setSaving(false);
    }
  };

  const roomOptions = rooms.map((r) => ({
    value: r.roomId,
    label: `${r.propertyName} · Room ${r.roomNo}`,
  }));

  if (loading && reports.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Title>Incident Report</Title>
      <Subtitle>Report issues for rooms on your active reservations.</Subtitle>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.newReportWrap}>
        <Button
          label="New incident report"
          variant="brand"
          fullWidth
          onPress={openForm}
        />
      </View>

      <FlatList
        data={reports}
        keyExtractor={(x) => x.id}
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
            <Text style={styles.empty}>No incident reports yet.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.reportTitle}>{item.title}</Text>
            <Text style={styles.meta}>
              {[item.propertyName, item.roomNo && `Room ${item.roomNo}`]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Text style={styles.meta}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            <Badge
              label={item.status}
              tone={
                item.status === "Resolved"
                  ? "success"
                  : item.landlordReply
                    ? "success"
                    : "warning"
              }
            />
            <Text style={styles.body}>{item.description}</Text>
            {item.landlordReply ? (
              <View style={styles.replyBox}>
                <Text style={styles.replyLabel}>
                  Landlord reply
                  {item.landlordName ? ` · ${item.landlordName}` : ""}
                  {item.landlordRepliedAt
                    ? ` · ${new Date(item.landlordRepliedAt).toLocaleDateString()}`
                    : ""}
                </Text>
                <Text style={styles.replyBody}>{item.landlordReply}</Text>
              </View>
            ) : (
              <View style={styles.waitingBox}>
                <Text style={styles.waitingLabel}>Waiting for landlord reply</Text>
                <Text style={styles.waitingBody}>
                  Your landlord will respond here. Pull to refresh after they
                  reply.
                </Text>
              </View>
            )}
          </Card>
        )}
      />

      <KeyboardAwareModal
        visible={showForm}
        onRequestClose={closeForm}
        sheetStyle={styles.modalSheet}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New incident report</Text>
          <Pressable onPress={closeForm} hitSlop={8}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        {rooms.length === 0 ? (
          <Text style={styles.hint}>
            You need an active reservation before you can file a report.
          </Text>
        ) : (
          <>
            <SelectField
              label="Room"
              placeholder="Select room"
              value={roomId}
              options={roomOptions}
              onChange={setRoomId}
            />
            <Input placeholder="Title" value={title} onChangeText={setTitle} />
            <Input
              placeholder="Describe the issue…"
              value={description}
              onChangeText={setDescription}
              multiline
              style={styles.textArea}
            />
            <View style={styles.modalActions}>
              <Button
                label="Submit report"
                fullWidth
                onPress={() => void submit()}
                loading={saving}
              />
              <Button
                label="Cancel"
                variant="outline"
                fullWidth
                onPress={closeForm}
              />
            </View>
          </>
        )}
      </KeyboardAwareModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  newReportWrap: { marginTop: 4, marginBottom: 16 },
  hint: { fontSize: 13, color: "#64748b", lineHeight: 18 },
  empty: { fontSize: 13, color: "#64748b" },
  textArea: { minHeight: 88, textAlignVertical: "top" },
  reportTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  body: { fontSize: 14, color: "#334155", marginTop: 8, lineHeight: 20 },
  replyBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  replyLabel: { fontSize: 11, fontWeight: "600", color: colors.sky, marginBottom: 4 },
  replyBody: { fontSize: 13, color: "#334155", lineHeight: 19 },
  waitingBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  waitingLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 4,
  },
  waitingBody: { fontSize: 13, color: "#78350f", lineHeight: 19 },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
  },
  closeText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  modalActions: { marginTop: 16, gap: 10 },
});
