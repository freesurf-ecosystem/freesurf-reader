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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../App";
import { textToSpeech, VOICES, type Voice } from "../lib/tts";
import FloatingHamburger from "../components/FloatingHamburger";
import { FileText, Mic, Home, Play, Pause } from "lucide-react-native";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Reader">; noteId?: string; isDark?: boolean; onToggleTheme?: () => void; };

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

export default function ReaderScreen({ navigation, noteId, isDark, onToggleTheme }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [editingId, setEditingId] = useState<string | null>(null);
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

  // Attached-audio player (the "Recordings" playback engine, now inline in the editor)
  const [noteUris, setNoteUris] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [chunkDurs, setChunkDurs] = useState<number[]>([]);
  const soundRef = useRef<Audio.Sound | null>(null);
  const nextSoundRef = useRef<Audio.Sound | null>(null);
  const progW = useRef(0);
  const totalDur = chunkDurs.reduce((s, d) => s + d, 0);
  const cumulative = chunkDurs.reduce<number[]>((a, d, i) => { a.push((a[i - 1] || 0) + d); return a; }, []);

  // Preload chunk durations so the seek bar + total time are available.
  useEffect(() => {
    if (!noteUris.length) return;
    (async () => {
      const d: number[] = [];
      for (const u of noteUris) {
        try {
          const { sound: snd } = await Audio.Sound.createAsync({ uri: u }, { shouldPlay: false });
          const st = await snd.getStatusAsync();
          d.push(st.isLoaded ? (st.durationMillis || 0) : 0);
          snd.unloadAsync().catch(() => {});
        } catch { d.push(0); }
      }
      setChunkDurs(d);
    })();
  }, [noteUris]);

  // Stop audio if the screen unmounts.
  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); nextSoundRef.current?.unloadAsync().catch(() => {}); }, []);

  useEffect(() => {
    ensureDir().then(() => {
      FileSystem.readAsStringAsync(HISTORY_PATH).then(j =>
        setHistoryCount(JSON.parse(j).length)
      ).catch(() => {});
    });
  }, []);

  // If opened with a noteId, load that note (title/text) and re-attach its audio.
  useEffect(() => {
    if (!noteId) return;
    ensureDir().then(() => {
      FileSystem.readAsStringAsync(HISTORY_PATH).then(j => {
        const arr = JSON.parse(j) || [];
        const it = arr.find((r: any) => r.id === noteId);
        if (it) {
          setEditingId(it.id);
          setTitle(it.title || "");
          setText(it.text || "");
          const us = (it.uris && it.uris.length ? it.uris : [it.uri]).filter(Boolean);
          if (us.length) setNoteUris(us);
          setHistoryCount(arr.length);
        }
      }).catch(() => {});
    }).catch(() => {});
  }, [noteId]);

  // Auto-save the TITLE for an existing note (debounced) so the dashboard stays in sync,
  // even if the user hasn't re-recorded yet. The note text only updates on a new recording.
  useEffect(() => {
    if (!editingId) return;
    const timer = setTimeout(async () => {
      try {
        const hist = await FileSystem.readAsStringAsync(HISTORY_PATH).then(j => JSON.parse(j)).catch(() => []);
        const i = hist.findIndex((r: any) => r.id === editingId);
        if (i >= 0) {
          hist[i].title = title.trim() || "Untitled";
          await safeWriteHistory(hist.slice(0, 50));
          setHistoryCount(Math.min(hist.length, 50));
        }
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [title, editingId]);

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

      // Generate ALL chunks first (audio attaches to this note in the editor, no separate screen).
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 2000));
        try {
          const b64 = await textToSpeech(chunks[i], selectedVoice.voice);
          const uri = AUDIO_DIR + `reader-${batchId}-${i}.wav`;
          await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
          uris.push(uri);
        } catch {
          try {
            await new Promise(r => setTimeout(r, 5000));
            const b64 = await textToSpeech(chunks[i], selectedVoice.voice);
            const uri = AUDIO_DIR + `reader-${batchId}-${i}.wav`;
            await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
            uris.push(uri);
          } catch {}
        }
      }

      // Save the note + its audio as one package (update the open note, or add a new one).
      const savedAt = Date.now();
      const savedId = editingId || `${savedAt}`;
      let hist = await FileSystem.readAsStringAsync(HISTORY_PATH).then(j => JSON.parse(j)).catch(() => []);
      if (editingId) {
        const idx = hist.findIndex((r: any) => r.id === editingId);
        const rec = { id: editingId, title: title.trim() || content.slice(0, 50), text: content, voice: selectedVoice.label, uri: uris[0], uris, processing: false, createdAt: (idx >= 0 ? hist[idx].createdAt : null) || savedAt };
        if (idx >= 0) hist[idx] = rec; else hist.unshift(rec);
      } else {
        hist.unshift({ id: savedId, title: title.trim() || content.slice(0, 50), text: content, voice: selectedVoice.label, uri: uris[0], uris, processing: false, createdAt: savedAt });
      }
      await safeWriteHistory(hist.slice(0, 50));
      setHistoryCount(Math.min(hist.length, 50));
      setEditingId(savedId);
      setIsGenerating(false);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);

      // Attach the audio to the editor's reader bar and start playing.
      setNoteUris(uris);
      setPos(0); setDur(0); setChunkIndex(0);
      setIsPlaying(true);
      await playFrom(uris, 0, 0);
    } catch (e: any) {
      setIsGenerating(false);
      Alert.alert("Error", e.message || "Failed to generate audio.");
    }
  }

  // ---- Attached-audio playback (chunked, seekable) ----
  async function playFrom(uris: string[], ci: number, at: number) {
    if (!uris.length || ci >= uris.length) return;
    await soundRef.current?.stopAsync().catch(() => {});
    await soundRef.current?.unloadAsync().catch(() => {});
    await nextSoundRef.current?.unloadAsync().catch(() => {});
    const playChunk = (idx: number, startAt: number) => {
      if (idx >= uris.length) { setIsPlaying(false); setChunkIndex(0); setPos(0); return; }
      setChunkIndex(idx);
      if (idx + 1 < uris.length) {
        nextSoundRef.current?.unloadAsync().catch(() => {});
        Audio.Sound.createAsync({ uri: uris[idx + 1] }, { shouldPlay: false }).then(({ sound: nx }) => { nextSoundRef.current = nx; }).catch(() => {});
      }
      Audio.Sound.createAsync({ uri: uris[idx] }, { shouldPlay: true, positionMillis: startAt }, (st: any) => {
        if (st.isLoaded) {
          setPos(st.positionMillis); setDur(st.durationMillis || 0);
          if (st.didJustFinish) {
            soundRef.current?.unloadAsync().catch(() => {});
            if (nextSoundRef.current) { soundRef.current = nextSoundRef.current; nextSoundRef.current = null; soundRef.current!.playAsync(); playChunk(idx + 1, 0); }
            else playChunk(idx + 1, 0);
          }
        }
      }).then(({ sound }) => { soundRef.current = sound; }).catch(() => {});
    };
    setIsPlaying(true);
    playChunk(ci, at);
  }

  async function toggleAttached() {
    if (isPlaying) {
      await soundRef.current?.stopAsync().catch(() => {});
      await soundRef.current?.unloadAsync().catch(() => {});
      await nextSoundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null; nextSoundRef.current = null;
      setIsPlaying(false); setPos(0); setChunkIndex(0);
      return;
    }
    if (!noteUris.length) return;
    setIsPlaying(true);
    await playFrom(noteUris, chunkIndex, pos);
  }

  async function seekTo(ms: number) {
    if (!totalDur || !noteUris.length) return;
    let ci = 0, off = 0;
    for (let j = 0; j < cumulative.length; j++) {
      if (ms < cumulative[j]) { ci = j; off = j > 0 ? cumulative[j - 1] : 0; break; }
    }
    setPos(ms);
    await playFrom(noteUris, ci, ms - off);
  }

  function timeLabel(): string {
    if (!dur && !totalDur) return "0:00";
    const cur = (chunkIndex > 0 ? cumulative[chunkIndex - 1] || 0 : 0) + pos;
    const total = totalDur || dur;
    const f = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
    return `${f(cur)} / ${f(total)}`;
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
      const content = await FileSystem.readAsStringAsync(f.uri, { encoding: FileSystem.EncodingType.UTF8 });
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
      {/* Unified nav bar: safe-area top, home (dashboard) left, hamburger right */}
      <View style={{ backgroundColor: theme.colors.background }}>
        <View style={{ paddingTop: insets.top }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: theme.colors.outline }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("History", { isDark })}
              style={{ padding: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Dashboard"
            >
              <Home size={22} color={theme.colors.onSurface} />
            </TouchableOpacity>
            <FloatingHamburger
              inline
              topOffset={insets.top + 48}
              colors={hbColors}
              footer={themeToggleFooter}
              menuItems={[
                { label: "Dashboard", onPress: () => navigation.navigate("History", { isDark }) },
                { label: "Support", onPress: () => Linking.openURL("https://freesurf.tools/support") },
                { label: "Privacy", onPress: () => Linking.openURL("https://freesurf.tools/privacy") },
                { label: "Terms", onPress: () => Linking.openURL("https://freesurf.tools/terms") },
                { label: "About Us", onPress: () => Alert.alert("About FreeSurf Reader", "FreeSurf Reader transforms text into natural-sounding speech. Just paste or import a document and choose from 23 languages.\n\nMore free apps are on the way — stay tuned for calorie tracking, transcription, and more.") },
              ]}
            />
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingTop: 4, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" decelerationRate={0.998}>
        <PaperInput mode="flat" style={{ fontSize: 20, fontWeight: "600", backgroundColor: "transparent", marginBottom: 8 }}
          placeholder="Document title" value={title} onChangeText={setTitle}
          underlineColor={theme.colors.outline} activeUnderlineColor={theme.colors.primary}
          cursorColor={theme.colors.primary} selectionColor={theme.colors.primary} />

        <PaperInput mode="flat"
          style={{ minHeight: inputHeight, fontSize: 17, lineHeight: 26, backgroundColor: "transparent", marginTop: 8 }}
          placeholder="Paste an article, study guide, or document text here..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={text} onChangeText={setText}
          multiline textAlignVertical="top" scrollEnabled={false}
          underlineColor="transparent" activeUnderlineColor="transparent"
          cursorColor={theme.colors.primary} selectionColor={theme.colors.primary}
          theme={{ colors: { primary: theme.colors.primary, text: theme.colors.onSurface } }}
        />
      </ScrollView>

      <Surface style={{ borderTopWidth: 1, borderTopColor: theme.colors.outline, paddingBottom: 32 }} elevation={0}>
        {savedToast && (
          <View style={{ paddingVertical: 6, alignItems: "center" }}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Saved to Recordings</Text>
          </View>
        )}
        {noteUris.length > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.outline, paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity onPress={toggleAttached}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }}>
                {isPlaying ? <Pause size={18} color={theme.colors.onSurface} /> : <Play size={18} color={theme.colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, height: 26, justifyContent: "center" }}
                activeOpacity={0.8}
                onLayout={(e) => { progW.current = e.nativeEvent.layout.width; }}
                onPress={(e) => { if (!progW.current || !totalDur) return; const r = Math.max(0, Math.min(1, e.nativeEvent.locationX / progW.current)); seekTo(r * totalDur); }}
              >
                <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.outline, overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${(totalDur > 0 ? Math.min(1, ((chunkIndex > 0 ? cumulative[chunkIndex - 1] || 0 : 0) + pos) / totalDur) : 0) * 100}%`, backgroundColor: theme.colors.primary }} />
                </View>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, minWidth: 64, textAlign: "right" }}>{timeLabel()}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 6 }}>
              {[["-15s", -15000], ["Restart", null], ["+15s", 15000]].map(([label, delta]) => (
                <TouchableOpacity key={label as string} onPress={() => {
                  const cur = (chunkIndex > 0 ? cumulative[chunkIndex - 1] || 0 : 0) + pos;
                  if (delta == null) { setPos(0); soundRef.current?.setPositionAsync(0).catch(() => {}); }
                  else seekTo(Math.max(0, Math.min(totalDur, cur + (delta as number))));
                }} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.outline }}>
                  <Text style={{ color: theme.colors.onSurface, fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
            <Text variant="titleMedium" style={{ fontWeight: "700", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.outline }}>Choose language</Text>
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
