import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { deviceLang, translations } from "../i18n";

type Props = { onSelect: (code: string) => void; onBack?: () => void };

const NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  hi: "हिन्दी",
  it: "Italiano",
  ja: "日本語",
  pt: "Português",
  zh: "中文",
};

/** English name for each language, shown to the right of the native name. */
const ENGLISH: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  pt: "Portuguese",
  zh: "Chinese",
};

/** Shown on first launch: pick your app language. Only lists languages we actually translate. */
export default function LanguageChooser({ onSelect, onBack }: Props) {
  const detected = deviceLang();
  const offered = Object.keys(translations).sort((a, b) => (NAMES[a] || a).localeCompare(NAMES[b] || b));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack && (
          <Pressable style={styles.back} onPress={onBack}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={styles.title}>Choose your language</Text>
        {translations[detected] && (
          <Pressable style={styles.detected} onPress={() => onSelect(detected)}>
            <Text style={styles.detectedText}>Use {NAMES[detected] || detected}</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={offered}
        keyExtractor={(code) => code}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelect(item)}>
            <Text style={styles.rowText}>{NAMES[item] || item}</Text>
            <Text style={styles.rowEnglish}>{ENGLISH[item] || item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { paddingHorizontal: 24, paddingTop: 70, paddingBottom: 16, gap: 10 },
  back: { paddingVertical: 4, alignSelf: "flex-start" },
  backText: { color: "#5b8cff", fontSize: 16, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "800", color: "#e8ecff" },
  detected: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#3b6cff", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  detectedText: { color: "#5b8cff", fontWeight: "700" },
  list: { paddingBottom: 40 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1a1a1a",
  },
  rowText: { color: "#e8ecff", fontSize: 16, flexShrink: 1 },
  rowEnglish: { color: "#5f6b7a", fontSize: 14, marginLeft: 12 },
});
