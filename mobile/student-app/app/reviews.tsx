import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import {
  apiRequest,
  formatSignInError,
  type MyReview,
  type ReviewableRoom,
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

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          disabled={disabled}
          onPress={() => onChange(star)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Rate ${star} stars`}
        >
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={28}
            color={star <= value ? colors.amber : "#cbd5e1"}
          />
        </Pressable>
      ))}
      <Text style={styles.starHint}>
        {value > 0 ? `${value} / 5` : "Select rating"}
      </Text>
    </View>
  );
}

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={14}
          color={star <= rating ? colors.amber : "#cbd5e1"}
        />
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const { token } = useAuth();
  const [reviewableRooms, setReviewableRooms] = useState<ReviewableRoom[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<{
      reviewableRooms: ReviewableRoom[];
      myReviews: MyReview[];
    }>("/api/student/reviews/mine", { token });
    setReviewableRooms(res.reviewableRooms ?? []);
    setMyReviews(res.myReviews ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
          setReviewableRooms([]);
          setMyReviews([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const selectedRoom = useMemo(
    () => reviewableRooms.find((r) => r.roomId === roomId) ?? null,
    [reviewableRooms, roomId]
  );

  const resetForm = () => {
    setRoomId("");
    setRating(0);
    setTitle("");
    setComment("");
    setSubmitError(null);
  };

  const selectRoom = (id: string) => {
    setRoomId(id);
    const room = reviewableRooms.find((r) => r.roomId === id);
    if (room?.existingReview) {
      setRating(room.existingReview.rating);
      setTitle(room.existingReview.title);
      setComment(room.existingReview.comment);
    } else {
      setRating(0);
      setTitle("");
      setComment("");
    }
    setSubmitError(null);
  };

  const startEdit = (review: MyReview) => {
    selectRoom(review.roomId);
  };

  const submitReview = async () => {
    if (!token) return;
    setSubmitError(null);
    if (!roomId) {
      setSubmitError("Select the dormitory / room you booked.");
      return;
    }
    if (rating < 1) {
      setSubmitError("Please select a star rating (1–5).");
      return;
    }
    if (!comment.trim()) {
      setSubmitError("Please write a review description.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/api/student/reviews", {
        method: "POST",
        token,
        body: {
          roomId,
          rating,
          title: title.trim(),
          comment: comment.trim(),
        },
      });
      resetForm();
      await load();
      Alert.alert("Saved", "Your review was submitted.");
    } catch (e) {
      setSubmitError(formatSignInError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && reviewableRooms.length === 0 && myReviews.length === 0) {
    return <CenteredLoader />;
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <Title>Reviews</Title>
          <Subtitle>
            Share your experience for dormitories you have booked
          </Subtitle>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Card>
            <Text style={styles.sectionTitle}>Write a review</Text>
            <Text style={styles.sectionHint}>
              Only rooms from your active reservations can be reviewed. You can
              update your review anytime.
            </Text>

            {reviewableRooms.length === 0 ? (
              <Text style={styles.empty}>
                You have no active reservations yet. Book a dormitory from
                Browse to leave a review.
              </Text>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Dormitory / room</Text>
                <View style={styles.roomList}>
                  {reviewableRooms.map((r) => {
                    const active = roomId === r.roomId;
                    return (
                      <Pressable
                        key={r.roomId}
                        style={[styles.roomChip, active && styles.roomChipActive]}
                        onPress={() => selectRoom(r.roomId)}
                      >
                        <Text
                          style={[
                            styles.roomChipText,
                            active && styles.roomChipTextActive,
                          ]}
                        >
                          {r.propertyName} — Room {r.roomNo}
                          {r.existingReview ? " (reviewed)" : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {selectedRoom ? (
                  <View style={styles.selectedMeta}>
                    <Badge label={selectedRoom.reservationStatus} tone="default" />
                    {selectedRoom.propertyAddress ? (
                      <Text style={styles.meta}>{selectedRoom.propertyAddress}</Text>
                    ) : null}
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>Star rating</Text>
                <StarPicker
                  value={rating}
                  onChange={setRating}
                  disabled={saving || !roomId}
                />

                <Text style={styles.fieldLabel}>Review title</Text>
                <Input
                  placeholder="e.g. Clean rooms and friendly landlord"
                  value={title}
                  onChangeText={setTitle}
                  editable={!saving && !!roomId}
                  maxLength={120}
                />

                <Text style={styles.fieldLabel}>Description</Text>
                <Input
                  placeholder="Describe your stay — cleanliness, safety, amenities…"
                  value={comment}
                  onChangeText={setComment}
                  editable={!saving && !!roomId}
                  multiline
                  numberOfLines={5}
                  maxLength={2000}
                  style={styles.textArea}
                />

                {submitError ? (
                  <Text style={styles.error}>{submitError}</Text>
                ) : null}

                <View style={styles.actions}>
                  <Button
                    label={
                      selectedRoom?.existingReview
                        ? "Update review"
                        : "Submit review"
                    }
                    onPress={() => void submitReview()}
                    disabled={!roomId}
                    loading={saving}
                  />
                  {(roomId || rating > 0 || title || comment) && !saving ? (
                    <Button
                      label="Clear"
                      variant="outline"
                      onPress={resetForm}
                    />
                  ) : null}
                </View>
              </>
            )}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>My reviews</Text>
            {myReviews.length === 0 ? (
              <Text style={styles.empty}>You have not submitted any reviews yet.</Text>
            ) : (
              myReviews.map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewHeaderText}>
                      <Text style={styles.reviewTitle}>
                        {review.propertyName} — Room {review.roomNo}
                      </Text>
                      <View style={styles.reviewMeta}>
                        <StarsDisplay rating={review.rating} />
                        {review.reviewedAt ? (
                          <Text style={styles.meta}>{review.reviewedAt}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      onPress={() => startEdit(review)}
                      style={styles.editBtn}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil" size={16} color={colors.sky} />
                      <Text style={styles.editText}>Edit</Text>
                    </Pressable>
                  </View>
                  {review.title ? (
                    <Text style={styles.reviewHeadline}>{review.title}</Text>
                  ) : null}
                  <Text style={styles.reviewBody}>{review.comment}</Text>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  flex: { flex: 1 },
  scroll: { paddingBottom: 32 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
    marginTop: 4,
  },
  roomList: { gap: 8, marginBottom: 8 },
  roomChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  roomChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandMuted,
  },
  roomChipText: { fontSize: 13, color: colors.text },
  roomChipTextActive: { fontWeight: "600", color: colors.navy },
  selectedMeta: { marginBottom: 8, gap: 4 },
  meta: { fontSize: 12, color: colors.muted },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  starHint: { fontSize: 13, color: colors.muted, marginLeft: 8 },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  actions: { gap: 10, marginTop: 4 },
  empty: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  reviewItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 12,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  reviewHeaderText: { flex: 1 },
  reviewTitle: { fontSize: 14, fontWeight: "700", color: colors.navy },
  reviewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
  },
  editText: { fontSize: 12, color: colors.sky, fontWeight: "600" },
  reviewHeadline: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginTop: 8,
  },
  reviewBody: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
    marginTop: 6,
  },
});
