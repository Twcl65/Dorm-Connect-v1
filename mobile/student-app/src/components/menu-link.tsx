import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/components/ui";

export function MenuLink({
  href,
  label,
  subtitle,
  icon,
}: {
  href: Href;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const router = useRouter();

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push(href)}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.navy} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  body: { flex: 1 },
  label: { fontSize: 15, fontWeight: "600", color: colors.navy },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
