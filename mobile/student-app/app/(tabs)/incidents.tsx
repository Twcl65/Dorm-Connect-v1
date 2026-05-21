import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
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
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
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
      setTitle("");
      setDescription("");
      setShowForm(false);
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

  if (loading && reports.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>Report issues for rooms on your active reservations.</Subtitle>
      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        label={showForm ? "Cancel new report" : "New incident report"}
        variant="outline"
        onPress={() => setShowForm((v) => !v)}
      />

      {showForm && (
        <Card>
          {rooms.length === 0 ? (
            <Text style={styles.hint}>
              You need an active reservation before you can file a report.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>Room</Text>
              <View style={styles.roomList}>
                {rooms.map((r) => (
                  <Button
                    key={r.roomId}
                    label={`${r.propertyName} · ${r.roomNo}`}
                    variant={roomId === r.roomId ? "primary" : "outline"}
                    onPress={() => setRoomId(r.roomId)}
                  />
                ))}
              </View>
              <Input placeholder="Title" value={title} onChangeText={setTitle} />
              <Input
                placeholder="Describe the issue…"
                value={description}
                onChangeText={setDescription}
                multiline
                style={styles.textArea}
              />
              <Button
                label="Submit report"
                onPress={() => void submit()}
                loading={saving}
              />
            </>
          )}
        </Card>
      )}

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
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {[item.propertyName, item.roomNo && `Room ${item.roomNo}`]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Text style={styles.meta}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            <Badge label={item.status} tone="warning" />
            <Text style={styles.body}>{item.description}</Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  hint: { fontSize: 13, color: "#64748b", lineHeight: 18 },
  empty: { fontSize: 13, color: "#64748b" },
  label: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 8 },
  roomList: { gap: 8, marginBottom: 8 },
  textArea: { minHeight: 88, textAlignVertical: "top" },
  title: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  body: { fontSize: 14, color: "#334155", marginTop: 8, lineHeight: 20 },
});
