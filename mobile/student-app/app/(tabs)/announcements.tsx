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
  type AnnouncementRow,
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

const NEW_THRESHOLD_DAYS = 7;

function isNewAnnouncement(date: string) {
  const createdAt = new Date(date).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return (Date.now() - createdAt) / (1000 * 60 * 60 * 24) <= NEW_THRESHOLD_DAYS;
}

export default function StudentAnnouncementsScreen() {
  const { token } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const response = await apiRequest<{ announcements: AnnouncementRow[] }>(
      "/api/student/announcements",
      { token }
    );
    setAnnouncements(response.announcements ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setLoading(true);
        try {
          await load();
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
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && announcements.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Title>Announcements</Title>
      <Subtitle>
        Official notices from OSA and messages from landlords where you have an
        active booking.
      </Subtitle>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
        }
      >
        {announcements.map((announcement) => {
          const landlordNotice = announcement.source === "landlord";
          return (
            <Card key={announcement.id}>
              <View style={styles.heading}>
                <Text style={styles.title}>{announcement.title}</Text>
                <View style={styles.badges}>
                  <Badge
                    label={
                      landlordNotice && announcement.propertyName
                        ? `Landlord · ${announcement.propertyName}`
                        : "OSA"
                    }
                  />
                  {isNewAnnouncement(announcement.date) ? (
                    <Badge label="New" tone="success" />
                  ) : null}
                </View>
              </View>
              <Text style={styles.date}>{announcement.date}</Text>
              <Text style={styles.message}>{announcement.message}</Text>
            </Card>
          );
        })}
        {!loading && announcements.length === 0 && !error ? (
          <Text style={styles.empty}>No announcements yet.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    minWidth: 140,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  date: { fontSize: 12, color: colors.muted, marginTop: 8 },
  message: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 8 },
  empty: { color: colors.muted, fontSize: 14, textAlign: "center", padding: 24 },
});
