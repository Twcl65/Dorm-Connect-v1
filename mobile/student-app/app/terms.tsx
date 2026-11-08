import { useCallback, useState } from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SelectField } from "@/components/select-field";
import { Card, CenteredLoader, Subtitle, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, formatSignInError, type MapProperty } from "@/lib/api";

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

const emptyTerms: TermsData = {
  title: "Terms & Conditions",
  content: { overview: "", paymentAndRemoval: "", consequences: "", examples: "" },
};

export default function TermsScreen() {
  const { token } = useAuth();
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTerms = useCallback(async (selectedPropertyId: string) => {
    const query = selectedPropertyId
      ? `?propertyId=${encodeURIComponent(selectedPropertyId)}`
      : "";
    const response = await apiRequest<{ terms?: TermsData }>(`/api/terms${query}`, {
      token,
    });
    setTerms(response.terms ?? emptyTerms);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await apiRequest<{ properties: MapProperty[] }>(
            "/api/student/map-properties",
            { token }
          );
          if (!active) return;
          const rows = response.properties ?? [];
          setProperties(rows);
          const initialPropertyId = rows[0]?.id ?? "";
          setPropertyId(initialPropertyId);
          await loadTerms(initialPropertyId);
        } catch (e) {
          if (active) setError(formatSignInError(e));
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [token, loadTerms])
  );

  const selectProperty = async (selectedPropertyId: string) => {
    setPropertyId(selectedPropertyId);
    setLoading(true);
    setError(null);
    try {
      await loadTerms(selectedPropertyId);
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CenteredLoader />;

  const renderSection = (heading: string, body: string) => {
    if (!body?.trim()) return null;
    return (
      <View key={heading}>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Terms & Conditions</Text>
      <Subtitle style={styles.subtitle}>
        View the terms and house rules for an establishment.
      </Subtitle>

      {properties.length > 0 ? (
        <>
          <SelectField
            label="Establishment"
            placeholder="Choose an establishment"
            value={propertyId}
            options={properties.map((property) => ({
              value: property.id,
              label: property.name,
            }))}
            onChange={(value) => void selectProperty(value)}
          />
          <Text style={styles.hint}>
            Property-specific terms are shown when available; otherwise, platform terms are displayed.
          </Text>
        </>
      ) : null}

      {error ? (
        <Card>
          <Text style={styles.error}>{error}</Text>
        </Card>
      ) : terms ? (
        <Card>
          <Text style={styles.termsTitle}>{terms.title || "Terms & Conditions"}</Text>
          {renderSection("Overview", terms.content?.overview ?? "")}
          {renderSection("Payment & Removal", terms.content?.paymentAndRemoval ?? "")}
          {renderSection("Consequences", terms.content?.consequences ?? "")}
          {renderSection("Examples", terms.content?.examples ?? "")}
          {!Object.values(terms.content ?? {}).some((body) => body?.trim()) ? (
            <Text style={styles.body}>No terms have been added yet.</Text>
          ) : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  termsTitle: { fontSize: 18, fontWeight: "700", color: colors.navy, marginBottom: 4 },
  heading: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginTop: 16,
    marginBottom: 6,
  },
  body: { fontSize: 14, color: colors.text, lineHeight: 22 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 12 },
  error: { color: colors.red, fontSize: 14 },
});
