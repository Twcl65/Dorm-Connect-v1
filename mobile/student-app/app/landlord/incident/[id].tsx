import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordIncident,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/config";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Input,
  Screen,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function IncidentDetailScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<LandlordIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    if (!token || !id) return;
    const res = await apiRequest<{ reports: LandlordIncident[] }>(
      "/api/landlord/incidents",
      { token }
    );
    const found = (res.reports ?? []).find((r) => r.id === id) ?? null;
    setReport(found);
    if (found?.landlordReply) {
      setReply(found.landlordReply);
    }
  }, [token, id]);

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

  const submitReply = async () => {
    if (!token || !id) return;
    const trimmed = reply.trim();
    if (!trimmed) {
      setError("Write a reply before sending.");
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      await apiRequest(`/api/landlord/incidents/${id}`, {
        token,
        method: "PATCH",
        body: { reply: trimmed },
      });
      await load();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setUpdating(false);
    }
  };

  const setStatus = async (status: "Resolved") => {
    if (!token || !id) return;
    setUpdating(true);
    setError(null);
    try {
      await apiRequest(`/api/landlord/incidents/${id}`, {
        token,
        method: "PATCH",
        body: { status },
      });
      await load();
      router.back();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <CenteredLoader />;
  if (!report) {
    return (
      <Screen>
        <Text style={styles.error}>Incident not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Text style={styles.title}>{report.title}</Text>
            <Badge label={report.status} tone="warning" />
          </View>
          <Text style={styles.meta}>
            {new Date(report.createdAt).toLocaleString()}
          </Text>
          <Text style={styles.meta}>
            {report.reporterName} · {report.propertyName ?? "—"} · Room{" "}
            {report.roomNo ?? "—"}
          </Text>

          <Card>
            <Text style={styles.label}>Student report</Text>
            <Text style={styles.body}>{report.description}</Text>
          </Card>

          {report.imageUrls.length > 0 ? (
            <Card>
              <Text style={styles.label}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {report.imageUrls.map((url) => {
                  const uri = resolveMediaUrl(url);
                  if (!uri) return null;
                  return (
                    <Image key={url} source={{ uri }} style={styles.photo} />
                  );
                })}
              </ScrollView>
            </Card>
          ) : null}

          {report.landlordReply && report.landlordRepliedAt ? (
            <Card>
              <Text style={styles.label}>Your reply</Text>
              <Text style={styles.meta}>
                Sent {new Date(report.landlordRepliedAt).toLocaleString()}
              </Text>
              <Text style={styles.body}>{report.landlordReply}</Text>
            </Card>
          ) : null}

          {report.tenantReply && report.tenantRepliedAt ? (
            <Card>
              <Text style={styles.label}>Tenant reply</Text>
              <Text style={styles.meta}>
                Sent {new Date(report.tenantRepliedAt).toLocaleString()}
              </Text>
              <Text style={styles.body}>{report.tenantReply}</Text>
            </Card>
          ) : null}

          {report.status !== "Resolved" ? (
            <Card>
              <Text style={styles.label}>
                {report.landlordReply ? "Update reply" : "Reply to student"}
              </Text>
              <Input
                placeholder="Write your response to the student…"
                value={reply}
                onChangeText={setReply}
                multiline
                numberOfLines={4}
                style={styles.textArea}
                editable={!updating}
              />
              <View style={styles.actions}>
                <Button
                  label={report.landlordReply ? "Update reply" : "Send reply"}
                  variant="brand"
                  loading={updating}
                  onPress={() => void submitReply()}
                  disabled={!reply.trim()}
                />
                <Button
                  label="Mark as resolved"
                  variant="outline"
                  loading={updating}
                  onPress={() => void setStatus("Resolved")}
                />
              </View>
            </Card>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  body: { fontSize: 14, color: colors.text, lineHeight: 21 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 8,
  },
  photo: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#f1f5f9",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  error: { color: colors.red, fontSize: 13, marginVertical: 8 },
  actions: { gap: 10, marginTop: 12, marginBottom: 24 },
});
