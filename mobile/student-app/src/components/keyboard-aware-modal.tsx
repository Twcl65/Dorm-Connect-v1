import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={onRequestClose}
        >
          <Pressable
            style={[styles.sheet, sheetStyle]}
            onPress={(e) => e.stopPropagation()}
          >
            {content}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
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
  const content = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetStyle]}>{content}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
