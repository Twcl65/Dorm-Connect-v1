import { useEffect, useState, type ReactNode } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  TextInput,
  View,
  type ModalProps,
  type TextInputFocusEventData,
  type TextInputProps,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Measurable = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

const GAP = 18;
const listeners = new Set<(shift: number) => void>();
let shift = 0;

function publish(next: number) {
  const value = Math.max(0, Math.round(next));
  if (value === shift) return;
  shift = value;
  listeners.forEach((listener) => listener(shift));
}

function focusedInput(): Measurable | null {
  const state = TextInput.State as typeof TextInput.State & {
    currentlyFocusedInput?: () => Measurable | null;
  };
  return state.currentlyFocusedInput?.() ?? null;
}

function placeInputAboveKeyboard(keyboardTop: number) {
  const input = focusedInput();
  if (!input?.measureInWindow) return;
  input.measureInWindow((_x, y, _width, height) => {
    // y already includes the current lift, so add it back before measuring overlap.
    const overlap = y + shift + height + GAP - keyboardTop;
    publish(overlap);
  });
}

export function scheduleInputAboveKeyboard() {
  const metrics = Keyboard.metrics();
  if (!metrics) return;
  const keyboardTop = metrics.screenY;
  setTimeout(
    () => placeInputAboveKeyboard(keyboardTop),
    Platform.OS === "ios" ? 40 : 90
  );
}

export function withInputAboveKeyboard<T extends TextInputProps>(props: T): T {
  return {
    ...props,
    onFocus: (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      props.onFocus?.(event);
      scheduleInputAboveKeyboard();
    },
  };
}

/** Moves the focused screen so the active input stays above the keyboard. */
export function KeyboardLift({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [offset, setOffset] = useState(shift);

  useEffect(() => {
    listeners.add(setOffset);
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      setTimeout(
        () => placeInputAboveKeyboard(keyboardTop),
        Platform.OS === "ios" ? 40 : 90
      );
    });
    const hide = Keyboard.addListener(hideEvent, () => publish(0));
    return () => {
      listeners.delete(setOffset);
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View style={[{ flex: 1, transform: [{ translateY: -offset }] }, style]}>
      {children}
    </View>
  );
}

export function AppModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <KeyboardLift>{children}</KeyboardLift>
    </Modal>
  );
}
