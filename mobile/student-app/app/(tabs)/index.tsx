import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { AnnouncementsCard } from "@/components/announcements-card";
import {
  apiRequest,
  formatSignInError,
  type OverviewResponse,
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

export default function HomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<OverviewResponse>("/api/student/overview", {
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !data) return <CenteredLoader />;

  const active = data?.activeReservation;
  const verify = user?.ictVerificationStatus;
  const nextUnpaidMonth = data?.upcomingUnpaidMonths?.[0];

  return (
    <Screen style={styles.screen}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Title>{`Hello, ${user?.name?.split(" ")[0] ?? "Student"}`}</Title>
        <Subtitle>Your dorm overview</Subtitle>
        {error && <Text style={styles.error}>{error}</Text>}

        {verify === "Pending Verification" && (
          <Card>
            <Badge label="ICT verification pending" tone="warning" />
            <Text style={styles.body}>
              You can browse listings, but booking may be limited until ICT
              approves your account.
            </Text>
          </Card>
        )}

        <AnnouncementsCard />

        {active ? (
          <Card>
            <Text style={styles.cardTitle}>{active.dormName}</Text>
            <Text style={styles.meta}>Room {active.roomNo}</Text>
            <Text style={styles.meta}>{active.leasePeriod}</Text>
            <Badge
              label={`Stay: ${active.reservationStatus}`}
              tone={active.reservationStatus === "Active" ? "success" : "warning"}
            />
            <Badge
              label={`Rent: ${active.paymentStatus}`}
              tone={
                active.paymentStatus === "Paid"
                  ? "success"
                  : active.paymentStatus === "Overdue"
                    ? "danger"
                    : "warning"
              }
            />
          </Card>
        ) : (
          <Card>
            <Text style={styles.body}>
              No active reservation. Browse dorms to book.
            </Text>
          </Card>
        )}

        {active && data?.paymentHint ? (
          <Card>
            <Text style={styles.cardTitle}>Payment reminder</Text>
            {nextUnpaidMonth ? (
              <>
                <View style={styles.dueRow}>
                  <Text style={styles.dueMonth}>{nextUnpaidMonth.monthLabel}</Text>
                  <Text style={styles.dueMeta}>
                    ₱{nextUnpaidMonth.amount.toLocaleString()} · {nextUnpaidMonth.dueLabel}
                  </Text>
                </View>
                <Pressable
                  style={styles.payLink}
                  onPress={() => router.push("/(tabs)/payments")}
                >
                  <Text style={styles.payLinkText}>Go to Payments →</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.body}>{data.paymentHint}</Text>
            )}
          </Card>
        ) : null}

        {data?.latestPayment && (
          <Card>
            <Text style={styles.cardTitle}>Latest payment</Text>
            <Text style={styles.meta}>
              ₱{data.latestPayment.amount.toLocaleString()} ·{" "}
              {data.latestPayment.status}
            </Text>
            {data.latestPayment.paidAtLabel && (
              <Text style={styles.meta}>{data.latestPayment.paidAtLabel}</Text>
            )}
          </Card>
        )}

      </ScrollView>
    </Screen>
  );
}

function QuickLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress}>
      <Text style={styles.quickLinkText}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 8 },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  body: { fontSize: 13, color: "#334155", marginTop: 8, lineHeight: 18 },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 8,
  },
  quickLinkText: { fontSize: 14, color: colors.sky, fontWeight: "500" },
  chevron: { fontSize: 18, color: "#94a3b8" },
  dueRow: {
    marginTop: 8,
  },
  dueMonth: { fontSize: 15, fontWeight: "600", color: colors.text },
  dueMeta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  payLink: { marginTop: 12 },
  payLinkText: { fontSize: 14, fontWeight: "600", color: colors.sky },
});
