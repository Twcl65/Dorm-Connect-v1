import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ImageGallery } from "@/components/image-gallery";
import { InfoGrid } from "@/components/info-grid";
import { DateField } from "@/components/date-field";
import { GcashPaymentForm } from "@/components/gcash-payment-form";
import { KeyboardAwareModal } from "@/components/keyboard-aware-modal";
import { apiRequest, type StudentReservation } from "@/lib/api";
import { showRoomDetailsAside, formatLeaseEndLabel, addMonthsIso } from "@/lib/listing-utils";
import { Badge, Button, Card, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { bottomNavPad } from "@/lib/nav-inset";

type Props = {
  visible: boolean;
  reservation: StudentReservation | null;
  onClose: () => void;
  onChanged: () => void;
};

export function ReservationDetailModal({
  visible,
  reservation,
  onClose,
  onChanged,
}: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [payOpen, setPayOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [moveOutDate, setMoveOutDate] = useState("");
  const [extendDate, setExtendDate] = useState("");
  const [saving, setSaving] = useState(false);

  if (!reservation) return null;

  const bottomPad = bottomNavPad(insets.bottom, 20);
  const canCancel = reservation.status === "Pending";
  const canPay =
    reservation.status !== "Cancelled" && !reservation.paymentSent;
  const canManageLease =
    (reservation.status === "Approved" || reservation.status === "Active") &&
    Boolean(reservation.paymentSent);
  const extensionPending = reservation.leaseExtension?.status === "Pending";
  const canExtend = canManageLease && !extensionPending;

  const cancelReservation = () => {
    Alert.alert(
      "Cancel reservation",
      "The landlord will be notified and this request will be marked Cancelled.",
      [
        { text: "Keep reservation", style: "cancel" },
        {
          text: "Cancel reservation",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (!token) return;
              setSaving(true);
              try {
                await apiRequest(`/api/student/reservations/${reservation.id}`, {
                  method: "PATCH",
                  token,
                  body: { status: "Cancelled" },
                });
                onChanged();
                onClose();
              } catch (e) {
                Alert.alert(
                  "Could not cancel",
                  e instanceof Error ? e.message : "Request failed."
                );
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ]
    );
  };

  const confirmTerminate = () => {
    if (!moveOutDate) {
      Alert.alert("Move-out date", "Select the day you will move out.");
      return;
    }
    Alert.alert(
      "End lease early?",
      `Move out on ${formatLeaseEndLabel(moveOutDate)} instead of waiting for the original last day of stay?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, end lease",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (!token) return;
              setSaving(true);
              try {
                await apiRequest(`/api/student/reservations/${reservation.id}`, {
                  method: "PATCH",
                  token,
                  body: { leaseEnd: moveOutDate },
                });
                setTerminateOpen(false);
                onChanged();
                onClose();
              } catch (e) {
                Alert.alert(
                  "Could not update lease",
                  e instanceof Error ? e.message : "Request failed."
                );
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ]
    );
  };

  const confirmExtend = () => {
    if (!extendDate) {
      Alert.alert("New last day of stay", "Select the new lease end date.");
      return;
    }
    Alert.alert(
      "Request lease extension?",
      `Ask the landlord to extend your stay through ${formatLeaseEndLabel(extendDate)}? Your last day of stay will not change until they approve.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Send request",
          onPress: () => {
            void (async () => {
              if (!token) return;
              setSaving(true);
              try {
                await apiRequest(`/api/student/reservations/${reservation.id}`, {
                  method: "PATCH",
                  token,
                  body: { leaseEnd: extendDate, extend: true },
                });
                setExtendOpen(false);
                onChanged();
                onClose();
              } catch (e) {
                Alert.alert(
                  "Could not extend lease",
                  e instanceof Error ? e.message : "Request failed."
                );
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ]
    );
  };

  const minMoveOut = new Date();
  const maxMoveOut = reservation.leaseEndDate
    ? new Date(`${reservation.leaseEndDate}T12:00:00`)
    : undefined;
  if (maxMoveOut) maxMoveOut.setDate(maxMoveOut.getDate() - 1);

  const minExtend = reservation.leaseEndDate
    ? new Date(`${reservation.leaseEndDate}T12:00:00`)
    : new Date();
  minExtend.setDate(minExtend.getDate() + 1);
  const maxExtend = reservation.leaseEndDate
    ? new Date(`${addMonthsIso(reservation.leaseEndDate, 12)}T12:00:00`)
    : undefined;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <Pressable style={styles.overlayDismiss} onPress={onClose} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>
                  {reservation.dorm} · Room {reservation.room}
                </Text>
                <Text style={styles.sub}>{reservation.location}</Text>
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {(reservation.images?.length ?? 0) > 0 && (
                <ImageGallery urls={reservation.images!} alt={reservation.dorm} />
              )}

              <Card>
                <InfoGrid
                  rows={[
                    [
                      { label: "Dorm name", value: reservation.dorm },
                      { label: "Room #", value: `Room ${reservation.room}` },
                    ],
                    [
                      {
                        label: "Lease duration",
                        value: `${reservation.leaseMonths} ${reservation.leaseMonths === 1 ? "month" : "months"}`,
                      },
                      {
                        label: "Move-out date",
                        value: reservation.leaseEndDate
                          ? formatLeaseEndLabel(reservation.leaseEndDate)
                          : "—",
                      },
                    ],
                    [
                      {
                        label: "Extension request",
                        value:
                          reservation.leaseExtension?.status === "Pending" &&
                          reservation.leaseExtension.requestedEnd
                            ? formatLeaseEndLabel(
                                reservation.leaseExtension.requestedEnd
                              )
                            : reservation.leaseExtension?.status === "Rejected"
                              ? "Declined"
                              : "None",
                      },
                    ],
                    [
                      {
                        label: "Stay",
                        value: reservation.stayLabel ?? reservation.status,
                      },
                      {
                        label: "Rent",
                        value: reservation.rentLabel ?? "—",
                      },
                    ],
                    [
                      {
                        label: "Monthly rent",
                        value: `₱${reservation.monthlyRent.toLocaleString()}`,
                      },
                      { label: "Landlord", value: reservation.landlord },
                    ],
                  ]}
                />
              </Card>

              <Card>
                <Text style={styles.section}>About the room</Text>
                <Text style={styles.body} numberOfLines={6}>
                  {reservation.description}
                </Text>
                {showRoomDetailsAside(
                  reservation.description ?? "",
                  reservation.roomDetails
                ) && reservation.roomDetails ? (
                  <Text style={styles.meta}>{reservation.roomDetails}</Text>
                ) : null}
                {reservation.roomSizeLabel || reservation.capacity ? (
                  <Text style={styles.meta}>
                    {[
                      reservation.capacity && `Capacity ${reservation.capacity}`,
                      reservation.roomSizeLabel &&
                        `Size ${reservation.roomSizeLabel}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : null}
              </Card>

              {(reservation.amenities?.length ?? 0) > 0 && (
                <View style={styles.amenityRow}>
                  {reservation.amenities!.map((a) => (
                    <Badge key={a} label={a} />
                  ))}
                </View>
              )}
            </ScrollView>
          </View>

          <View style={[styles.footer, { paddingBottom: bottomPad }]}>
            {canPay ? (
              <Button
                label="Pay now"
                variant="brand"
                fullWidth
                onPress={() => setPayOpen(true)}
              />
            ) : null}
            {reservation.paymentSent && !canManageLease ? (
              <Badge
                label="Payment submitted — waiting for approval"
                tone="success"
              />
            ) : null}
            {canExtend ? (
              <Button
                label="Extend lease"
                variant="sky"
                fullWidth
                onPress={() => {
                  setExtendDate("");
                  setExtendOpen(true);
                }}
              />
            ) : null}
            {extensionPending ? (
              <Badge
                label="Extension pending landlord approval"
                tone="warning"
              />
            ) : null}
            {canManageLease ? (
              <Button
                label="Terminate lease"
                variant="danger"
                fullWidth
                onPress={() => {
                  setMoveOutDate("");
                  setTerminateOpen(true);
                }}
              />
            ) : null}
            {canCancel ? (
              <Button
                label="Cancel reservation"
                variant="danger"
                fullWidth
                onPress={cancelReservation}
                disabled={saving}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <KeyboardAwareModal
        visible={payOpen}
        onRequestClose={() => setPayOpen(false)}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Pay reservation</Text>
          <Pressable onPress={() => setPayOpen(false)} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.navy} />
          </Pressable>
        </View>
        <Text style={styles.sub}>
          First month + advance + deposit: ₱
          {(reservation.monthlyRent * 3).toLocaleString()}
        </Text>
        {token ? (
          <GcashPaymentForm
            token={token}
            target={{
              reservationId: reservation.id,
              amount: reservation.monthlyRent * 3,
              landlordName: reservation.landlord,
              gcashAccountName: reservation.gcashAccountName,
              gcashPhone: reservation.gcashPhone,
              gcashQrCodeUrl: reservation.gcashQrCodeUrl,
              description: "Initial reservation payment (GCash)",
            }}
            onSuccess={() => {
              setPayOpen(false);
              onChanged();
            }}
            onError={(msg) => Alert.alert("Payment", msg)}
          />
        ) : null}
      </KeyboardAwareModal>

      <KeyboardAwareModal
        visible={extendOpen}
        onRequestClose={() => setExtendOpen(false)}
        scrollable={false}
        sheetStyle={styles.terminateSheet}
      >
        <View style={styles.terminateBody}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Extend lease</Text>
            <Pressable onPress={() => setExtendOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.navy} />
            </Pressable>
          </View>
          <Text style={styles.body}>
            Choose a new last day of stay after{" "}
            {reservation.leaseEndDate
              ? formatLeaseEndLabel(reservation.leaseEndDate)
              : "the current end date"}
            . You can extend up to 12 extra months.
          </Text>
          <DateField
            label="New last day of stay"
            value={extendDate}
            onChange={setExtendDate}
            minimumDate={minExtend}
            maximumDate={maxExtend}
          />
          <View style={styles.terminateSpacer} />
          <View style={{ gap: 8 }}>
            <Button
              label="Send request"
              variant="sky"
              fullWidth
              disabled={saving}
              loading={saving}
              onPress={confirmExtend}
            />
            <Button
              label="No"
              variant="outline"
              fullWidth
              onPress={() => setExtendOpen(false)}
            />
          </View>
        </View>
      </KeyboardAwareModal>

      <KeyboardAwareModal
        visible={terminateOpen}
        onRequestClose={() => setTerminateOpen(false)}
        scrollable={false}
        sheetStyle={styles.terminateSheet}
      >
        <View style={styles.terminateBody}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terminate lease</Text>
            <Pressable onPress={() => setTerminateOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.navy} />
            </Pressable>
          </View>
          <Text style={styles.body}>
            Choose the date you will move out. This ends the lease before the
            original last day of stay.
          </Text>
          <DateField
            label="Move-out date"
            value={moveOutDate}
            onChange={setMoveOutDate}
            minimumDate={minMoveOut}
            maximumDate={maxMoveOut}
          />
          <View style={styles.terminateSpacer} />
          <View style={{ gap: 8 }}>
            <Button
              label="Yes, end lease"
              variant="danger"
              fullWidth
              disabled={saving}
              loading={saving}
              onPress={confirmTerminate}
            />
            <Button
              label="No"
              variant="outline"
              fullWidth
              onPress={() => setTerminateOpen(false)}
            />
          </View>
        </View>
      </KeyboardAwareModal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  overlayDismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "78%",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1, paddingRight: 12 },
  title: { fontSize: 17, fontWeight: "700", color: colors.navy },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 8 },
  scroll: { maxHeight: 420 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  section: { fontSize: 14, fontWeight: "600", color: colors.navy },
  body: { fontSize: 14, color: "#334155", marginTop: 8, lineHeight: 20 },
  meta: { fontSize: 13, color: colors.muted, marginTop: 6 },
  amenityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  footer: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
  terminateSheet: {
    minHeight: "70%",
  },
  terminateBody: { flexGrow: 1, minHeight: 280 },
  terminateSpacer: { flexGrow: 1, minHeight: 24 },
});
