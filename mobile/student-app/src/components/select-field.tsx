import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "@/components/ui";

export type SelectOption = {
  value: string;
  label: string;
  subtitle?: string;
};

type Props = {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
};

export function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
  emptyMessage,
}: Props) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const canOpen = !disabled && options.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[
          styles.field,
          disabled && styles.fieldDisabled,
          !canOpen && styles.fieldMuted,
        ]}
        disabled={!canOpen}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[
            styles.fieldText,
            !selected && styles.placeholder,
          ]}
          numberOfLines={2}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={canOpen ? colors.muted : "#cbd5e1"}
        />
      </Pressable>

      {!disabled && options.length === 0 && emptyMessage ? (
        <Text style={styles.hint}>{emptyMessage}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.navy} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {emptyMessage ?? "No options available."}
                </Text>
              }
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        active && styles.optionLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.subtitle ? (
                      <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 46,
  },
  fieldDisabled: {
    backgroundColor: "#f1f5f9",
    opacity: 0.7,
  },
  fieldMuted: {
    backgroundColor: "#f8fafc",
  },
  fieldText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  placeholder: { color: colors.muted },
  hint: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  optionActive: {
    backgroundColor: colors.brandMuted,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  optionLabelActive: {
    fontWeight: "700",
    color: colors.navy,
  },
  optionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  empty: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    padding: 24,
  },
});
