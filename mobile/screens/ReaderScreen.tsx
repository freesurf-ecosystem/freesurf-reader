import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View, ScrollView, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform, Linking, Switch, TouchableOpacity,
} from "react-native";
import {
  Text, Button, Surface,
  TextInput as PaperInput, useTheme,
} from "react-native-paper";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { textToSpeech, VOICES, type Voice } from "../lib/tts";
import FloatingHamburger from "../components/FloatingHamburger";
import { FileText, Mic } from "lucide-react-native";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Reader">; isDark?: boolean; onToggleTheme?: () => void; };

const AUDIO_DIR = FileSystem.documentDirectory + "reader-audio/";
const MIN_INPUT_HEIGHT = 280;
const MAX_CHUNK = 4000;
const HISTORY_PATH = AUDIO_DIR + "history.json";

async function safeWriteHistory(data: unknown) {
  const tmp = HISTORY_PATH + ".tmp";
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(data));
  await FileSystem.deleteAsync(HISTORY_PATH, { idempotent: true }).catch(() => {});
  await FileSystem.moveAsync({ from: tmp, to: HISTORY_PATH });
}

function chunkText(t: string): string[] {
  const text = t.trim();
  if (!text) return [];
  if (text.length <= MAX_CHUNK) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK) { chunks.push(remaining.trim()); break; }
    let brk = remaining.lastIndexOf(". ", MAX_CHUNK);
    if (brk < 300) brk = remaining.lastIndexOf("? ", MAX_CHUNK);
    if (brk < 300) brk = remaining.lastIndexOf("! ", MAX_CHUNK);
    if (brk < 300) brk = remaining.lastIndexOf("\n", MAX_CHUNK);
    if (brk < 300) brk = remaining.lastIndexOf(" ", MAX_CHUNK);
    if (brk < 300) brk = MAX_CHUNK;
    chunks.push(remaining.slice(0, brk + 1).trim());
    remaining = remaining.slice(brk + 1).trim();
  }
  return chunks.filter(s => s.length > 10);
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
}

