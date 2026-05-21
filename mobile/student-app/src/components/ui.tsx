import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

/** Orange brand — header & tab bar only (matches web primary #FF9718). */
export const colors = {
  brand: "#FF9718",
  brandDark: "#e08614",
  brandMuted: "rgba(255, 151, 24, 0.12)",
  navy: "#0f172a",
  navyLight: "#1e293b",
  sky: "#0ea5e9",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  white: "#ffffff",
  emerald: "#059669",
  amber: "#d97706",
  red: "#dc2626",
};

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Title({
  children,
  style,
}: {
  children: string;
  style?: TextStyle;
}) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({
  children,
  style,
}: {
  children: string;
  style?: TextStyle;
}) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function PasswordInput({
  placeholder = "Password",
  value,
  onChangeText,
  ...rest
}: Omit<TextInputProps, "secureTextEntry">) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.passwordWrap}>
      <TextInput
        placeholderTextColor={colors.muted}
        placeholder={placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
        {...rest}
        style={[styles.input, styles.passwordField, rest.style]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.passwordToggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        hitSlop={8}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={22}
          color={colors.muted}
        />
      </Pressable>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "brand" | "outline" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === "brand" && styles.buttonBrand,
        variant === "outline" && styles.buttonOutline,
        variant === "danger" && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.navy : colors.white} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "outline" && styles.buttonTextOutline,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Badge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === "success" && styles.badgeSuccess,
        tone === "warning" && styles.badgeWarning,
        tone === "danger" && styles.badgeDanger,
      ]}
    >
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function CenteredLoader() {
  return (
    <View style={styles.loaderWrap}>
      <ActivityIndicator size="large" color={colors.sky} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.navy,
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: colors.white,
    marginBottom: 12,
  },
  passwordWrap: {
    position: "relative",
    marginBottom: 12,
  },
  passwordField: {
    marginBottom: 0,
    paddingRight: 44,
  },
  passwordToggle: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  button: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonBrand: {
    backgroundColor: colors.brand,
  },
  buttonOutline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: colors.red,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
  buttonTextOutline: {
    color: colors.navy,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  badgeSuccess: { backgroundColor: "#d1fae5" },
  badgeWarning: { backgroundColor: "#fef3c7" },
  badgeDanger: { backgroundColor: "#fee2e2" },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
});
