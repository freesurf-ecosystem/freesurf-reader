import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { supabase } from "./lib/supabase";
import ConsentScreen from "./screens/ConsentScreen";
import ReaderScreen from "./screens/ReaderScreen";
import HistoryScreen from "./screens/HistoryScreen";
import AuthScreen from "./screens/AuthScreen";

export type RootStackParamList = {
  Consent: undefined;
  Reader: undefined;
  History: undefined;
  Auth: undefined;
};

const CONSENT_KEY = "freesurf-reader-consent-v1";
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [session, setSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(Boolean(s)));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    requestTrackingPermissionsAsync().catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const consented = await AsyncStorage.getItem(CONSENT_KEY);
        setInitialRoute(consented === "true" ? "Reader" : "Consent");
      } catch { setInitialRoute("Consent"); }
    })();
  }, []);

  if (!initialRoute) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#5b8cff" /></View>;
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator initialRouteName={initialRoute as any}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0b1020" }, animation: "slide_from_right" }}>
        <Stack.Screen name="Consent" component={ConsentScreen} />
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
