import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { AppState, Platform } from "react-native";
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from "react-native-paper";
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from "expo-tracking-transparency";
import ReaderScreen from "./screens/ReaderScreen";
import HistoryScreen from "./screens/HistoryScreen";

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#5b8cff",
    primaryContainer: "#141414",
    background: "#000000",
    surface: "#0d0d0d",
    surfaceVariant: "#141414",
    outline: "#1a1a1a",
    error: "#f87171",
    onPrimary: "#ffffff",
    onBackground: "#e8ecff",
    onSurface: "#e8ecff",
    onSurfaceVariant: "#8899bb",
  },
};

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#3b6cff",
    primaryContainer: "#e0e7ff",
    background: "#fafafa",
    surface: "#ffffff",
    surfaceVariant: "#f0f0f5",
    outline: "#d0d0dd",
    error: "#dc2626",
    onPrimary: "#ffffff",
    onBackground: "#111827",
    onSurface: "#111827",
    onSurfaceVariant: "#6b7280",
  },
};

export type RootStackParamList = {
  Reader: { isDark?: boolean } | undefined;
  History: { isDark?: boolean } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    let requested = false;
    const requestATT = async () => {
      if (requested) return;
      requested = true;
      try {
        const { status } = await getTrackingPermissionsAsync();
        console.log("[ATT] initial status:", status);
        if (status === "undetermined") {
          const req = await requestTrackingPermissionsAsync();
          console.log("[ATT] requested, new status:", req.status);
        }
      } catch (e: any) {
        console.log("[ATT] error:", e?.message || e);
      }
    };

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") requestATT();
    });
    if (AppState.currentState === "active") requestATT();

    return () => subscription.remove();
  }, []);

  return (
    <PaperProvider theme={isDark ? darkTheme : lightTheme}>
      <NavigationContainer>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: isDark ? darkTheme.colors.background : lightTheme.colors.background }, animation: "slide_from_right" }}>
          <Stack.Screen name="Reader">{(props) => (
            <ReaderScreen navigation={props.navigation} isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
          )}</Stack.Screen>
          <Stack.Screen name="History">{(props) => (
            <HistoryScreen {...props} />
          )}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
