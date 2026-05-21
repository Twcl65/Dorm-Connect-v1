import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ImageGallery } from "@/components/image-gallery";
import type { StudentReservation } from "@/lib/api";
import { showRoomDetailsAside } from "@/lib/listing-utils";
import { Badge, Button, Card, colors } from "@/components/ui";

type Props = {
  visible: boolean;
  reservation: StudentReservation | null;
  onClose: () => void;
  onPay?: () => void;
};

export function ReservationDetailModal({
  visible,
  reservation,
  onClose,
  onPay,
}: Props) {
  if (!reservation) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {reservation.dorm} · Room {reservation.room}
              </Text>
              <Text style={styles.sub}>{reservation.location}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.navy} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll}>
            {(reservation.images?.length ?? 0) > 0 && (
              <ImageGallery urls={reservation.images!} alt={reservation.dorm} />
            )}

            <Card>
              <Text style={styles.label}>Status</Text>
              <Badge
                label={reservation.status}
                tone={
                  reservation.status === "Approved"
                    ? "success"
                    : reservation.status === "Cancelled"
                      ? "danger"
                      : "warning"
                }
              />
              <Text style={styles.label}>Submitted</Text>
              <Text style={styles.value}>{reservation.date}</Text>
              <Text style={styles.label}>Move-in</Text>
              <Text style={styles.value}>{reservation.moveInDate}</Text>
              <Text style={styles.label}>Lease</Text>
              <Text style={styles.value}>
                {reservation.leasePeriod ??
                  `${reservation.leaseMonths} months`}
              </Text>
              <Text style={styles.label}>Monthly rent</Text>
              <Text style={styles.value}>
                ₱{reservation.monthlyRent.toLocaleString()}
              </Text>
              <Text style={styles.label}>Landlord</Text>
              <Text style={styles.value}>{reservation.landlord}</Text>
              {reservation.documentType ? (
                <>
                  <Text style={styles.label}>Document</Text>
                  <Text style={styles.value}>{reservation.documentType}</Text>
                </>
              ) : null}
            </Card>

            <Card>
              <Text style={styles.section}>Room listing</Text>
              <Text style={styles.body}>{reservation.description}</Text>
              {showRoomDetailsAside(
                reservation.description ?? "",
                reservation.roomDetails
              ) &&
              reservation.roomDetails ? (
                <Text style={styles.body}>{reservation.roomDetails}</Text>
              ) : null}
              {reservation.roomSizeLabel ? (
                <Text style={styles.meta}>Size: {reservation.roomSizeLabel}</Text>
              ) : null}
              {reservation.capacity ? (
                <Text style={styles.meta}>Capacity: {reservation.capacity}</Text>
              ) : null}
            </Card>

            {(reservation.amenities?.length ?? 0) > 0 && (
              <Card>
                <Text style={styles.section}>Amenities</Text>
                <View style={styles.amenityRow}>
                  {reservation.amenities!.map((a) => (
                    <Badge key={a} label={a} />
                  ))}
                </View>
              </Card>
            )}

            {reservation.paymentSent && (
              <Badge label="Payment submitted" tone="success" />
            )}
          </ScrollView>

          <View style={styles.footer}>
            {onPay &&
              (reservation.status === "Approved" ||
                reservation.status === "Active") && (
                <Button label="Go to payments" onPress={onPay} />
              )}
            <Button label="Close" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "92%",
    paddingBottom: 16,
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
  sub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  scroll: { paddingHorizontal: 16, maxHeight: "70%" },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 10,
    textTransform: "uppercase",
  },
  value: { fontSize: 14, color: colors.text, fontWeight: "500" },
  section: { fontSize: 14, fontWeight: "600", color: colors.navy },
  body: { fontSize: 14, color: "#334155", marginTop: 8, lineHeight: 20 },
  meta: { fontSize: 13, color: colors.muted, marginTop: 6 },
  amenityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
});
