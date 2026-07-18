import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type LandlordLease,
} from "@/lib/api";
import {
  Badge,
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

export default function LandlordPaymentsTab() {
  const { token } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<LandlordLease[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<{ leases: LandlordLease[] }>(
      "/api/landlord/leases",
      { token }
    );
    setTenants(res.leases ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
          setTenants([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.roomNo.toLowerCase().includes(q) ||
        t.leasePeriod.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  if (loading && tenants.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>Payment</Title>
      <Subtitle>Tenants and payment history</Subtitle>

      <Button
        label="Add onsite payment"
        variant="brand"
        onPress={() => router.push("/landlord/onsite-payment")}
      />

      <Input
        placeholder="Search tenant, room, lease…"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
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
            <Text style={styles.empty}>No tenants found.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{item.name}</Text>
              <Badge
                label={item.paymentStatus}
                tone={
                  item.paymentStatus === "Paid"
                    ? "success"
                    : item.paymentStatus === "Overdue"
                      ? "danger"
                      : "warning"
                }
              />
            </View>
            <Text style={styles.meta}>Room {item.roomNo}</Text>
            <Text style={styles.meta}>{item.leasePeriod}</Text>
            {item.dueLabel ? (
              <Text style={styles.meta}>{item.dueLabel}</Text>
            ) : null}

            {((item.remainingBalance ?? 0) > 0 ||
              (item.advancePayments ?? 0) > 0 ||
              (item.deposits ?? 0) > 0) ? (
              <View style={styles.balancesContainer}>
                <View style={styles.balancesRow}>
                  <View style={styles.balanceCol}>
                    <Text style={styles.balanceLabel}>Remaining Balance</Text>
                    <Text style={styles.balanceVal}>
                      ₱{(item.remainingBalance ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.balanceCol}>
                    <Text style={styles.balanceLabel}>Advance Payment</Text>
                    <Text style={styles.balanceVal}>
                      ₱{(item.advancePayments ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.balanceCol}>
                    <Text style={styles.balanceLabel}>Security Deposit</Text>
                    <Text style={styles.balanceVal}>
                      ₱{(item.deposits ?? 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Pressable
              style={styles.txBtn}
              onPress={() =>
                router.push({
                  pathname: "/landlord/tenant-payments",
                  params: {
                    leaseId: item.id,
                    tenantName: item.name,
                    roomNo: item.roomNo,
                  },
                })
              }
            >
              <Text style={styles.txBtnText}>View payment transactions</Text>
            </Pressable>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: 8 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.muted },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  txBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandMuted,
    alignItems: "center",
  },
  txBtnText: { fontSize: 13, fontWeight: "600", color: colors.brand },
  balancesContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  balancesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  balanceCol: {
    minWidth: 80,
    flex: 1,
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  balanceVal: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy ?? colors.text,
    marginTop: 2,
  },
});
