import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/components/ui";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class MapErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.warn("[MapErrorBoundary]", error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.fallback}>
          <Text style={styles.title}>Map unavailable</Text>
          <Text style={styles.body}>
            Use the room list below to browse dormitories. If maps stay blank on
            Android, add a Google Maps API key and rebuild the app.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    padding: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 6,
  },
  body: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },
});
