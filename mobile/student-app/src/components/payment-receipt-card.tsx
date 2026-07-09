import { StyleSheet, Text, View } from "react-native";
import type { PaymentReceiptData } from "@/lib/api";
import { colors } from "@/components/ui";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReceiptRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.dt, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.dd, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

export function PaymentReceiptCard({
  payment,
  footerNote = "This receipt was generated from your DormConnect account. Keep for your records.",
}: {
  payment: PaymentReceiptData;
  footerNote?: string;
}) {
  const receiptDate = payment.paidAt ?? payment.createdAt;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.brand}>DormConnect</Text>
        <Text style={styles.subtitle}>Payment receipt</Text>
      </View>

      <ReceiptRow
        label="Receipt No."
        value={payment.id.slice(0, 8).toUpperCase()}
      />
      <ReceiptRow label="Date" value={formatDate(receiptDate)} />
      {payment.periodLabel ? (
        <ReceiptRow label="Period" value={payment.periodLabel} />
      ) : null}
      <ReceiptRow label="Student" value={payment.studentName} />
      <ReceiptRow
        label="Dorm / Room"
        value={`${payment.dormName} — ${payment.roomNo}`}
      />
      <ReceiptRow label="Landlord" value={payment.landlord} />
      <ReceiptRow label="Lease period" value={payment.leasePeriod} />
      <ReceiptRow label="Method" value={payment.method} />

      {payment.lineItems && payment.lineItems.length > 0 ? (
        <View style={styles.lineItemsBlock}>
          <Text style={styles.lineItemsTitle}>What this payment covers</Text>
          {payment.lineItems.map((line) => (
            <View key={line.label} style={styles.row}>
              <Text style={styles.lineLabel}>{line.label}</Text>
              <Text style={styles.lineAmount}>
                ₱{line.amount.toLocaleString()}
              </Text>
            </View>
          ))}
          <Text style={styles.lineHint}>
            Initial move-in total: first month&apos;s rent, one month advance
            (applied to your first month), and a one-month security deposit held
            until the lease ends, subject to your agreement with the landlord.
          </Text>
        </View>
      ) : null}

      {payment.notes ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesTitle}>Notes / description</Text>
          <Text style={styles.notesBody}>{payment.notes}</Text>
        </View>
      ) : null}

      {!payment.lineItems && payment.monthlyRent ? (
        <Text style={styles.rentHint}>
          Monthly rent on file: ₱{payment.monthlyRent.toLocaleString()}. This
          payment amount may cover a partial period or other charges—see notes if
          provided.
        </Text>
      ) : null}

      <View style={styles.totalBlock}>
        <ReceiptRow
          label="Total amount paid"
          value={`₱${payment.amount.toLocaleString()}`}
          bold
        />
        <ReceiptRow label="Status" value={payment.status} />
      </View>

      <Text style={styles.footer}>{footerNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 16,
    marginBottom: 16,
  },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  dt: {
    fontSize: 13,
    color: colors.muted,
    flex: 1,
  },
  dd: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
    textAlign: "right",
  },
  bold: {
    fontWeight: "700",
    color: colors.navy,
  },
  lineItemsBlock: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineItemsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  lineLabel: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
  },
  lineAmount: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  lineHint: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 8,
  },
  notesBlock: {
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  notesBody: {
    fontSize: 12,
    color: "#334155",
    marginTop: 4,
    lineHeight: 18,
  },
  rentHint: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 8,
  },
  totalBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footer: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 16,
  },
});
