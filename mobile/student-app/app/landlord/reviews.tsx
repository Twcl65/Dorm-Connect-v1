import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { apiRequest, formatSignInError } from "@/lib/api";
import {
  Card,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

type LandlordReview = {
  id: string;
  rating: number;
  title: string;
  comment: string;
  reviewedAt: string;
  studentName: string;
  roomNo: string;
  propertyName: string;
  propertyAddress: string | null;
};

export default function LandlordReviewsScreen() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<LandlordReview[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const response = await apiRequest<{
      reviews: LandlordReview[];
      totalReviews: number;
      avgRating: number | null;
    }>("/api/landlord/reviews", { token });
    setReviews(response.reviews ?? []);
    setTotalReviews(response.totalReviews ?? response.reviews?.length ?? 0);
    setAverageRating(response.avgRating ?? null);
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

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reviews;
    return reviews.filter((review) =>
      [
        review.propertyName,
        review.roomNo,
        review.studentName,
        review.title,
        review.comment,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [reviews, search]);

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

  if (loading && reviews.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <Title>View Reviews</Title>
      <Subtitle>
        Student reviews for rooms in your dormitories and boarding houses.
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
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total reviews</Text>
            <Text style={styles.summaryValue}>
              {loading ? "—" : totalReviews}
            </Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Average rating</Text>
            <Text style={styles.summaryValue}>
              {loading
                ? "—"
                : averageRating == null
                  ? "—"
                  : `${averageRating} ★`}
            </Text>
          </Card>
        </View>

        <Input
          placeholder="Search property, room, student, or review"
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search reviews"
        />

        {filteredReviews.map((review) => (
          <Card key={review.id}>
            <View style={styles.reviewHeading}>
              <View style={styles.reviewInfo}>
                <Text style={styles.property}>
                  {review.propertyName} — Room {review.roomNo}
                </Text>
                {review.propertyAddress ? (
                  <Text style={styles.address}>{review.propertyAddress}</Text>
                ) : null}
                <Text style={styles.reviewer}>
                  Review by{" "}
                  <Text style={styles.reviewerName}>{review.studentName}</Text>
                </Text>
              </View>
              <View style={styles.rating}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= review.rating ? "star" : "star-outline"}
                    size={14}
                    color={star <= review.rating ? colors.amber : "#cbd5e1"}
                  />
                ))}
                <Text style={styles.ratingText}>{review.rating}/5</Text>
              </View>
            </View>
            <Text style={styles.date}>{review.reviewedAt}</Text>
            {review.title ? (
              <Text style={styles.reviewTitle}>{review.title}</Text>
            ) : null}
            <Text style={styles.comment}>{review.comment}</Text>
          </Card>
        ))}
        {!loading && filteredReviews.length === 0 ? (
          <Text style={styles.empty}>
            {reviews.length === 0
              ? "No student reviews yet. Reviews appear when tenants submit feedback."
              : "No reviews match your search."}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1 },
  summaryLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginTop: 6,
  },
  reviewHeading: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  reviewInfo: { flex: 1 },
  property: { fontSize: 14, fontWeight: "700", color: colors.text },
  address: { fontSize: 12, color: colors.muted, marginTop: 3 },
  reviewer: { fontSize: 12, color: colors.muted, marginTop: 6 },
  reviewerName: { color: colors.text, fontWeight: "600" },
  rating: { flexDirection: "row", alignItems: "center", gap: 1 },
  ratingText: { marginLeft: 3, fontSize: 11, color: colors.muted },
  date: { fontSize: 11, color: colors.muted, marginTop: 8 },
  reviewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginTop: 8,
  },
  comment: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6 },
  empty: { color: colors.muted, fontSize: 14, textAlign: "center", padding: 24 },
});
