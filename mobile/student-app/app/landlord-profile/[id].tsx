import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatSignInError, type LandlordPublicProfile } from "@/lib/api";
import { fetchLandlordProfile } from "@/lib/landlord-profile";
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

function Stars({ rating }: { rating: number }) {
  return (
    <Text style={styles.stars}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </Text>
  );
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

export default function LandlordProfileScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const propertyId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { token } = useAuth();
  const [data, setData] = useState<LandlordPublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [certsOpen, setCertsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token || !propertyId) return;
    const res = await fetchLandlordProfile(token, propertyId);
    setData(res);
  }, [token, propertyId]);

  useEffect(() => {
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
  }, [load]);

  if (loading) return <CenteredLoader />;
  if (!data) {
    return (
      <Screen>
        <Text style={styles.error}>{error ?? "Landlord not found."}</Text>
      </Screen>
    );
  }

  const accTone =
    data.accreditation.status === "Approved"
      ? "success"
      : data.accreditation.status === "Pending"
        ? "warning"
        : "danger";
  const certifications = data.certifications ?? [];

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Title>{data.landlord.name}</Title>
        <Subtitle>{`Landlord profile for ${data.property.name}`}</Subtitle>

        <Card>
          <Text style={styles.section}>Accreditation</Text>
          <Badge label={data.accreditation.status} tone={accTone} />
          <Text style={styles.body}>Dorm: {data.accreditation.dormName}</Text>
          {data.accreditation.submittedAt ? (
            <Text style={styles.meta}>
              Submitted {data.accreditation.submittedAt}
            </Text>
          ) : null}
          {data.accreditation.expiresAt ? (
            <Text style={styles.meta}>
              Expires {data.accreditation.expiresAt}
            </Text>
          ) : null}
          <View style={{ marginTop: 12 }}>
            <Button
              label="View Certifications"
              variant="outline"
              onPress={() => setCertsOpen(true)}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.section}>Payments</Text>
          <Text style={styles.body}>
            GCash name:{" "}
            {data.landlord.gcashAccountName || data.landlord.name}
          </Text>
          {data.landlord.gcashPhone ? (
            <Text style={styles.body}>GCash number: {data.landlord.gcashPhone}</Text>
          ) : (
            <Text style={styles.meta}>No GCash number published.</Text>
          )}
          {data.landlord.gcashQrCodeUrl ? (
            <Image
              source={{ uri: data.landlord.gcashQrCodeUrl }}
              style={styles.qr}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.meta}>No GCash QR uploaded yet.</Text>
          )}
        </Card>

        <Card>
          <Text style={styles.section}>Property</Text>
          <Text style={styles.bodyStrong}>{data.property.name}</Text>
          <Text style={styles.body}>{data.property.address}</Text>
          {data.property.contactPhone ? (
            <Text style={styles.body}>{data.property.contactPhone}</Text>
          ) : null}
          {data.property.description ? (
            <Text style={styles.body}>{data.property.description}</Text>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.section}>
            All room reviews
            {data.reviewSummary.count > 0
              ? ` · ${data.reviewSummary.avg?.toFixed(1) ?? "—"} ★ (${data.reviewSummary.count})`
              : ""}
          </Text>
          {data.reviews.length === 0 ? (
            <Text style={styles.meta}>No reviews yet for this landlord.</Text>
          ) : (
            data.reviews.map((r, i) => (
              <View key={`${r.author}-${r.date}-${i}`} style={styles.review}>
                <View style={styles.reviewHead}>
                  <Text style={styles.bodyStrong}>{r.author}</Text>
                  <Text style={styles.meta}>{r.date}</Text>
                </View>
                <Text style={styles.meta}>
                  {r.propertyName} · Room {r.roomNo}
                </Text>
                <Stars rating={r.rating} />
                {r.title ? <Text style={styles.bodyStrong}>{r.title}</Text> : null}
                <Text style={styles.body}>{r.comment}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={certsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCertsOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCertsOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Certifications</Text>
              <Pressable onPress={() => setCertsOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.navy} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {certifications.length === 0 ? (
                <Text style={styles.meta}>
                  No certifications uploaded for this property yet.
                </Text>
              ) : (
                certifications.map((c, i) => (
                  <View key={`${c.label}-${i}`} style={styles.certItem}>
                    <Text style={styles.bodyStrong}>{c.label}</Text>
                    {isImageUrl(c.url) ? (
                      <Image
                        source={{ uri: c.url }}
                        style={styles.certImage}
                        resizeMode="contain"
                      />
                    ) : null}
                    <Pressable onPress={() => void Linking.openURL(c.url)}>
                      <Text style={styles.link}>Open file</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  scroll: { paddingBottom: 32 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
  },
  body: { fontSize: 14, color: "#334155", lineHeight: 20, marginTop: 4 },
  bodyStrong: { fontSize: 14, fontWeight: "700", color: colors.navy },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  stars: { color: "#d97706", fontSize: 14, marginVertical: 4 },
  qr: {
    width: "100%",
    height: 180,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  review: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
  },
  reviewHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "88%",
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
  sheetBody: { padding: 16, paddingBottom: 40 },
  certItem: { marginBottom: 16 },
  certImage: {
    width: "100%",
    height: 220,
    marginTop: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  link: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand,
  },
});
