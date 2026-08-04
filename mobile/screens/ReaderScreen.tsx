import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { textToSpeech, VOICES, type Voice } from "../lib/tts";
import { supabase } from "../lib/supabase";
import TopBar from "../components/TopBar";
import { Sun, Moon, FileText } from "lucide-react-native";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Reader">; isLoggedIn: boolean };

const MIN_INPUT_HEIGHT = 280;
const MAX_CHUNK = 4000;

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

function concatWavChunks(b64Chunks: string[]): string {
  if (b64Chunks.length === 0) return "";
  if (b64Chunks.length === 1) return b64Chunks[0];
  const rawChunks = b64Chunks.map(b64 => {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  });
  const v = new DataView(rawChunks[0].buffer);
  const sampleRate = v.getUint32(24, true), bits = v.getUint16(34, true), ch = v.getUint16(22, true);
  const byteRate = sampleRate * ch * (bits / 8), blockAlign = ch * (bits / 8);
  const pcmTotal = rawChunks.reduce((s, r) => s + r.length - 44, 0);
  const out = new Uint8Array(44 + pcmTotal); const dv = new DataView(out.buffer);
  out.set([0x52,0x49,0x46,0x46],0); dv.setUint32(4,36+pcmTotal,true);
  out.set([0x57,0x41,0x56,0x45],8); out.set([0x66,0x6D,0x74,0x20],12);
  dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,ch,true);
  dv.setUint32(24,sampleRate,true); dv.setUint32(28,byteRate,true);
  dv.setUint16(32,blockAlign,true); dv.setUint16(34,bits,true);
  out.set([0x64,0x61,0x74,0x61],36); dv.setUint32(40,pcmTotal,true);
  let off = 44;
  for (const r of rawChunks) { out.set(r.slice(44), off); off += r.length - 44; }

  // Encode in chunks to avoid stack overflow on large arrays
  const chunkSize = 8192;
  const parts: string[] = [];
  for (let i = 0; i < out.length; i += chunkSize) {
    parts.push(String.fromCharCode(...out.slice(i, i + chunkSize)));
  }
  return btoa(parts.join(""));
}
const AUDIO_DIR = FileSystem.documentDirectory + "reader-audio/";

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
}

