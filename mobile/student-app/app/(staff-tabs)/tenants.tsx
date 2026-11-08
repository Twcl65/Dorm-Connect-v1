import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
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

type Tenant = {
  studentId: string;
  name: string;
  email: string;
  schoolId: string | null;
  course: string | null;
  dormName: string;
  roomNo: string;
  landlordName: string;
  leaseStart: string | null;
  leaseEnd: string | null;
  extensionEnd: string | null;
  extensionStatus: string | null;
  occupancy: string;
  moveOutDate: string | null;
  balanceRemaining: number;
};
type TenantHistory = {
  dormName: string;
  roomNo: string;
  leaseStart: string;
  leaseEnd: string;
  balanceRemaining: string;
  status: string;
};

function currency(value: number | string) {
  return `₱${Number(value).toLocaleString()}`;
}

export default function StaffTenantsScreen() {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [history, setHistory] = useState<TenantHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const response = await apiRequest<{ tenants: Tenant[] }>("/api/osa/tenants", {
      token,
    });
    setTenants(response.tenants ?? []);
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
    if (!query) return tenants;
    return tenants.filter((tenant) =>
      [
        tenant.name,
        tenant.email,
        tenant.schoolId ?? "",
        tenant.course ?? "",
        tenant.dormName,
        tenant.roomNo,
        tenant.landlordName,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [tenants, search]);

  const openHistory = async (tenant: Tenant) => {
    setSelected(tenant);
    setHistory([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const response = await apiRequest<{ history: TenantHistory[] }>(
        `/api/osa/tenants/history?studentId=${encodeURIComponent(tenant.studentId)}`,
        { token }
      );
      setHistory(response.history ?? []);
    } catch (e) {
      setHistoryError(formatSignInError(e));
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading && tenants.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>Tenant Monitoring</Title>
      <Subtitle>Find confirmed tenants and view their dorm history</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, email, school ID, dorm, or landlord"
        autoCapitalize="none"
        style={styles.search}
      />
      <FlatList
        data={filtered}
        keyExtractor={(tenant) =>
          `${tenant.studentId}-${tenant.dormName}-${tenant.roomNo}`
        }
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
              {search.trim() ? "No matching tenants." : "No active tenants found."}
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.tenantHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.email}</Text>
                <Text style={styles.meta}>
                  School ID: {item.schoolId ?? "—"} · {item.course ?? "—"}
                </Text>
              </View>
              <Badge label={item.occupancy} tone="success" />
            </View>
            <Text style={styles.meta}>
              {item.dormName} · Room {item.roomNo}
            </Text>
            <Text style={styles.meta}>Landlord: {item.landlordName}</Text>
            <Text style={styles.meta}>
              Lease: {item.leaseStart ?? "—"} → {item.leaseEnd ?? "—"}
              {item.extensionEnd ? ` · Extension to ${item.extensionEnd}` : ""}
            </Text>
            {item.moveOutDate ? (
              <Text style={styles.meta}>Moved out: {item.moveOutDate}</Text>
            ) : null}
            <Text style={styles.balance}>
              Balance remaining: {currency(item.balanceRemaining)}
            </Text>
            <View style={styles.action}>
              <Button
                label="View dorm history"
                variant="outline"
                onPress={() => void openHistory(item)}
              />
            </View>
          </Card>
        )}
      />

      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {selected?.name} — Dorm History
              </Text>
              {selected ? (
                <>
                  <Text style={styles.meta}>{selected.dormName}</Text>
                  <Text style={styles.meta}>
                    Room {selected.roomNo} · {selected.landlordName}
                  </Text>
                  <Text style={styles.meta}>
                    Lease: {selected.leaseStart ?? "—"} →{" "}
                    {selected.leaseEnd ?? "—"}
                    {selected.extensionEnd
                      ? ` · extend to ${selected.extensionEnd}`
                      : ""}
                    {selected.moveOutDate
                      ? ` · moved out ${selected.moveOutDate}`
                      : ""}
                  </Text>
                </>
              ) : null}
              <Text style={styles.sectionTitle}>Reservation history</Text>
              {historyLoading ? (
                <Text style={styles.meta}>Loading history…</Text>
              ) : historyError ? (
                <Text style={styles.error}>{historyError}</Text>
              ) : history.length === 0 ? (
                <Text style={styles.meta}>No historical records found.</Text>
              ) : (
                history.map((row, index) => (
                  <View
                    key={`${row.dormName}-${row.leaseStart}-${index}`}
                    style={styles.historyRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{row.dormName}</Text>
                      <Text style={styles.meta}>
                        Room {row.roomNo} · {row.leaseStart} → {row.leaseEnd}
                      </Text>
                      <Text style={styles.meta}>
                        Balance remaining: {currency(row.balanceRemaining)}
                      </Text>
                    </View>
                    <Badge label={row.status} />
                  </View>
                ))
              )}
              <View style={styles.action}>
                <Button
                  label="Close"
                  variant="outline"
                  onPress={() => setSelected(null)}
                />
              </View>
            </ScrollView>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  search: { marginBottom: 10 },
  name: { color: colors.text, fontSize: 14, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  tenantHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  balance: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  action: { marginTop: 12 },
  modalOverlay: {
    backgroundColor: "rgba(15,23,42,0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 14,
  },
  modalCard: { maxHeight: "85%", width: "100%" },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 18,
  },
  historyRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
  },
});
