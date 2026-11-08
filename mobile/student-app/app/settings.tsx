import { Redirect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text } from "react-native";
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
import { uploadMobileFile } from "@/lib/upload";

export default function SettingsScreen() {
  const { token, user, refreshUser, signOut } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [location, setLocation] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [gcashAccountName, setGcashAccountName] = useState("");
  const [gcashPhone, setGcashPhone] = useState("");
  const [gcashQrCodeUrl, setGcashQrCodeUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
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
    setStudentId(res.profile.studentId ?? "");
    setFatherName(res.profile.fatherName ?? "");
    setMotherName(res.profile.motherName ?? "");
    setLocation(res.profile.location ?? "");
    setProfileImageUrl(res.profile.profileImageUrl);
    setGcashAccountName(res.profile.gcashAccountName ?? "");
    setGcashPhone(res.profile.gcashPhone ?? "");
    setGcashQrCodeUrl(res.profile.gcashQrCodeUrl ?? null);
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
        body: {
          fullName: name,
          profileImageUrl: profileImageUrl ?? "",
          ...(profile?.role === "Student"
            ? {
                studentId: studentId.trim() || null,
                fatherName: fatherName.trim() || null,
                motherName: motherName.trim() || null,
                location: location.trim() || null,
              }
            : {}),
          ...(profile?.role === "Landlord"
            ? {
                gcashAccountName: gcashAccountName.trim() || null,
                gcashPhone: gcashPhone.trim() || null,
                gcashQrCodeUrl: gcashQrCodeUrl ?? "",
              }
            : {}),
        },
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

  const pickImage = async (target: "profile" | "gcash") => {
    if (!token) return;
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo access to choose an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;

      setSaving(true);
      const url = await uploadMobileFile(
        token,
        asset.uri,
        asset.fileName ?? (target === "profile" ? "profile-photo.jpg" : "gcash-qr.jpg"),
        asset.mimeType ?? "image/jpeg"
      );
      if (target === "profile") {
        await apiRequest("/api/account/profile", {
          method: "PATCH",
          token,
          body: { profileImageUrl: url },
        });
        setProfileImageUrl(url);
        await refreshUser();
      } else {
        await apiRequest("/api/account/profile", {
          method: "PATCH",
          token,
          body: { gcashQrCodeUrl: url },
        });
        setGcashQrCodeUrl(url);
      }
      Alert.alert("Uploaded", target === "profile" ? "Profile photo updated." : "GCash QR code updated.");
    } catch (e) {
      Alert.alert("Could not upload", formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
    if (!token) return;
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords do not match", "Confirm the new password and try again.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters for your new password.");
      return;
    }

    setSavingPassword(true);
    try {
      await apiRequest("/api/account/password", {
        method: "POST",
        token,
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Updated", "Your password was changed.");
    } catch (e) {
      Alert.alert("Could not update password", formatSignInError(e));
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading && !profile) return <CenteredLoader />;

  return (
    <Screen>
      <ScrollView>
        <Subtitle>Manage your account details</Subtitle>
        {error && <Text style={styles.error}>{error}</Text>}

        <Card>
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={styles.avatar} />
          ) : null}
          <Button
            label={profileImageUrl ? "Change profile photo" : "Add profile photo"}
            variant="outline"
            onPress={() => void pickImage("profile")}
            loading={saving}
          />
          <Text style={styles.label}>Full name</Text>
          <Input value={fullName} onChangeText={setFullName} />
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email ?? user?.email}</Text>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{profile?.role ?? user?.role}</Text>
          {profile?.role === "Student" ? (
            <>
              <Text style={styles.label}>Student ID</Text>
              <Input
                value={studentId}
                onChangeText={setStudentId}
                placeholder="School ID"
                maxLength={64}
                autoCapitalize="characters"
              />
              <Text style={styles.label}>Father name</Text>
              <Input
                value={fatherName}
                onChangeText={setFatherName}
                editable={!saving}
                autoCapitalize="words"
              />
              <Text style={styles.label}>Mother name</Text>
              <Input
                value={motherName}
                onChangeText={setMotherName}
                editable={!saving}
                autoCapitalize="words"
              />
              <Text style={styles.label}>Location</Text>
              <Input
                value={location}
                onChangeText={setLocation}
                editable={!saving}
                placeholder="City or municipality"
                autoCapitalize="words"
              />
            </>
          ) : null}
          <Text style={styles.label}>ICT verification</Text>
          <Text style={styles.value}>
            {user?.ictVerificationStatus ?? "—"}
          </Text>
          <Button label="Save profile" onPress={() => void save()} loading={saving} />
        </Card>

        {profile?.role === "Landlord" ? (
          <Card>
            <Text style={styles.sectionTitle}>GCash payment details</Text>
            <Text style={styles.help}>
              Students see these details when they choose GCash to pay.
            </Text>
            <Text style={styles.label}>Account name</Text>
            <Input value={gcashAccountName} onChangeText={setGcashAccountName} />
            <Text style={styles.label}>GCash number</Text>
            <Input
              value={gcashPhone}
              onChangeText={setGcashPhone}
              keyboardType="phone-pad"
            />
            {gcashQrCodeUrl ? (
              <Image source={{ uri: gcashQrCodeUrl }} style={styles.qrCode} />
            ) : null}
            <Button
              label={gcashQrCodeUrl ? "Change GCash QR code" : "Add GCash QR code"}
              variant="outline"
              onPress={() => void pickImage("gcash")}
              loading={saving}
            />
          </Card>
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Security</Text>
          <Text style={styles.label}>Current password</Text>
          <Input
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <Text style={styles.label}>New password</Text>
          <Input
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Text style={styles.label}>Confirm new password</Text>
          <Input
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Button
            label="Update password"
            onPress={() => void updatePassword()}
            loading={savingPassword}
          />
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
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  help: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 6 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignSelf: "center",
    marginBottom: 12,
  },
  qrCode: {
    width: 180,
    height: 180,
    alignSelf: "center",
    resizeMode: "contain",
    marginBottom: 12,
  },
});
