import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordTenantAnnouncement,
  type OsaAnnouncement,
} from "@/lib/api";
import {
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

type PropertyOpt = { id: string; name: string };

export default function LandlordAnnouncementsTab() {
  const { token } = useAuth();
  const [osa, setOsa] = useState<OsaAnnouncement[]>([]);
  const [sent, setSent] = useState<LandlordTenantAnnouncement[]>([]);
  const [properties, setProperties] = useState<PropertyOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const [osaRes, tenantRes] = await Promise.all([
      apiRequest<{ announcements: OsaAnnouncement[] }>(
        "/api/landlord/announcements",
        { token }
      ),
      apiRequest<{
        announcements: LandlordTenantAnnouncement[];
        properties: PropertyOpt[];
      }>("/api/landlord/tenant-announcements", { token }),
    ]);
    setOsa(osaRes.announcements ?? []);
    setSent(tenantRes.announcements ?? []);
    setProperties(tenantRes.properties ?? []);
    if (!propertyId && tenantRes.properties?.[0]) {
      setPropertyId(tenantRes.properties[0].id);
    }
  }, [token, propertyId]);

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

  const submitAnnouncement = async () => {
    if (!token || !propertyId || !title.trim() || !body.trim()) {
      setError("Property, title, and message are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/landlord/tenant-announcements", {
        token,
        method: "POST",
        body: {
          propertyId,
          title: title.trim(),
          body: body.trim(),
          audience: "all_booked",
        },
      });
      setModalOpen(false);
      setTitle("");
      setBody("");
      await load();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && osa.length === 0 && sent.length === 0) {
    return <CenteredLoader />;
  }

  return (
    <Screen style={styles.screen}>
      <Title style={{ color: colors.brand }}>Announcement</Title>
      <Subtitle>OSA updates and messages to tenants</Subtitle>

      <Button
        label="New announcement"
        variant="brand"
        onPress={() => setModalOpen(true)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
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
      >
        <Text style={styles.section}>From OSA</Text>
        {osa.length === 0 ? (
          <Card>
            <Text style={styles.empty}>No OSA announcements.</Text>
          </Card>
        ) : (
          osa.map((a) => (
            <Card key={a.id}>
              <Text style={styles.cardTitle}>{a.title}</Text>
              <Text style={styles.meta}>{a.date}</Text>
              <Text style={styles.body}>{a.message}</Text>
            </Card>
          ))
        )}

        <Text style={styles.section}>Your announcements to tenants</Text>
        {sent.length === 0 ? (
          <Card>
            <Text style={styles.empty}>You have not sent any yet.</Text>
          </Card>
        ) : (
          sent.map((a) => (
            <Card key={a.id}>
              <Text style={styles.cardTitle}>{a.title}</Text>
              <Text style={styles.meta}>
                {a.propertyName} · {a.date}
                {a.targetStudentName
                  ? ` · To: ${a.targetStudentName}`
                  : " · All booked tenants"}
              </Text>
              <Text style={styles.body}>{a.message}</Text>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New tenant announcement</Text>
            <Text style={styles.label}>Property</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {properties.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.chip,
                    propertyId === p.id && styles.chipActive,
                  ]}
                  onPress={() => setPropertyId(p.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      propertyId === p.id && styles.chipTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Input
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
            />
            <Input
              placeholder="Message"
              value={body}
              onChangeText={setBody}
              multiline
              style={styles.textArea}
            />
            <Button
              label={saving ? "Posting…" : "Post to all booked tenants"}
              variant="brand"
              loading={saving}
              onPress={() => void submitAnnouncement()}
            />
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setModalOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  body: { fontSize: 13, color: colors.text, marginTop: 8, lineHeight: 19 },
  empty: { fontSize: 13, color: colors.muted },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "85%",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: colors.brand },
  chipText: { fontSize: 12, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  textArea: { minHeight: 100, textAlignVertical: "top" },
});
