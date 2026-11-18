import { type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppModal } from "@/components/keyboard-lift";
import { bottomNavPad } from "@/lib/nav-inset";

type KeyboardAwareModalProps = {
  visible: boolean;
  onRequestClose?: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  scrollable?: boolean;
};

export function KeyboardAwareModal({
  visible,
  onRequestClose,
  children,
  sheetStyle,
  scrollable = true,
}: KeyboardAwareModalProps) {
  const insets = useSafeAreaInsets();

  const content = scrollable ? (
    <ScrollView
      style={styles.modalScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <AppModal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onRequestClose}
    >
      <View
        style={[styles.overlay, styles.flex, { paddingBottom: bottomNavPad(insets.bottom, 16) }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          style={StyleSheet.absoluteFill}
          onPress={onRequestClose}
        >
          <View style={styles.backdrop} />
        </Pressable>
        <View style={[styles.sheet, sheetStyle]}>{content}</View>
      </View>
    </AppModal>
  );
}

/** Bottom-sheet overlay without Modal — for use inside an existing Modal shell. */
export function KeyboardAwareSheet({
  children,
  sheetStyle,
  scrollable = true,
}: {
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  scrollable?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const content = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <View style={[styles.overlay, styles.flex, { paddingBottom: bottomNavPad(insets.bottom, 16) }]}>
      <View style={[styles.sheet, sheetStyle]}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalScroll: { flexGrow: 0, flexShrink: 1 },
  backdrop: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: "85%",
  },
});
