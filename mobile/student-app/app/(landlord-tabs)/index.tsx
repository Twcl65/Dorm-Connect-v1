import { useCallback, useState } from "react";
import {
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
  type LandlordOverview,
} from "@/lib/api";
import {
  Badge,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function LandlordHomeScreen() {
  const { token, user } = useAuth();
  const [data, setData] = useState<LandlordOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<LandlordOverview>("/api/landlord/overview", {
      token,
    });
    setData(res);
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

  if (loading && !data) return <CenteredLoader />;

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>
        {`Hello, ${user?.name?.split(" ")[0] ?? "Landlord"}`}
      </Title>
      <Subtitle>Property overview</Subtitle>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
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
      >
        {data ? (
          <>
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Properties</Text>
                <Text style={styles.statValue}>{data.propertiesCount}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Rooms</Text>
                <Text style={styles.statValue}>{data.rooms.total}</Text>
                <Text style={styles.statMeta}>
                  {data.rooms.occupied} occupied · {data.rooms.available} free
                </Text>
              </Card>
            </View>

            <Card>
              <Text style={styles.cardTitle}>Reservations</Text>
              <Text style={styles.meta}>
                {data.reservations.confirmed} confirmed ·{" "}
                {data.reservations.pending} pending ·{" "}
                {data.reservations.cancelled} cancelled
              </Text>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Payments this month</Text>
              <Text style={styles.statValue}>{data.paymentsThisMonth}</Text>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Accreditation</Text>
              <Text style={styles.meta}>
                {data.accreditation.approved} approved ·{" "}
                {data.accreditation.pending} pending
              </Text>
            </Card>

            {data.tenantsPreview.length > 0 ? (
              <Card>
                <Text style={styles.cardTitle}>Recent tenants</Text>
                {data.tenantsPreview.map((t) => (
                  <View key={t.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {t.name} · Room {t.roomNo}
                      </Text>
                      <Text style={styles.meta}>{t.leasePeriod}</Text>
                    </View>
                    <Badge
                      label={t.paymentStatus}
                      tone={
                        t.paymentStatus === "Up to Date"
                          ? "success"
                          : t.paymentStatus === "Overdue"
                            ? "danger"
                            : "warning"
                      }
                    />
                  </View>
                ))}
              </Card>
            ) : null}

            {data.activities.length > 0 ? (
              <Card>
                <Text style={styles.cardTitle}>Recent activity</Text>
                {data.activities.slice(0, 5).map((a, i) => (
                  <Text key={`${a.time}-${i}`} style={styles.meta}>
                    {a.description}
                    {"\n"}
                    <Text style={styles.time}>{a.time}</Text>
                  </Text>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1 },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
  },
  statMeta: { fontSize: 11, color: colors.muted, marginTop: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  time: { fontSize: 11, color: "#94a3b8" },
});