export default function ReaderScreen({ navigation, isLoggedIn }: Props) {
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
  const [isDark, setIsDark] = useState(true);

  const soundRef = useRef<Audio.Sound | null>(null);

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  const colors = isDark
    ? { bg: "#0b1020", card: "#111937", text: "#e8ecff", dim: "#8899bb", border: "#2a3568" }
    : { bg: "#f8f9fa", card: "#ffffff", text: "#111827", dim: "#6b7280", border: "#e5e7eb" };

  useEffect(() => {
    ensureDir().then(() => {
      FileSystem.readAsStringAsync(AUDIO_DIR + "history.json").then(j =>
        setHistoryCount(JSON.parse(j).length)
      ).catch(() => {});
    });
  }, []);

  const timeEstimate = useMemo(() => {
    const len = (text || "").trim().length;
    if (!len) return null;
    const sec = Math.ceil(len * 3 / 1000) + 15;
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `~${m}m ${s}s` : `~${s}s`;
  }, [text]);

  async function handleRead() {
    const content = text.trim();
    if (!content) return;
    if (isPlaying || isGenerating) { await stopPlayback(); return; }

    setIsGenerating(true);
    try {
      const ttsText = content.length > MAX_CHUNK ? content.slice(0, MAX_CHUNK) : content;
      const b64 = await textToSpeech(ttsText, selectedVoice.voice);
      await ensureDir();
      const fname = `reader-${Date.now()}.wav`;
      const uri = AUDIO_DIR + fname;
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (status) => {
        if (status.isLoaded && status.didJustFinish) { setIsPlaying(false); sound.unloadAsync().catch(() => {}); }
      });
      soundRef.current = sound;
      setIsPlaying(true);
      setIsGenerating(false);

      const hist = await FileSystem.readAsStringAsync(AUDIO_DIR + "history.json").then(j => JSON.parse(j)).catch(() => []);
      hist.unshift({ title: title.trim() || content.slice(0, 50), text: content, voice: selectedVoice.label, uri, createdAt: Date.now() });
      await FileSystem.writeAsStringAsync(AUDIO_DIR + "history.json", JSON.stringify(hist.slice(0, 50)));
      setHistoryCount(Math.min(hist.length, 50));
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
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

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TopBar appName="FreeSurf Reader" isLoggedIn={isLoggedIn} onSignIn={() => navigation.navigate("Auth")}
          onSignOut={handleSignOut}
          colors={{ text: colors.text, muted: colors.dim, card: colors.card, border: colors.border }}
          menuItems={[
            { label: "Recordings", onPress: () => navigation.navigate("History", { isDark }) },
          ]}
        />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="always">
        <TextInput style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]} placeholder="Document title" placeholderTextColor={colors.dim}
          value={title} onChangeText={setTitle} />
        <TextInput style={[styles.textInput, { color: colors.text, minHeight: inputHeight, height: inputHeight }]}
          placeholder="Paste an article, study guide, or document text here..."
          placeholderTextColor={colors.dim} value={text} onChangeText={setText}
          multiline scrollEnabled={false} textAlignVertical="top"
          onContentSizeChange={(e) => setInputHeight(Math.max(MIN_INPUT_HEIGHT, e.nativeEvent.contentSize.height + 24))}
        />
      </ScrollView>

      <View style={[styles.readerBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {savedToast && <View style={styles.toast}><Text style={styles.toastText}>✓ Saved to Recordings</Text></View>}

        <View style={styles.barRow}>
          <TouchableOpacity style={styles.barBtn} onPress={handleImport} disabled={isImporting}>
            <FileText size={16} color={colors.dim} />
            <Text style={[styles.barBtnText, { color: colors.dim }]}>{isImporting ? "Importing..." : "Import"}</Text>
          </TouchableOpacity>

          <View style={styles.barRight}>
            {timeEstimate && !isGenerating && !isPlaying ? (
              <Text style={[styles.estimate, { color: colors.dim }]}>{timeEstimate}</Text>
            ) : null}

            <TouchableOpacity style={[styles.playBtn, { backgroundColor: isDark ? "#e8ecff15" : "#1a1a2e10" }]}
              onPress={handleRead}>
              <Text style={[styles.playBtnText, { color: colors.text }, (isPlaying || isGenerating) && styles.playBtnTextActive]}>
                {isGenerating ? `Preparing${timeEstimate ? ` ${timeEstimate}` : ""}` : isPlaying ? "Stop" : "Read Aloud"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.voiceChip, { borderColor: colors.border }]} onPress={() => setShowVoicePicker(true)}>
              <Text style={[styles.voiceChipText, { color: colors.text }]}>{selectedVoice.label}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsDark(!isDark)} style={styles.themeBtn}>
              {isDark ? <Sun size={18} color={colors.text} /> : <Moon size={18} color={colors.text} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={showVoicePicker} transparent animationType="slide" onRequestClose={() => setShowVoicePicker(false)}>
        <TouchableOpacity style={styles.backdrop} onPress={() => setShowVoicePicker(false)} activeOpacity={1}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text, borderBottomColor: colors.border }]}>Choose voice</Text>
            <ScrollView style={{ maxHeight: 420 }} bounces={false}>
              {VOICES.map(v => (
                <TouchableOpacity key={v.id} style={[styles.voiceOption, selectedVoice.id === v.id && styles.voiceSelected, { borderBottomColor: colors.border }]}
                  onPress={() => { setSelectedVoice(v); setShowVoicePicker(false); }}>
                  <Text style={[styles.voiceLabel, { color: colors.text }]}>{selectedVoice.id === v.id ? "● " : "  "}{v.label}</Text>
                  <Text style={[styles.voiceDesc, { color: colors.dim }]}>{v.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 42, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1 },

  body: { flex: 1 },
  bodyContent: { padding: 24, paddingBottom: 24 },

  titleInput: { fontSize: 22, fontWeight: "600", paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1 },
  textInput: { fontSize: 18, lineHeight: 28 },

  readerBar: { borderTopWidth: 1, paddingBottom: 36 },
  toast: { backgroundColor: "#0d6b61", paddingVertical: 8, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  barRow: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 4 },
  barBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  barBtnText: { fontSize: 14, fontWeight: "600" },
  barRight: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  estimate: { fontSize: 12, fontWeight: "600" },
  playBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22 },
  playBtnActive: { backgroundColor: "#5b8cff" },
  playBtnText: { color: "#e8ecff", fontSize: 14, fontWeight: "700" },
  playBtnTextActive: { color: "#fff", fontSize: 14, fontWeight: "700" },
  voiceChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  voiceChipText: { fontSize: 12, fontWeight: "600" },
  themeBtn: { padding: 4, marginLeft: 4 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 56 },
  sheetTitle: { fontSize: 16, fontWeight: "700", padding: 16, borderBottomWidth: 1 },
  voiceOption: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  voiceSelected: { backgroundColor: "#5b8cff15" },
  voiceLabel: { fontSize: 15 },
  voiceDesc: { fontSize: 12, marginTop: 2 },
});
