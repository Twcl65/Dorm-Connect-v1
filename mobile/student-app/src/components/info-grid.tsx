import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/components/ui";

export type InfoCell = { label: string; value: string };

export function InfoGrid({ rows }: { rows: InfoCell[][] }) {
  return (
    <View style={styles.wrap}>
      {rows.map((pair, i) => (
        <View key={i} style={styles.row}>
          {pair.map((cell) => (
            <View key={cell.label} style={styles.cell}>
              <Text style={styles.label}>{cell.label}</Text>
              <Text style={styles.value}>{cell.value}</Text>
            </View>
          ))}
          {pair.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8 },
  row: { flexDirection: "row", gap: 10 },
  cell: { flex: 1, minWidth: 0 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginTop: 3,
  },
});
