import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
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

  const load = useCallback(async () => {
    if (!token || !id) return;
    const res = await apiRequest<{ reports: LandlordIncident[] }>(
      "/api/landlord/incidents",
      { token }
    );
    const found = (res.reports ?? []).find((r) => r.id === id) ?? null;
    setReport(found);
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

  const setStatus = async (status: "Acknowledged" | "Resolved") => {
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
      if (status === "Resolved") router.back();
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
      <ScrollView>
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {report.status !== "Resolved" ? (
          <View style={styles.actions}>
            {report.status === "Open" ? (
              <Button
                label="Acknowledge"
                variant="outline"
                loading={updating}
                onPress={() => void setStatus("Acknowledged")}
              />
            ) : null}
            <Button
              label="Mark as resolved"
              variant="brand"
              loading={updating}
              onPress={() => void setStatus("Resolved")}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8 },
  photo: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#f1f5f9",
  },
  error: { color: colors.red, fontSize: 13, marginVertical: 8 },
  actions: { gap: 10, marginTop: 16, marginBottom: 24 },
});
