import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { supabase } from "./lib/supabase";
import ReaderScreen from "./screens/ReaderScreen";
import HistoryScreen from "./screens/HistoryScreen";
import AuthScreen from "./screens/AuthScreen";

export type RootStackParamList = {
  Reader: undefined;
  History: undefined;
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(Boolean(s)));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    requestTrackingPermissionsAsync().catch(() => {});
  }, []);

  if (session === null) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#5b8cff" /></View>;
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0b1020" }, animation: "slide_from_right" }}>
        <Stack.Screen name="Reader">{(props) => (
          <ReaderScreen navigation={props.navigation} isLoggedIn={session} />
        )}</Stack.Screen>
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Auth">{(props) => (
          <AuthScreen onAuthenticated={() => { setSession(true); props.navigation.goBack(); }} onBack={() => props.navigation.goBack()} />
        )}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#0b1020", justifyContent: "center", alignItems: "center" },
});
