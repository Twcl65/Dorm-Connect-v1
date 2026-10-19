import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { colors } from "@/components/ui";

type Props = {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  style?: ViewStyle;
};

function parseIsoDate(iso: string): Date {
  if (iso?.trim()) return new Date(`${iso.slice(0, 10)}T12:00:00`);
  return new Date();
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = "Select date",
  style,
}: Props) {
  const [show, setShow] = useState(false);

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed") return;
    if (selected) onChange(toIsoDate(selected));
  };

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={() => setShow(true)}
        accessibilityRole="button"
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
      </Pressable>

      {show && Platform.OS === "ios" && (
        <View style={styles.iosPickerWrap}>
          <DateTimePicker
            value={parseIsoDate(value)}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={onPickerChange}
          />
          <Pressable style={styles.doneBtn} onPress={() => setShow(false)}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      )}

      {show && Platform.OS === "android" && (
        <DateTimePicker
          value={parseIsoDate(value)}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onPickerChange}
        />
      )}
    </View>
  );
}

function formatDisplayDate(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy,
    marginTop: 8,
    marginBottom: 4,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
  },
  fieldText: {
    fontSize: 14,
    color: colors.text,
  },
  placeholder: { color: colors.muted },
  iosPickerWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  doneBtn: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#f8fafc",
  },
  doneText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand,
  },
});
