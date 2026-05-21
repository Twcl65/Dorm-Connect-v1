import { Linking, StyleSheet, Text } from "react-native";
import { getApiBaseUrl } from "@/lib/config";
import { Button, Card, Screen, Subtitle, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const REPORTS = [
  { label: "Tenants report", path: "/api/landlord/reports/tenants" },
  { label: "Reservations report", path: "/api/landlord/reports/reservations" },
  { label: "Payments report", path: "/api/landlord/reports/payments" },
  { label: "Rooms report", path: "/api/landlord/reports/rooms" },
] as const;

export default function LandlordReportsScreen() {
  const { token } = useAuth();

  const openReport = async (path: string) => {
    const url = `${getApiBaseUrl()}${path}`;
    try {
      await Linking.openURL(url);
    } catch {
      /* user may need to sign in on web for cookie-based download */
    }
  };

  return (
    <Screen>
      <Subtitle>Download reports (DOCX)</Subtitle>
      <Text style={styles.hint}>
        Opens in your browser. Stay signed in on the website if the download
        asks you to log in.
      </Text>
      {REPORTS.map((r) => (
        <Card key={r.path}>
          <Text style={styles.label}>{r.label}</Text>
          <Button
            label="Download"
            variant="outline"
            onPress={() => void openReport(path)}
          />
        </Card>
      ))}
      {!token ? (
        <Text style={styles.hint}>Sign in required.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 17 },
  label: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 8 },
});
