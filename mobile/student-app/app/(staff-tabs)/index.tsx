import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  apiRequest,
  formatSignInError,
} from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAndroidHomeBack } from "@/hooks/use-android-home-back";

type InspectionSchedule = {
  accreditationRequestId: string;
  dormName: string;
  ownerName: string;
  scheduledFor: string | null;
  scheduleStatus: "upcoming" | "completed" | "overdue";
  result: string | null;
};

type InspectionData = {
  summary: {
    recommended: number;
    rejected: number;
    onHold: number;
    upcoming: number;
  };
  schedules: InspectionSchedule[];
};

function scheduleLabel(status: InspectionSchedule["scheduleStatus"]) {
  if (status === "completed") return "Completed";
  if (status === "overdue") return "Overdue";
  return "Scheduled";
}

export default function StaffDashboardScreen() {
  useAndroidHomeBack();
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<InspectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const result = await apiRequest<InspectionData>("/api/osa/inspections", {
      token,
    });
    setData(result);
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

  const upcoming = (data?.schedules ?? [])
    .filter(
      (row) =>
        row.scheduleStatus === "upcoming" || row.scheduleStatus === "overdue"
    )
    .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""))
    .slice(0, 6);

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>
        {`Hello, ${user?.name?.split(" ")[0] ?? "Staff"}`}
      </Title>
      <Subtitle>OSA inspection workload and schedule activity</Subtitle>
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
        <View style={styles.metrics}>
          <Card style={styles.metric}>
            <Text style={styles.metricLabel}>Upcoming / overdue</Text>
            <Text style={styles.metricValue}>{data?.summary.upcoming ?? 0}</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricLabel}>Completed</Text>
            <Text style={styles.metricValue}>
              {data?.schedules.filter((row) => row.scheduleStatus === "completed")
                .length ?? 0}
            </Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricLabel}>On hold</Text>
            <Text style={styles.metricValue}>{data?.summary.onHold ?? 0}</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricLabel}>Recommended</Text>
            <Text style={styles.metricValue}>
              {data?.summary.recommended ?? 0}
            </Text>
          </Card>
        </View>

        <Card>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Next inspections</Text>
              <Text style={styles.meta}>
                Upcoming and overdue visits that need staff attention.
              </Text>
            </View>
            <Button
              label="View all"
              variant="outline"
              onPress={() => router.push("/(staff-tabs)/inspections")}
            />
          </View>
          {upcoming.length === 0 ? (
            <Text style={styles.meta}>No upcoming inspections.</Text>
          ) : (
            upcoming.map((row) => (
              <View key={row.accreditationRequestId} style={styles.scheduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{row.dormName}</Text>
                  <Text style={styles.meta}>
                    {row.ownerName} · {row.scheduledFor ?? "Date not set"}
                  </Text>
                  {row.result ? (
                    <Text style={styles.meta}>Result: {row.result}</Text>
                  ) : null}
                </View>
                <Badge
                  label={scheduleLabel(row.scheduleStatus)}
                  tone={row.scheduleStatus === "overdue" ? "danger" : "warning"}
                />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metric: { width: "48%", flexGrow: 1 },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 8,
  },
  scheduleRow: {
    alignItems: "flex-start",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
  },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
});
