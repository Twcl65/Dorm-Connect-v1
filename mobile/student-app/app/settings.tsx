import { Redirect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  ApiError,
  apiRequest,
  type ProfilePayload,
  formatSignInError,
} from "@/lib/api";
import {
  Button,
  Card,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function SettingsScreen() {
  const { token, user, refreshUser, signOut } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<{ profile: ProfilePayload }>(
      "/api/account/profile",
      { token }
    );
    setProfile(res.profile);
    setFullName(res.profile.fullName);
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

  const save = async () => {
    if (!token) return;
    const name = fullName.trim();
    if (!name) {
      Alert.alert("Name required", "Enter your full name.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/api/account/profile", {
        method: "PATCH",
        token,
        body: { fullName: name },
      });
      await refreshUser();
      await load();
      Alert.alert("Saved", "Your profile was updated.");
    } catch (e) {
      Alert.alert(
        "Could not save",
        e instanceof ApiError ? e.message : "Request failed."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) return <CenteredLoader />;

  return (
    <Screen>
      <ScrollView>
        <Subtitle>Account details (same as the student website)</Subtitle>
        {error && <Text style={styles.error}>{error}</Text>}

        <Card>
          <Text style={styles.label}>Full name</Text>
          <Input value={fullName} onChangeText={setFullName} />
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email ?? user?.email}</Text>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{profile?.role ?? user?.role}</Text>
          {profile?.studentId ? (
            <>
              <Text style={styles.label}>Student ID</Text>
              <Text style={styles.value}>{profile.studentId}</Text>
            </>
          ) : null}
          <Text style={styles.label}>ICT verification</Text>
          <Text style={styles.value}>
            {user?.ictVerificationStatus ?? "—"}
          </Text>
          <Button label="Save name" onPress={() => void save()} loading={saving} />
        </Card>

        <Button
          label="Sign out"
          variant="danger"
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  label: { fontSize: 11, color: "#94a3b8", marginTop: 10 },
  value: { fontSize: 15, color: colors.text, fontWeight: "500" },
});
