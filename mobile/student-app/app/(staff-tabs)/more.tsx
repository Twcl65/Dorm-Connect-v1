import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { MenuLink } from "@/components/menu-link";
import { Button, Card, Screen, Subtitle, Title, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function StaffMoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>Menu</Title>
      <Subtitle>Profile and account options</Subtitle>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card>
          <Text style={styles.name}>{user?.name ?? "OSA Staff"}</Text>
          <Text style={styles.email}>{user?.email ?? ""}</Text>
          <Text style={styles.role}>OSA Staff</Text>
        </Card>

        <MenuLink
          href="/settings"
          label="Profile & account"
          subtitle="Update your profile details and password"
          icon="person-circle-outline"
        />

        <Button
          label="Log out"
          variant="danger"
          onPress={() => void handleSignOut()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  name: { color: colors.text, fontSize: 16, fontWeight: "600" },
  email: { color: colors.muted, fontSize: 13, marginTop: 4 },
  role: { color: colors.muted, fontSize: 12, marginTop: 8 },
});
