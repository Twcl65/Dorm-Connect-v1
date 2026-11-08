import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "expo-router";

/** Close the app when Android back is pressed from a role's home tab. */
export function useAndroidHomeBack() {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          BackHandler.exitApp();
          return true;
        }
      );
      return () => subscription.remove();
    }, [])
  );
}
