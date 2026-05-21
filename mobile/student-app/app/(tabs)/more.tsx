import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { MenuLink } from "@/components/menu-link";
import { Button, Card, Screen, Subtitle, Title, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen>
      <Title>More</Title>
      <Subtitle>Account and app options</Subtitle>

      <Card>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.meta}>
          ICT: {user?.ictVerificationStatus ?? "—"}
        </Text>
      </Card>

      <MenuLink
        href="/settings"
        label="Account & settings"
        subtitle="Profile, name, and student ID"
        icon="settings-outline"
      />

      <Button
        label="Sign out"
        variant="danger"
        onPress={() => void handleSignOut()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  email: { fontSize: 14, color: "#64748b", marginTop: 4 },
  meta: { fontSize: 13, color: "#64748b", marginTop: 8 },
});
