import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiRequest, formatSignInError } from "@/lib/api";
import { Card, CenteredLoader, Screen, Subtitle, Title, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

type IncomeReport = {
  monthlySummary: {
    month: string;
    total: number;
    paid: number;
    count: number;
    advanceTotal: number;
    depositTotal: number;
  }[];
  advanceSummary: { month: string; total: number; count: number }[];
  depositSummary: { month: string; total: number; count: number }[];
  targetMonth: string;
};

const peso = (value: number) => `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

export default function LandlordIncomeReportsScreen() {
  const { token } = useAuth();
  const [report, setReport] = useState<IncomeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const data = await apiRequest<IncomeReport>("/api/landlord/reports/income", { token });
    setReport(data);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
          setError(null);
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
      setError(null);
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <CenteredLoader />;
  const currentMonthRent =
    report?.monthlySummary.find((row) => row.month === report.targetMonth)?.total ?? 0;
  const advances = report?.advanceSummary.reduce((sum, row) => sum + row.total, 0) ?? 0;
  const deposits = report?.depositSummary.reduce((sum, row) => sum + row.total, 0) ?? 0;

  return (
    <Screen>
      <Title>Financial reports</Title>
      <Subtitle>
        Rent is reported as monthly income. Advance payments and security deposits
        are shown separately; deposits are held for possible refunds and are not
        included in available monthly income.
      </Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={report?.monthlySummary ?? []}
        keyExtractor={(row) => row.month}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        ListHeaderComponent={
          <View style={styles.summaryList}>
            <Card>
              <Text style={styles.label}>Monthly payments · {report?.targetMonth || "—"}</Text>
              <Text style={styles.total}>{peso(currentMonthRent)}</Text>
              <Text style={styles.note}>Rent income only</Text>
            </Card>
            <Card>
              <Text style={styles.label}>Advance payments · {report?.targetMonth || "—"}</Text>
              <Text style={styles.total}>{peso(advances)}</Text>
              <Text style={styles.note}>Tracked separately from monthly rent</Text>
            </Card>
            <Card>
              <Text style={styles.label}>Security deposits · {report?.targetMonth || "—"}</Text>
              <Text style={styles.total}>{peso(deposits)}</Text>
              <Text style={styles.note}>Held separately for possible refunds and applicable deductions</Text>
            </Card>
            <Text style={styles.section}>Monthly payment history</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No payment report data yet.</Text>}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.month}>{item.month}</Text>
              <Text style={styles.amount}>{peso(item.total)}</Text>
            </View>
            <Text style={styles.note}>
              Paid {peso(item.paid)} · {item.count} payment(s)
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryList: { gap: 8, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  total: { fontSize: 22, fontWeight: "700", color: colors.navy, marginTop: 6 },
  note: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  section: { fontSize: 16, fontWeight: "700", color: colors.text, marginVertical: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  month: { fontSize: 14, fontWeight: "600", color: colors.text },
  amount: { fontSize: 14, fontWeight: "600", color: colors.navy },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  empty: { color: colors.muted, textAlign: "center", margin: 16 },
});
