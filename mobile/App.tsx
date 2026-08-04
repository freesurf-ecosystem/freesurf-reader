import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import ReaderScreen from "./screens/ReaderScreen";
import HistoryScreen from "./screens/HistoryScreen";

export type RootStackParamList = {
  Reader: undefined;
  History: { isDark?: boolean } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    requestTrackingPermissionsAsync().catch(() => {});
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0b1020" }, animation: "slide_from_right" }}>
        <Stack.Screen name="Reader">{(props) => (
          <ReaderScreen navigation={props.navigation} />
        )}</Stack.Screen>
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
