import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ApiError,
  apiRequest,
  formatSignInError,
  type Listing,
  type RoomReview,
} from "@/lib/api";
import { ImageGallery } from "@/components/image-gallery";
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
import {
  RESERVATION_TERMS,
  addMonthsIso,
  listingImageUrls,
  showRoomDetailsAside,
} from "@/lib/listing-utils";

function Stars({ rating }: { rating: number }) {
  return (
    <Text style={styles.stars}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </Text>
  );
}

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { token, user } = useAuth();
  const router = useRouter();

  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<RoomReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showTerms, setShowTerms] = useState(false);
  const [bookingStep, setBookingStep] = useState<0 | 2 | 3>(0);
  const [moveInDate, setMoveInDate] = useState("");
  const [leaseMonths, setLeaseMonths] = useState("12");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ictStatus = user?.ictVerificationStatus ?? null;
  const canBook = ictStatus === "Verified";
  const hasReservation = Boolean(listing?.myReservationStatus);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    const res = await apiRequest<{ listings: Listing[] }>(
      "/api/student/listings",
      { token }
    );
    const found = res.listings.find((l) => l.id === id) ?? null;
    setListing(found);

    if (found) {
      const rev = await apiRequest<{ reviews: RoomReview[] }>(
        `/api/student/reviews?roomId=${found.id}`,
        { token }
      );
      setReviews(rev.reviews ?? []);
    } else {
      setReviews([]);
    }
  }, [token, id]);

  useEffect(() => {
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
  }, [load]);

  const startBooking = () => {
    if (!canBook) {
      Alert.alert(
        "Cannot book yet",
        ictStatus === "Pending Verification"
          ? "Your account is pending ICT verification. You can browse listings, but reservation is available only after verification."
          : "Your registration was not approved by ICT. You can browse, but you cannot reserve a room."
      );
      return;
    }
    if (hasReservation) return;
    setSubmitError(null);
    setMoveInDate(new Date().toISOString().slice(0, 10));
    setLeaseMonths("12");
    setShowTerms(true);
  };

  const submitReservation = async () => {
    if (!token || !listing || !moveInDate.trim()) return;
    const months = Number(leaseMonths);
    if (!months || months < 1) {
      setSubmitError("Choose a valid lease duration.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const leaseEnd = addMonthsIso(moveInDate.trim(), months);
      await apiRequest("/api/student/reservations", {
        method: "POST",
        token,
        body: {
          roomId: listing.id,
          leaseStart: moveInDate.trim(),
          leaseEnd,
          guestName: user?.name,
        },
      });
      setBookingStep(0);
      setShowTerms(false);
      Alert.alert(
        "Reservation submitted",
        "Your request was sent to the landlord. Check Bookings for status.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)/reservations") }]
      );
      await load();
    } catch (e) {
      setSubmitError(
        e instanceof ApiError ? e.message : "Reservation failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <CenteredLoader />;
  if (!listing) {
    return (
      <Screen>
        <Text style={styles.error}>{error ?? "Listing not found."}</Text>
        <Button label="Go back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const galleryUrls = listingImageUrls(listing);

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {ictStatus && ictStatus !== "Verified" && (
          <Card style={styles.warnCard}>
            <Text style={styles.warnText}>
              {ictStatus === "Pending Verification"
                ? "ICT verification pending — you can view listings, but booking opens after verification."
                : "ICT registration not approved — browsing only."}
            </Text>
          </Card>
        )}

        <ImageGallery urls={galleryUrls} alt={listing.name} />

        <Title>{listing.name}</Title>
        <Subtitle>
          {listing.location} · {listing.distance}
        </Subtitle>
        <Text style={styles.price}>
          ₱{listing.price.toLocaleString()}{" "}
          <Text style={styles.priceUnit}>/ month</Text>
        </Text>

        {listing.myReservationStatus && (
          <Badge
            label={
              listing.myReservationStatus === "Confirmed"
                ? "Booking confirmed"
                : "Sent booking request"
            }
            tone={
              listing.myReservationStatus === "Confirmed" ? "success" : "warning"
            }
          />
        )}

        {listing.reviewSummary.count > 0 && (
          <Text style={styles.reviewAvg}>
            {listing.reviewSummary.avg != null
              ? `${listing.reviewSummary.avg.toFixed(1)} ★`
              : "—"}{" "}
            ({listing.reviewSummary.count} review
            {listing.reviewSummary.count === 1 ? "" : "s"})
          </Text>
        )}

        <Card>
          <Text style={styles.section}>Managed by</Text>
          <Text style={styles.bodyStrong}>{listing.landlord}</Text>

          <Text style={styles.section}>Building</Text>
          <Text style={styles.body}>{listing.propertyName}</Text>

          {(listing.propertyAddress || listing.propertyCity) && (
            <>
              <Text style={styles.section}>Address</Text>
              <Text style={styles.body}>
                {[listing.propertyAddress, listing.propertyCity]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            </>
          )}

          {listing.propertyContactPhone ? (
            <>
              <Text style={styles.section}>Contact</Text>
              <Text style={styles.body}>{listing.propertyContactPhone}</Text>
            </>
          ) : null}

          {listing.propertyDescription ? (
            <>
              <Text style={styles.section}>Property notes</Text>
              <Text style={styles.body}>{listing.propertyDescription}</Text>
            </>
          ) : null}

          <Text style={styles.section}>Room type</Text>
          <Text style={styles.body}>{listing.roomType}</Text>

          <Text style={styles.section}>Capacity</Text>
          <Text style={styles.body}>{listing.capacity}</Text>

          {listing.roomSizeLabel ? (
            <>
              <Text style={styles.section}>Size</Text>
              <Text style={styles.body}>{listing.roomSizeLabel}</Text>
            </>
          ) : null}

          {showRoomDetailsAside(listing.description, listing.roomDetails) &&
          listing.roomDetails ? (
            <>
              <Text style={styles.section}>Other details</Text>
              <Text style={styles.body}>{listing.roomDetails}</Text>
            </>
          ) : null}

          <Text style={styles.section}>Document status</Text>
          <Badge label={listing.documentType} />

          <Text style={styles.section}>Description</Text>
          <Text style={styles.body}>{listing.description}</Text>

          <Text style={styles.section}>Amenities</Text>
          <View style={styles.amenityRow}>
            {listing.amenities.map((a) => (
              <Badge key={a} label={a} />
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Student reviews</Text>
          {reviews.length === 0 ? (
            <Text style={styles.muted}>No reviews yet for this room.</Text>
          ) : (
            reviews.map((r) => (
              <View key={`${r.author}-${r.date}`} style={styles.review}>
                <View style={styles.reviewHead}>
                  <Text style={styles.bodyStrong}>{r.author}</Text>
                  <Text style={styles.muted}>{r.date}</Text>
                </View>
                <Stars rating={r.rating} />
                <Text style={styles.body}>{r.comment}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        {hasReservation ? (
          <Text style={styles.footerHint}>
            You already have a reservation for this room.
          </Text>
        ) : (
          <Button
            label="Book now"
            onPress={startBooking}
            disabled={!canBook}
          />
        )}
      </View>

      {/* Terms — same as website */}
      <Modal visible={showTerms} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Terms & conditions</Text>
            <Text style={styles.muted}>Please read before booking {listing.name}.</Text>
            <ScrollView style={styles.termsScroll}>
              {RESERVATION_TERMS.map((t) => (
                <Text key={t} style={styles.termItem}>
                  • {t}
                </Text>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <View style={styles.modalBtn}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setShowTerms(false)}
                />
              </View>
              <View style={styles.modalBtn}>
                <Button
                  label="I agree — continue"
                  onPress={() => {
                    setShowTerms(false);
                    setBookingStep(2);
                  }}
                />
              </View>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Step 2: Rental terms summary */}
      <Modal visible={bookingStep === 2} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rental terms summary</Text>
            <Text style={styles.muted}>Review before continuing.</Text>
            <Text style={styles.body}>
              <Text style={styles.bodyStrong}>Monthly rent: </Text>₱
              {listing.price.toLocaleString()}
            </Text>
            <Text style={styles.body}>
              <Text style={styles.bodyStrong}>Advance (1 month): </Text>₱
              {listing.price.toLocaleString()}
            </Text>
            <Text style={styles.body}>
              <Text style={styles.bodyStrong}>Security deposit (1 month): </Text>₱
              {listing.price.toLocaleString()}
            </Text>
            <Text style={styles.termItem}>
              Advance is applied to your first month&apos;s rent.
            </Text>
            <Text style={styles.termItem}>
              Security deposit is refundable at end of lease if terms are met.
            </Text>
            <Text style={styles.termItem}>
              Utilities may be billed separately per dorm policy.
            </Text>
            <View style={styles.modalActions}>
              <View style={styles.modalBtn}>
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => {
                    setBookingStep(0);
                    setShowTerms(true);
                  }}
                />
              </View>
              <View style={styles.modalBtn}>
                <Button label="Next" onPress={() => setBookingStep(3)} />
              </View>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Step 3: Move-in & lease */}
      <Modal visible={bookingStep === 3} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm reservation</Text>
            <Text style={styles.muted}>Choose move-in date and lease duration.</Text>
            {submitError ? (
              <Text style={styles.error}>{submitError}</Text>
            ) : null}
            <Text style={styles.inputLabel}>Move-in date (YYYY-MM-DD)</Text>
            <Input
              value={moveInDate}
              onChangeText={setMoveInDate}
              placeholder="2026-06-01"
              autoCapitalize="none"
            />
            <Text style={styles.inputLabel}>Lease duration</Text>
            <View style={styles.durationRow}>
              {(["6", "12", "18"] as const).map((m) => (
                <Button
                  key={m}
                  label={`${m} mo`}
                  variant={leaseMonths === m ? "primary" : "outline"}
                  onPress={() => setLeaseMonths(m)}
                />
              ))}
            </View>
            <Text style={styles.muted}>
              Final terms are subject to landlord confirmation.
            </Text>
            <View style={styles.modalActions}>
              <View style={styles.modalBtn}>
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setBookingStep(2)}
                />
              </View>
              <View style={styles.modalBtn}>
                <Button
                  label={submitting ? "Submitting…" : "Confirm"}
                  onPress={() => void submitReservation()}
                  loading={submitting}
                  disabled={!moveInDate.trim() || submitting}
                />
              </View>
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  scroll: { paddingBottom: 100 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  warnCard: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  warnText: { fontSize: 13, color: "#92400e", lineHeight: 18 },
  price: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.sky,
    marginVertical: 8,
  },
  priceUnit: { fontSize: 14, fontWeight: "400", color: colors.muted },
  reviewAvg: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  section: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 8,
  },
  body: { fontSize: 14, color: "#334155", lineHeight: 20, marginTop: 4 },
  bodyStrong: { fontSize: 14, fontWeight: "600", color: colors.navy },
  muted: { fontSize: 12, color: colors.muted, marginTop: 4 },
  amenityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
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
  stars: { color: "#d97706", fontSize: 14, marginVertical: 4 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerHint: { textAlign: "center", fontSize: 13, color: colors.muted },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    padding: 16,
  },
  modalCard: { maxHeight: "85%" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
  termsScroll: { maxHeight: 280, marginVertical: 12 },
  termItem: { fontSize: 13, color: "#334155", lineHeight: 20, marginBottom: 8 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  modalBtn: { flex: 1 },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy,
    marginTop: 8,
    marginBottom: 4,
  },
  durationRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
});
