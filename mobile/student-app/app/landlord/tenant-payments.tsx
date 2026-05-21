import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordPayment,
} from "@/lib/api";
import {
  Badge,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function TenantPaymentsScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{
    leaseId?: string;
    tenantName?: string;
    roomNo?: string;
  }>();
  const leaseId = params.leaseId ?? "";
  const tenantName = params.tenantName ?? "Tenant";
  const roomNo = params.roomNo ?? "";

  const [items, setItems] = useState<LandlordPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ payments: LandlordPayment[] }>(
      "/api/landlord/payments",
      { token }
    );
    setItems(res.payments ?? []);
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
    const name = tenantName.toLowerCase();
    return items.filter((p) => {
      if (leaseId && p.tenantLeaseId === leaseId) return true;
      return p.name.toLowerCase() === name;
    });
  }, [items, leaseId, tenantName]);

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>
        {tenantName} · Room {roomNo}
      </Subtitle>
      <Text style={styles.hint}>All payment transactions for this tenant</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(p) => `${p.source}-${p.id}`}
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
            <Text style={styles.empty}>No payments recorded for this tenant.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.amount}>{item.amount}</Text>
            <Text style={styles.meta}>
              {item.method} · {item.periodLabel ?? item.date ?? "—"}
            </Text>
            <Text style={styles.meta}>
              {item.propertyName ? `${item.propertyName} · ` : ""}
              Room {item.roomNo}
            </Text>
            <Badge
              label={item.status}
              tone={
                item.status === "Paid"
                  ? "success"
                  : item.status === "Overdue"
                    ? "danger"
                    : "warning"
              }
            />
            <Text style={styles.source}>
              {item.source === "student" ? "Student app" : "Manual / landlord"}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.muted },
  amount: { fontSize: 18, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  source: { fontSize: 11, color: colors.muted, marginTop: 6 },
});
