import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { URLS } from "../lib/config";

const CONSENT_KEY = "freesurf-reader-consent-v1";
const PRIVACY_URL = URLS.privacy;

type Props = NativeStackScreenProps<RootStackParamList, "Consent">;

export default function ConsentScreen({ navigation }: Props) {
  async function handleAgree() {
    await AsyncStorage.setItem(CONSENT_KEY, "true");
    navigation.replace("Reader");
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🎧</Text>
        <Text style={styles.title}>Natural Reader</Text>
        <Text style={styles.subtitle}>by FreeSurf</Text>

        <View style={styles.divider} />

        <Text style={styles.body}>
          This app converts text to speech using AI voice models running on our
          own servers. Your text is never sent to third-party AI companies. When
          you tap "Read Aloud", the text is processed in real-time and audio is
          returned immediately.
        </Text>

        <View style={styles.bullets}>
          <Text style={styles.bullet}>• Your text is <Text style={styles.bold}>not stored</Text> on our servers</Text>
          <Text style={styles.bullet}>• Audio is processed and <Text style={styles.bold}>returned immediately</Text></Text>
          <Text style={styles.bullet}>• All recordings are <Text style={styles.bold}>saved on your device only</Text></Text>
          <Text style={styles.bullet}>• <Text style={styles.bold}>No account required</Text> — ever</Text>
        </View>

        <TouchableOpacity style={styles.agreeBtn} onPress={handleAgree}>
          <Text style={styles.agreeText}>Agree & Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.privacyLink}
          onPress={() => Linking.openURL(PRIVACY_URL)}
        >
          <Text style={styles.privacyText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1020",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#111937",
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: "#2a3568",
    alignItems: "center",
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", color: "#e8ecff" },
  subtitle: { fontSize: 14, color: "#5b8cff", marginTop: 2, marginBottom: 4 },
  divider: {
    height: 1,
    backgroundColor: "#2a3568",
    alignSelf: "stretch",
    marginVertical: 20,
  },
  body: {
    fontSize: 14,
    color: "#b3bddf",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 20,
  },
  bullets: {
    alignSelf: "stretch",
    gap: 10,
    marginBottom: 28,
  },
  bullet: {
    fontSize: 13,
    color: "#b3bddf",
    lineHeight: 19,
  },
  bold: { fontWeight: "700", color: "#e8ecff" },
  agreeBtn: {
    backgroundColor: "#5b8cff",
    borderRadius: 12,
    padding: 16,
    alignSelf: "stretch",
    alignItems: "center",
    marginBottom: 12,
  },
  agreeText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  privacyLink: { padding: 8 },
  privacyText: { color: "#5f6b7a", fontSize: 13, textDecorationLine: "underline" },
});
