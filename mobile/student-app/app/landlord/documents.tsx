import { useCallback, useState } from "react";
import {
  Alert,
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
  type LandlordAccreditationRow,
} from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { LandlordAccreditationApplication } from "@/components/landlord-accreditation-application";
import { LandlordAccreditationDetailsModal } from "@/components/landlord-accreditation-details-modal";

const ACTIVE_RENEWAL_STATUSES = new Set([
  "Renewing",
  "Pending",
  "Scheduled for Inspection",
  "Recommended for Approval",
  "Hold",
  "Approved",
]);

function hasActiveRenewal(
  requests: LandlordAccreditationRow[],
  requestId: string
): boolean {
  return requests.some(
    (request) =>
      request.renewalOfRequestId === requestId &&
      ACTIVE_RENEWAL_STATUSES.has(request.status)
  );
}

export default function LandlordDocumentsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordAccreditationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<LandlordAccreditationRow | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ requests: LandlordAccreditationRow[] }>(
      "/api/landlord/accreditation",
      { token }
    );
    setItems(res.requests ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setLoading(true);
        try {
          await load();
          if (active) setError(null);
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
  if (showApplicationForm) {
    return (
      <LandlordAccreditationApplication
        onCancel={() => setShowApplicationForm(false)}
        onSubmitted={() => {
          setShowApplicationForm(false);
          void load();
          Alert.alert(
            "Application submitted",
            "Your accreditation request was sent to OSA for review."
          );
        }}
      />
    );
  }

  return (
    <Screen>
      <Subtitle>Accreditation requests</Subtitle>
      <Text style={styles.hint}>
        Review application status, renew eligible accreditations, and submit
        requested documents without starting a new application.
      </Text>
      <Button
        label="Apply for accreditation"
        variant="brand"
        fullWidth
        onPress={() => setShowApplicationForm(true)}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>No accreditation requests.</Text>
          </Card>
        }
        renderItem={({ item }) => {
          return (
            <Card>
              <Pressable onPress={() => setSelectedRequest(item)}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.dormName}</Text>
                  <Badge
                    label={item.status}
                    tone={
                      item.status === "Approved"
                        ? "success"
                        : item.status === "Hold"
                          ? "warning"
                          : "default"
                    }
                  />
                </View>
                <Text style={styles.meta}>{item.address}</Text>
                <Text style={styles.meta}>
                  {item.documentsCount} documents · Submitted {item.submittedDate}
                </Text>
                {item.expiresAt ? (
                  <Text style={styles.meta}>
                    Accreditation expires {item.expiresAt}
                  </Text>
                ) : null}
                <Text style={styles.tap}>View details and actions</Text>
              </Pressable>
            </Card>
          );
        }}
      />
      <LandlordAccreditationDetailsModal
        item={selectedRequest}
        hasRenewal={selectedRequest ? hasActiveRenewal(items, selectedRequest.id) : false}
        onClose={() => setSelectedRequest(null)}
        onUpdated={load}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  error: { color: colors.red, marginBottom: 8, fontSize: 13 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  tap: { fontSize: 12, color: colors.sky, marginTop: 8, fontWeight: "600" },
  empty: { fontSize: 13, color: colors.muted },
});
