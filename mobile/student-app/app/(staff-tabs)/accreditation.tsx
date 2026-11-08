import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
} from "@/lib/api";
import {
  Badge,
  Card,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

type Accreditation = {
  id: string;
  dormName: string;
  address: string;
  status: string;
  submittedAt: string;
  ownerName: string;
  ownerEmail: string;
  expiresAt: string | null;
};

export default function StaffAccreditationScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Accreditation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const response = await apiRequest<{ items: Accreditation[] }>(
      "/api/osa/accreditation-monitoring",
      { token }
    );
    setItems(response.items ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [
        item.dormName,
        item.ownerName,
        item.ownerEmail,
        item.status,
        item.address,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [items, search]);

  if (loading && items.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>Accreditation</Title>
      <Subtitle>Monitor applications, status, and renewal dates</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search dorm, landlord, address, or status"
        autoCapitalize="none"
        style={styles.search}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } catch (e) {
                setError(formatSignInError(e));
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.meta}>
              {search.trim() ? "No records match your search." : "No accreditation records."}
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.heading}>
              <Text style={styles.name}>{item.dormName}</Text>
              <Badge
                label={item.status}
                tone={
                  item.status === "Approved"
                    ? "success"
                    : item.status === "Rejected"
                      ? "danger"
                      : "warning"
                }
              />
            </View>
            <Text style={styles.meta}>{item.address}</Text>
            <Text style={styles.meta}>
              Landlord: {item.ownerName} · {item.ownerEmail}
            </Text>
            <View style={styles.dates}>
              <Text style={styles.dateText}>Submitted: {item.submittedAt}</Text>
              <Text style={styles.dateText}>
                Expires: {item.expiresAt ?? "—"}
              </Text>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  search: { marginBottom: 10 },
  name: { color: colors.text, flex: 1, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  heading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  dates: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 10,
    paddingTop: 8,
  },
  dateText: { color: colors.muted, fontSize: 11 },
});
