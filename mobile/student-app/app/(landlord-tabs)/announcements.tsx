import { useCallback, useEffect, useState } from "react";
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
import { SelectField } from "@/components/select-field";

type PropertyOpt = { id: string; name: string };
type TenantStudent = {
  studentUserId: string;
  fullName: string;
  roomNo: string;
};

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
  const [audience, setAudience] = useState<"all_booked" | "single_student">(
    "all_booked"
  );
  const [targetStudentUserId, setTargetStudentUserId] = useState("");
  const [eligibleStudents, setEligibleStudents] = useState<TenantStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
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

  // Load eligible students when single_student audience + property selected
  useEffect(() => {
    if (!token || !propertyId || audience !== "single_student") {
      setEligibleStudents([]);
      setTargetStudentUserId("");
      return;
    }
    let cancelled = false;
    setLoadingStudents(true);
    void (async () => {
      try {
        const res = await apiRequest<{ students?: TenantStudent[] }>(
          `/api/landlord/tenant-announcements/eligible-students?propertyId=${encodeURIComponent(propertyId)}`,
          { token }
        );
        if (!cancelled) {
          setEligibleStudents(res.students ?? []);
          setTargetStudentUserId("");
        }
      } catch {
        if (!cancelled) {
          setEligibleStudents([]);
          setTargetStudentUserId("");
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, propertyId, audience]);

  const submitAnnouncement = async () => {
    if (!token || !propertyId || !title.trim() || !body.trim()) {
      setError("Property, title, and message are required.");
      return;
    }
    if (audience === "single_student" && !targetStudentUserId) {
      setError("Please select a student.");
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
          audience,
          targetStudentUserId:
            audience === "single_student" ? targetStudentUserId : null,
        },
      });
      setModalOpen(false);
      setTitle("");
      setBody("");
      setTargetStudentUserId("");
      setAudience("all_booked");
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

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const audienceOptions = [
    { value: "all_booked", label: "All booked students at this dorm" },
    { value: "single_student", label: "One student only" },
  ];

  const studentOptions = eligibleStudents.map((s) => ({
    value: s.studentUserId,
    label: `${s.fullName} — Room ${s.roomNo}`,
  }));

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
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetTitle}>New tenant announcement</Text>

              <SelectField
                label="Dorm / property"
                placeholder="Select property"
                value={propertyId}
                options={propertyOptions}
                onChange={setPropertyId}
                emptyMessage="Add a property under Properties & Rooms first."
              />

              <SelectField
                label="Send to"
                placeholder="Select audience"
                value={audience}
                options={audienceOptions}
                onChange={(val) =>
                  setAudience(
                    val === "single_student" ? "single_student" : "all_booked"
                  )
                }
              />

              {audience === "single_student" && propertyId ? (
                loadingStudents ? (
                  <Text style={styles.loadingHint}>Loading students…</Text>
                ) : eligibleStudents.length === 0 ? (
                  <Text style={styles.noStudentsHint}>
                    No active reservations at this dorm. Students must have a
                    pending or confirmed booking.
                  </Text>
                ) : (
                  <SelectField
                    label="Student"
                    placeholder="Select student"
                    value={targetStudentUserId}
                    options={studentOptions}
                    onChange={setTargetStudentUserId}
                  />
                )
              ) : null}

              <Text style={styles.label}>Title</Text>
              <Input
                placeholder="e.g. Rent collection — March"
                value={title}
                onChangeText={setTitle}
              />
              <Text style={styles.label}>Message</Text>
              <Input
                placeholder="e.g. Please settle March rent by Friday."
                value={body}
                onChangeText={setBody}
                multiline
                style={styles.textArea}
              />
              <View style={{ marginTop: 12, gap: 8 }}>
                <Button
                  label={saving ? "Posting…" : "Post to students"}
                  variant="brand"
                  loading={saving}
                  disabled={
                    !propertyId ||
                    !title.trim() ||
                    !body.trim() ||
                    (audience === "single_student" && !targetStudentUserId)
                  }
                  onPress={() => void submitAnnouncement()}
                />
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setModalOpen(false)}
                />
              </View>
            </ScrollView>
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
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  loadingHint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    fontStyle: "italic",
  },
  noStudentsHint: {
    fontSize: 12,
    color: "#92400e",
    marginTop: 8,
    lineHeight: 17,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
});
