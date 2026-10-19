import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AuthScreenLayout } from "@/components/auth-screen-layout";
import { checkApiReachable, formatSignInError } from "@/lib/api";
import { authTheme } from "@/lib/auth-theme";
import { describeApiBaseUrl } from "@/lib/config";
import { Button, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { homeHrefForRole } from "@/lib/auth-routes";

type ApiStatus = "checking" | "ok" | "unreachable" | "wrong_host";

function FieldIconInput({
  icon,
  ...props
}: ComponentProps<typeof TextInput> & {
  icon: ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons
        name={icon}
        size={18}
        color={colors.muted}
        style={styles.inputIcon}
      />
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

function PasswordField({
  value,
  onChangeText,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSubmitEditing?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.inputWrap}>
      <Ionicons
        name="lock-closed-outline"
        size={18}
        color={colors.muted}
        style={styles.inputIcon}
      />
      <TextInput
        placeholder="••••••••"
        placeholderTextColor={colors.muted}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        style={[styles.input, styles.passwordInput]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.eyeBtn}
        hitSlop={8}
        accessibilityLabel={visible ? "Hide password" : "Show password"}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={colors.muted}
        />
      </Pressable>
    </View>
  );
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  const runApiCheck = useCallback(async () => {
    setApiStatus("checking");
    const result = await checkApiReachable();
    setApiStatus(result);
  }, []);

  useEffect(() => {
    void runApiCheck();
  }, [runApiCheck]);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const signedIn = await signIn(email.trim(), password);
      const home = homeHrefForRole(signedIn.role);
      if (!home) {
        setError("This account type cannot use the mobile app.");
        return;
      }
      router.replace(home);
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setLoading(false);
    }
  };

  const apiHint = describeApiBaseUrl();
  const statusLine =
    apiStatus === "checking"
      ? "Checking API connection…"
      : apiStatus === "ok"
        ? "API reachable"
        : apiStatus === "wrong_host"
          ? "API URL looks wrong for this device (use PC Wi‑Fi IP)"
          : "Cannot reach API — start npm run dev on your PC";

  return (
    <AuthScreenLayout
      footer={
        <>
          <Text
            style={[
              styles.status,
              apiStatus === "ok" && styles.statusOk,
              (apiStatus === "unreachable" || apiStatus === "wrong_host") &&
                styles.statusBad,
            ]}
          >
            {statusLine}
          </Text>
          <Text style={styles.hint}>Application: {apiHint}</Text>
          {(apiStatus === "unreachable" || apiStatus === "wrong_host") && (
            <Button
              label="Retry connection check"
              variant="outline"
              onPress={() => void runApiCheck()}
            />
          )}
        </>
      }
    >
      <View style={styles.cardTitleRow}>
        <View style={styles.cardTitleIcon}>
          <Ionicons name="log-in-outline" size={18} color={colors.brand} />
        </View>
        <Text style={styles.cardTitle}>Sign in to DormConnect</Text>
      </View>
      <Text style={styles.cardDesc}>
        Enter your email and password. Student and landlord accounts use the same
        credentials as the website. Only active accounts can sign in.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Email</Text>
      <FieldIconInput
        icon="mail-outline"
        placeholder="you@ustp.edu.ph"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <Text style={styles.label}>Password</Text>
      <PasswordField
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => void handleLogin()}
      />

      <Button
        variant="brand"
        label={loading ? "Signing in…" : "Login"}
        onPress={() => void handleLogin()}
        loading={loading}
        fullWidth
      />

      <Text style={styles.footerNote}>
        Students pending ICT verification can browse but may not book until
        verified. Admin accounts must use the website.
      </Text>

      <View style={styles.linkRow}>
        <Text style={styles.linkMuted}>New student? </Text>
        <Link href={"/register" as Href} asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
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
  },
  inputWrap: {
    position: "relative",
    marginBottom: 14,
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    top: 13,
    zIndex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingLeft: 40,
    paddingRight: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.text,
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    padding: 6,
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
  footerNote: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 14,
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
  status: { fontSize: 12, color: authTheme.textMuted, textAlign: "center" },
  statusOk: { color: colors.emerald },
  statusBad: { color: "#fca5a5" },
  hint: {
    fontSize: 11,
    color: authTheme.textDim,
    textAlign: "center",
    lineHeight: 16,
  },
});
