import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { getApiBaseUrl } from "@/lib/config";
import { Button, Card, Screen, Subtitle, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const PDF_MIME_TYPE = "application/pdf";

const REPORTS = [
  {
    label: "Tenants report",
    path: "/api/landlord/reports/tenants",
    fileName: "tenants-report.pdf",
  },
  {
    label: "Reservations report",
    path: "/api/landlord/reports/reservations",
    fileName: "reservations-report.pdf",
  },
  {
    label: "Payments report",
    path: "/api/landlord/reports/payments",
    fileName: "payments-report.pdf",
  },
  {
    label: "Rooms report",
    path: "/api/landlord/reports/rooms",
    fileName: "rooms-report.pdf",
  },
] as const;

export default function LandlordReportsScreen() {
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const downloadReport = async (report: (typeof REPORTS)[number]) => {
    if (!token) {
      setError("Sign in to download reports.");
      return;
    }

    setDownloadingPath(report.path);
    setError(null);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}${report.path}?format=pdf`,
        {
          headers: {
            Accept: PDF_MIME_TYPE,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const responseText = await response.text();
        let message = `Could not download report (${response.status}).`;
        try {
          const data = JSON.parse(responseText) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // Keep the HTTP status message when the server response is not JSON.
        }
        throw new Error(message);
      }
      const contentType = response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();
      if (contentType !== PDF_MIME_TYPE) {
        throw new Error("The server did not return a PDF report.");
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (Platform.OS === "web") {
        const fileUrl = URL.createObjectURL(
          new Blob([bytes], { type: PDF_MIME_TYPE })
        );
        const anchor = document.createElement("a");
        anchor.href = fileUrl;
        anchor.download = report.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
      } else {
        const file = new FileSystem.File(
          FileSystem.Paths.cache,
          report.fileName
        );
        file.create({ overwrite: true });
        file.write(bytes);
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error("File sharing is not available on this device.");
        }
        await Sharing.shareAsync(file.uri, {
          dialogTitle: `Download ${report.label.toLowerCase()}`,
          mimeType: PDF_MIME_TYPE,
          UTI: "com.adobe.pdf",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the report.");
    } finally {
      setDownloadingPath(null);
    }
  };

  return (
    <Screen>
      <Subtitle>Download reports (PDF)</Subtitle>
      <Text style={styles.hint}>
        Reports are downloaded using your mobile sign-in.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {REPORTS.map((r) => (
        <Card key={r.path}>
          <Text style={styles.label}>{r.label}</Text>
          <Button
            label={downloadingPath === r.path ? "Preparing…" : "Download"}
            variant="outline"
            loading={downloadingPath === r.path}
            disabled={downloadingPath !== null}
            onPress={() => void downloadReport(r)}
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
