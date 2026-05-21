import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordAccreditationRow,
} from "@/lib/api";
import { Badge, Card, CenteredLoader, Screen, Subtitle, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function LandlordDocumentsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordAccreditationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await apiRequest<{ requests: LandlordAccreditationRow[] }>(
            "/api/landlord/accreditation",
            { token: token! }
          );
          setItems(res.requests ?? []);
          setError(null);
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [token])
  );

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>Accreditation requests</Subtitle>
      <Text style={styles.hint}>
        Full document upload and editing is available on the landlord website.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>No accreditation requests.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.name}>{item.dormName}</Text>
              <Badge label={item.status} tone="default" />
            </View>
            <Text style={styles.meta}>{item.address}</Text>
            <Text style={styles.meta}>
              {item.documentsCount} documents · Submitted{" "}
              {item.submittedDate}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  error: { color: colors.red, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  empty: { fontSize: 13, color: colors.muted },
});
