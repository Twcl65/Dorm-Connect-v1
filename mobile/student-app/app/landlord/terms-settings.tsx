import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { SelectField } from "@/components/select-field";
import {
  Button,
  Card,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, formatSignInError, type LandlordPropertyRow } from "@/lib/api";

type TermsContent = {
  overview: string;
  paymentAndRemoval: string;
  consequences: string;
  examples: string;
};

type TermsPayload = { title: string; content: TermsContent };

const emptyTerms: TermsPayload = {
  title: "Terms & Conditions",
  content: { overview: "", paymentAndRemoval: "", consequences: "", examples: "" },
};

export default function LandlordTermsSettingsScreen() {
  const { token } = useAuth();
  const [properties, setProperties] = useState<LandlordPropertyRow[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [terms, setTerms] = useState<TermsPayload>(emptyTerms);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTerms = useCallback(async (selectedId: string) => {
    if (!token || !selectedId) return;
    const response = await apiRequest<{ terms?: TermsPayload }>(
      `/api/terms?propertyId=${encodeURIComponent(selectedId)}`,
      { token }
    );
    setTerms(response.terms ?? emptyTerms);
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    const response = await apiRequest<{ properties: LandlordPropertyRow[] }>(
      "/api/landlord/properties",
      { token }
    );
    const rows = response.properties ?? [];
    setProperties(rows);
    const selected = rows.some((property) => property.id === propertyId)
      ? propertyId
      : rows[0]?.id ?? "";
    setPropertyId(selected);
    if (selected) await loadTerms(selected);
  }, [token, propertyId, loadTerms]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          if (active) setError(formatSignInError(e));
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [load])
  );

  const selectProperty = async (id: string) => {
    setPropertyId(id);
    setError(null);
    setSuccess(null);
    try {
      await loadTerms(id);
    } catch (e) {
      setError(formatSignInError(e));
    }
  };

  const save = async () => {
    if (!token || !propertyId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest("/api/terms", {
        token,
        method: "POST",
        body: { ...terms, propertyId },
      });
      setSuccess("Terms and conditions saved.");
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  const updateContent = (key: keyof TermsContent, value: string) =>
    setTerms((current) => ({
      ...current,
      content: { ...current.content, [key]: value },
    }));

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Title>Terms & Conditions</Title>
      <Subtitle>Manage the house rules and terms shown to your tenants.</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      {properties.length === 0 ? (
        <Card>
          <Text style={styles.help}>Add a property before creating its terms and conditions.</Text>
        </Card>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          <SelectField
            label="Property"
            placeholder="Choose a property"
            value={propertyId}
            options={properties.map((property) => ({
              value: property.id,
              label: property.name,
            }))}
            onChange={(value) => void selectProperty(value)}
          />
          <Card>
            <Text style={styles.label}>Title</Text>
            <Input
              value={terms.title}
              onChangeText={(value) => setTerms((current) => ({ ...current, title: value }))}
            />
            <Text style={styles.label}>Overview</Text>
            <Input
              value={terms.content.overview}
              onChangeText={(value) => updateContent("overview", value)}
              multiline
              numberOfLines={5}
              style={styles.multiline}
            />
            <Text style={styles.label}>Payment & removal</Text>
            <Input
              value={terms.content.paymentAndRemoval}
              onChangeText={(value) => updateContent("paymentAndRemoval", value)}
              multiline
              numberOfLines={5}
              style={styles.multiline}
            />
            <Text style={styles.label}>Consequences</Text>
            <Input
              value={terms.content.consequences}
              onChangeText={(value) => updateContent("consequences", value)}
              multiline
              numberOfLines={5}
              style={styles.multiline}
            />
            <Text style={styles.label}>Examples</Text>
            <Input
              value={terms.content.examples}
              onChangeText={(value) => updateContent("examples", value)}
              multiline
              numberOfLines={5}
              style={styles.multiline}
            />
            <Button label="Save terms" variant="brand" onPress={() => void save()} loading={saving} />
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  success: { color: colors.emerald, fontSize: 13, marginBottom: 8 },
  help: { color: colors.muted, fontSize: 13 },
  label: { color: colors.text, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  multiline: { minHeight: 100, textAlignVertical: "top" },
});
