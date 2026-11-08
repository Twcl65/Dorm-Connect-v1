import { Linking, StyleSheet, Text } from "react-native";
import { useState } from "react";
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
  const [error, setError] = useState<string | null>(null);

  const openReport = async (path: string) => {
    const url = `${getApiBaseUrl()}${path}`;
    try {
      await Linking.openURL(url);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not open the report. Sign in on the website to download it."
      );
    }
  };

  return (
    <Screen>
      <Subtitle>Download reports (DOCX)</Subtitle>
      <Text style={styles.hint}>
        Opens in your browser. Stay signed in on the website if the download
        asks you to log in.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {REPORTS.map((r) => (
        <Card key={r.path}>
          <Text style={styles.label}>{r.label}</Text>
          <Button
            label="Download"
            variant="outline"
            onPress={() => void openReport(r.path)}
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
  error: { fontSize: 12, color: colors.red, marginBottom: 8 },
});
