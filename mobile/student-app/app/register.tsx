import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AuthScreenLayout } from "@/components/auth-screen-layout";
import { authTheme } from "@/lib/auth-theme";
import { getApiBaseUrl } from "@/lib/config";
import { Button, colors, Input, PasswordInput } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { pickImagesFromLibrary } from "@/lib/landlord-rooms";
import { homeHrefForRole } from "@/lib/auth-routes";

type ProfilePhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
};

export default function RegisterScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [course, setCourse] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<ProfilePhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickProfilePhoto = async () => {
    const picked = await pickImagesFromLibrary(1);
    if (picked[0]) setProfilePhoto(picked[0]);
  };

  const handleRegister = async () => {
    setError(null);
    if (
      !fullName.trim() ||
      !email.trim() ||
      !password ||
      !studentId.trim() ||
      !course.trim() ||
      !emergencyName.trim() ||
      !emergencyPhone.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!profilePhoto) {
      setError("Profile picture is required.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("fullName", fullName.trim());
      form.append("email", email.trim().toLowerCase());
      form.append("password", password);
      form.append("studentId", studentId.trim());
      form.append("course", course.trim());
      form.append("emergencyContactName", emergencyName.trim());
      form.append("emergencyContactPhone", emergencyPhone.trim());
      form.append("profileImage", {
        uri: profilePhoto.uri,
        name: profilePhoto.fileName,
        type: profilePhoto.mimeType,
      } as unknown as Blob);

      const res = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        return;
      }

      const signedIn = await signIn(email.trim().toLowerCase(), password);
      const home = homeHrefForRole(signedIn.role);
      if (home) {
        router.replace(home);
      } else {
        router.replace("/login");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout cardStyle={styles.registerCard}>
      <View style={styles.cardTitleRow}>
        <View style={styles.cardTitleIcon}>
          <Ionicons name="person-add-outline" size={18} color={colors.brand} />
        </View>
        <Text style={styles.cardTitle}>Student registration</Text>
      </View>
      <Text style={styles.cardDesc}>
        Create your DormConnect account. ICT will verify your details — you can
        browse accredited listings while pending, but booking opens after
        verification.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Full name</Text>
      <Input
        value={fullName}
        onChangeText={setFullName}
        editable={!loading}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Email</Text>
      <Input
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <Text style={styles.label}>Password (8+ characters)</Text>
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Student ID</Text>
          <Input
            value={studentId}
            onChangeText={setStudentId}
            editable={!loading}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Course</Text>
          <Input
            value={course}
            onChangeText={setCourse}
            editable={!loading}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Emergency contact name</Text>
          <Input
            value={emergencyName}
            onChangeText={setEmergencyName}
            editable={!loading}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Emergency contact phone</Text>
          <Input
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            editable={!loading}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <Text style={styles.label}>Profile picture</Text>
      {profilePhoto ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: profilePhoto.uri }} style={styles.photoImage} />
          <Text style={styles.photoName} numberOfLines={1}>
            {profilePhoto.fileName}
          </Text>
          <Button
            label="Change photo"
            variant="outline"
            onPress={() => void pickProfilePhoto()}
            fullWidth
          />
        </View>
      ) : (
        <Button
          label="Select profile photo"
          variant="outline"
          onPress={() => void pickProfilePhoto()}
          fullWidth
        />
      )}

      <View style={{ marginTop: 4 }}>
        <Button
          variant="brand"
          label={loading ? "Creating account…" : "Register"}
          onPress={() => void handleRegister()}
          loading={loading}
          fullWidth
        />
      </View>

      <View style={styles.linkRow}>
        <Text style={styles.linkMuted}>Already have an account? </Text>
        <Link href={"/login" as Href} asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  registerCard: {
    paddingBottom: 20,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cardTitleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  half: {
    flex: 1,
  },
  photoPreview: {
    gap: 8,
    marginBottom: 4,
  },
  photoImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    alignSelf: "center",
    backgroundColor: authTheme.backgroundAlt,
  },
  photoName: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: "#991b1b",
    lineHeight: 17,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  linkMuted: {
    fontSize: 12,
    color: colors.muted,
  },
  link: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
});
