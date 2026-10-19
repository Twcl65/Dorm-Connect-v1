import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { Card, CenteredLoader, Subtitle, colors } from "@/components/ui";
import { type ApiErrorResponse, apiRequest } from "@/lib/api";

type TermsContent = {
  overview: string;
  paymentAndRemoval: string;
  consequences: string;
  examples: string;
};

type TermsData = {
  title: string;
  content: TermsContent;
};

export default function TermsScreen() {
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ terms: TermsData }>("/api/terms");
      setTerms(res.terms ?? null);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to load terms";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <CenteredLoader />;

  if (error || !terms) {
    return (
      <Card>
        <Text style={styles.error}>
          {error ?? "No terms available"}
        </Text>
      </Card>
    );
  }

  const renderSection = (heading: string, body: string) => {
    if (!body || !body.trim()) return null;
    return (
      <>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.body}>{body}</Text>
      </>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{terms.title || "Terms & Conditions"}</Text>
      <Subtitle style={styles.subtitle}>Dorm-Connect Platform</Subtitle>

      {renderSection("Overview", terms.content.overview)}
      {renderSection("Payment & Removal", terms.content.paymentAndRemoval)}
      {renderSection("Consequences", terms.content.consequences)}
      {renderSection("Examples", terms.content.examples)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 16 },
  heading: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginTop: 16,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  error: { color: "#dc2626", fontSize: 14, padding: 16 },
});