export default function ReaderScreen({ navigation, isDark, onToggleTheme }: Props) {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [savedToast, setSavedToast] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    ensureDir().then(() => {
      FileSystem.readAsStringAsync(HISTORY_PATH).then(j =>
        setHistoryCount(JSON.parse(j).length)
      ).catch(() => {});
    });
  }, []);

  const timeEstimate = useMemo(() => {
    const len = (text || "").trim().length;
    if (!len) return null;
    const chunks = Math.max(1, Math.ceil(len / MAX_CHUNK));
    const totalSec = Math.ceil(len * 3 / 1000) + (chunks * 15);
    const m = Math.floor(totalSec / 60), s = totalSec % 60;
    return m > 0 ? `~${m}m ${s}s` : `~${s}s`;
  }, [text]);

  async function handleRead() {
    const content = text.trim();
    if (!content) return;
    if (isPlaying || isGenerating) { await stopPlayback(); return; }

    setIsGenerating(true);
    try {
      const chunks = chunkText(content);
      await ensureDir();
      const batchId = Date.now();
      const uris: string[] = [];

      const firstB64 = await textToSpeech(chunks[0], selectedVoice.voice);
      const firstFname = `reader-${batchId}-0.wav`;
      const firstUri = AUDIO_DIR + firstFname;
      await FileSystem.writeAsStringAsync(firstUri, firstB64, { encoding: FileSystem.EncodingType.Base64 });
      uris.push(firstUri);

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri: firstUri }, { shouldPlay: true }, (status) => {
        if (status.isLoaded && status.didJustFinish) { setIsPlaying(false); sound.unloadAsync().catch(() => {}); }
      });
      soundRef.current = sound;
      setIsPlaying(true);
      setIsGenerating(false);

      const entryId = `${batchId}-0`;
      const hist = await FileSystem.readAsStringAsync(HISTORY_PATH).then(j => JSON.parse(j)).catch(() => []);
      hist.unshift({ id: entryId, title: title.trim() || content.slice(0, 50), text: content, voice: selectedVoice.label, uri: firstUri, uris: [firstUri], createdAt: Date.now() });
      await safeWriteHistory(hist.slice(0, 50));
      setHistoryCount(Math.min(hist.length, 50));
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);

      for (let i = 1; i < chunks.length; i++) {
        try {
          await new Promise(r => setTimeout(r, 2000));
          const b64 = await textToSpeech(chunks[i], selectedVoice.voice);
          const fname = `reader-${batchId}-${i}.wav`;
          const uri = AUDIO_DIR + fname;
          await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
          uris.push(uri);
        } catch (e: any) {
          try {
            await new Promise(r => setTimeout(r, 5000));
            const b64 = await textToSpeech(chunks[i], selectedVoice.voice);
            const fname = `reader-${batchId}-${i}.wav`;
            const uri = AUDIO_DIR + fname;
            await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
            uris.push(uri);
          } catch {}
        }
      }

      const updatedHist = await FileSystem.readAsStringAsync(HISTORY_PATH).then(j => JSON.parse(j)).catch(() => []);
      const idx = updatedHist.findIndex((r: {id: string}) => r.id === entryId);
      if (idx >= 0) updatedHist[idx].uris = uris;
      await safeWriteHistory(updatedHist);
    } catch (e: any) {
      setIsGenerating(false);
      Alert.alert("Error", e.message || "Failed to generate audio.");
    }
  }

  async function stopPlayback() {
    try { await soundRef.current?.stopAsync(); await soundRef.current?.unloadAsync(); } catch {}
    soundRef.current = null; setIsPlaying(false);
  }

  async function handleImport() {
    setIsImporting(true);
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["text/plain"], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) { setIsImporting(false); return; }
      const f = r.assets[0];
      setTitle(f.name || "");
      const content = await FileSystem.readAsStringAsync(f.uri, { encoding: FileSystem.EncodingType.Utf8 });
      setText(content);
    } catch (e: any) {
      if (!String(e).includes("canceled")) Alert.alert("Import failed", e.message);
    }
    setIsImporting(false);
  }

  const themeToggleFooter = onToggleTheme ? (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
      <Switch value={!isDark} onValueChange={onToggleTheme} trackColor={{ true: isDark ? "#ffffff" : "#111827", false: "#555" }} />
    </View>
  ) : undefined;

  const hbColors = {
    text: theme.colors.onSurface,
    dim: theme.colors.onSurfaceVariant,
    card: theme.colors.surface,
    border: theme.colors.outline,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FloatingHamburger
        topOffset={48}
        colors={hbColors}
        footer={themeToggleFooter}
        menuItems={[
          { label: "Recordings", onPress: () => navigation.navigate("History", { isDark }) },
          { label: "Support", onPress: () => Linking.openURL("https://freesurf.tools/support") },
          { label: "Privacy", onPress: () => Linking.openURL("https://freesurf.tools/privacy") },
          { label: "Terms", onPress: () => Linking.openURL("https://freesurf.tools/terms") },
          { label: "About Us", onPress: () => Alert.alert("About FreeSurf Reader", "FreeSurf Reader transforms text into natural-sounding speech. Just paste or import a document and choose from over 40 voices.\n\nMore free apps are on the way — stay tuned for calorie tracking, transcription, and more.") },
        ]}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flex: 1, padding: 16, paddingTop: 52, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" decelerationRate={0.998}>
        <PaperInput mode="flat" style={{ fontSize: 20, fontWeight: "600", backgroundColor: "transparent", marginBottom: 8 }}
          placeholder="Document title" value={title} onChangeText={setTitle}
          underlineColor={theme.colors.outline} activeUnderlineColor={theme.colors.primary} />

        <PaperInput mode="flat"
          style={{ flex: 1, minHeight: inputHeight, fontSize: 17, lineHeight: 26, backgroundColor: "transparent", marginTop: 8 }}
          placeholder="Paste an article, study guide, or document text here..."
          value={text} onChangeText={setText}
          multiline textAlignVertical="top"
          underlineColor="transparent" activeUnderlineColor="transparent"
        />
      </ScrollView>

      <Surface style={{ borderTopWidth: 1, borderTopColor: theme.colors.outline, paddingBottom: 32 }} elevation={0}>
        {savedToast && (
          <View style={{ paddingVertical: 6, alignItems: "center" }}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Saved to Recordings</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
          <Button mode="text" onPress={handleImport} loading={isImporting} icon={() => <FileText size={16} color={theme.colors.onSurface} />}
            textColor={theme.colors.onSurface}>Import</Button>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 1 }}>
            <Button mode="contained-tonal" onPress={handleRead}
              icon={() => <Mic size={16} color={theme.colors.primary} />}
              labelStyle={{ fontSize: 13 }}>
              {isGenerating ? `Preparing...` : isPlaying ? "Stop" : "Read"}
            </Button>
            <Button mode="outlined" onPress={() => setShowVoicePicker(true)}
              textColor={theme.colors.onSurface} labelStyle={{ fontSize: 13 }}
              style={{ flexShrink: 1 }}>
              {selectedVoice.label}{' '}
            </Button>
          </View>
        </View>
      </Surface>

      <Modal visible={showVoicePicker} transparent animationType="slide" onRequestClose={() => setShowVoicePicker(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowVoicePicker(false)} />
          <Surface style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 48 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.outline }}>Choose voice</Text>
            <ScrollView style={{ maxHeight: 420 }} bounces={false}>
              {VOICES.map(v => (
                <View key={v.id} style={{ borderBottomWidth: 0.5, borderBottomColor: theme.colors.outline }}>
                  <Button mode="text" onPress={() => { setSelectedVoice(v); setShowVoicePicker(false); }}
                    contentStyle={{ flexDirection: "column", alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 20, gap: 2 }}
                    textColor={selectedVoice.id === v.id ? theme.colors.primary : theme.colors.onSurface}>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {selectedVoice.id === v.id && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary, alignSelf: "center" }} />}
                      <Text style={{ fontWeight: selectedVoice.id === v.id ? "700" : "400", fontSize: 15 }}>{v.label} </Text>
                    </View>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2, marginLeft: selectedVoice.id === v.id ? 10 : 0 }}>{v.description}</Text>
                  </Button>
                </View>
              ))}
            </ScrollView>
          </Surface>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
