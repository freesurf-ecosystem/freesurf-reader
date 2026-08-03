import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, FlatList,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { textToSpeech, extractPdfText, VOICES, type Voice } from "../lib/tts";
import { supabase } from "../lib/supabase";
import TopBar from "../components/TopBar";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Reader">; isLoggedIn: boolean };

const HISTORY_KEY = "freesurf-reader-history";

interface Recording {
  id: string;
  title: string;
  text: string;
  voice: string;
  uri: string;
  createdAt: number;
}

const VOICE_GROUPS: { label: string; voices: Voice[] }[] = [
  { label: "English (US)", voices: VOICES.filter((v) => v.language === "en-us") },
  { label: "English (UK)", voices: VOICES.filter((v) => v.language === "en-gb") },
  { label: "Spanish", voices: VOICES.filter((v) => v.language === "es") },
  { label: "French", voices: VOICES.filter((v) => v.language === "fr") },
  { label: "Italian", voices: VOICES.filter((v) => v.language === "it") },
  { label: "Portuguese", voices: VOICES.filter((v) => v.language === "pt") },
  { label: "German", voices: VOICES.filter((v) => v.language === "de") },
  { label: "Hindi", voices: VOICES.filter((v) => v.language === "hi") },
  { label: "Polish", voices: VOICES.filter((v) => v.language === "pl") },
];

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

const sanitizeFileName = (value: string) =>
  String(value || "recording")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "recording";

export default function ReaderScreen({ navigation, isLoggedIn }: Props) {
  const [text, setText] = useState("");

  const handleSignOut = async () => { await supabase.auth.signOut(); };
  const [title, setTitle] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICES[0]);
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const soundRef = useRef<Audio.Sound | null>(null);
  const currentUriRef = useRef<string | null>(null);
  const seekingRef = useRef(false);
  const seekTrackWidthRef = useRef(0);
  const positionUpdaterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadHistoryCount();
    return () => {
      if (positionUpdaterRef.current) clearInterval(positionUpdaterRef.current);
    };
  }, []);

  async function loadHistoryCount() {
    try {
      const raw = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + HISTORY_KEY,
        { encoding: FileSystem.EncodingType.Utf8 }
      ).catch(() => "[]");
      const history: Recording[] = JSON.parse(raw);
      setHistoryCount(history.length);
    } catch {}
  }

  async function loadHistory(): Promise<Recording[]> {
    try {
      const raw = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + HISTORY_KEY,
        { encoding: FileSystem.EncodingType.Utf8 }
      ).catch(() => "[]");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async function saveHistory(history: Recording[]) {
    const trimmed = history.slice(0, 50);
    await FileSystem.writeAsStringAsync(
      FileSystem.documentDirectory + HISTORY_KEY,
      JSON.stringify(trimmed),
      { encoding: FileSystem.EncodingType.Utf8 }
    );
    setHistoryCount(trimmed.length);
  }

  function startPositionTracking() {
    if (positionUpdaterRef.current) clearInterval(positionUpdaterRef.current);
    positionUpdaterRef.current = setInterval(async () => {
      if (seekingRef.current || !soundRef.current) return;
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          setPositionMs(Number(status.positionMillis || 0));
          setDurationMs(Number(status.durationMillis || 0));
        }
      } catch {}
    }, 250);
  }

  function stopPositionTracking() {
    if (positionUpdaterRef.current) {
      clearInterval(positionUpdaterRef.current);
      positionUpdaterRef.current = null;
    }
  }

  const stopPlayback = useCallback(async () => {
    stopPositionTracking();
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
    } catch {}
    soundRef.current = null;
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
  }, []);

  async function handleRead() {
    const content = text.trim();
    if (!content) {
      Alert.alert("No text", "Paste or type something to read aloud.");
      return;
    }

    await stopPlayback();
    setIsGenerating(true);

    try {
      const audioBase64 = await textToSpeech(content, selectedVoice.voice, speed);

      const fileName = `reader-${Date.now()}.wav`;
      const uri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      currentUriRef.current = uri;

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      seekingRef.current = false;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPositionMs(0);
            setDurationMs(Number(status.durationMillis || 0));
            stopPositionTracking();
            sound.unloadAsync().catch(() => {});
          }
        }
      );

      soundRef.current = sound;
      setIsGenerating(false);
      setIsPlaying(true);

      const initialStatus = await sound.getStatusAsync();
      if (initialStatus.isLoaded) {
        setDurationMs(Number(initialStatus.durationMillis || 0));
        setPositionMs(0);
      }
      startPositionTracking();

      await saveToHistory({
        id: Date.now().toString(),
        title: title.trim() || content.slice(0, 50),
        text: content,
        voice: selectedVoice.label,
        uri,
        createdAt: Date.now(),
      });
    } catch (e: any) {
      setIsGenerating(false);
      Alert.alert("Error", e.message || "Failed to generate audio.");
    }
  }

  async function handleStop() {
    await stopPlayback();
  }

  async function handleSeek(locationX: number) {
    if (!soundRef.current || !durationMs) return;
    const ratio = Math.max(0, Math.min(1, locationX / seekTrackWidthRef.current));
    const ms = Math.round(durationMs * ratio);
    seekingRef.current = true;
    try {
      await soundRef.current.setPositionAsync(ms);
      setPositionMs(ms);
    } catch {}
    seekingRef.current = false;
  }

  async function handleJump(ms: number) {
    if (!soundRef.current) return;
    const newPos = Math.max(0, Math.min(durationMs, positionMs + ms));
    seekingRef.current = true;
    try {
      await soundRef.current.setPositionAsync(newPos);
      setPositionMs(newPos);
    } catch {}
    seekingRef.current = false;
  }

  async function handleImport() {
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        setIsImporting(false);
        return;
      }

      const file = result.assets[0];
      setTitle(file.name);

      if (file.name?.endsWith(".txt") || file.mimeType === "text/plain") {
        const content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Utf8,
        });
        setText(content);
      } else {
        // PDF — send to worker for text extraction
        const pdfBase64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const extractedText = await extractPdfText(pdfBase64);
        setText(extractedText);
      }
    } catch (e: any) {
      if (e.message?.includes("extraction failed") || e.message?.includes("PDF")) {
        Alert.alert(
          "PDF Import",
          "PDF text extraction requires the worker to be deployed with PDF support. For now, import a .txt file instead.",
          [{ text: "OK" }]
        );
      } else if (!String(e).includes("canceled")) {
        Alert.alert("Import failed", e.message || "Could not import file.");
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function handleRenameStart(recordingId: string, currentTitle: string) {
    setEditingId(recordingId);
    setEditingTitle(currentTitle);
  }

  async function handleRenameSave() {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null);
      setEditingTitle("");
      return;
    }

    const history = await loadHistory();
    const entry = history.find((r) => r.id === editingId);
    if (!entry) {
      setEditingId(null);
      setEditingTitle("");
      return;
    }

    const newTitle = editingTitle.trim();
    const oldStem = sanitizeFileName(entry.title);
    const newStem = sanitizeFileName(newTitle);
    const oldUri = entry.uri;

    if (oldStem !== newStem && oldUri) {
      const dir = oldUri.substring(0, oldUri.lastIndexOf("/") + 1);
      const newUri = `${dir}${newStem}-${Date.now()}.wav`;
      try {
        const info = await FileSystem.getInfoAsync(oldUri);
        if (info.exists) {
          await FileSystem.moveAsync({ from: oldUri, to: newUri });
        }
        entry.uri = newUri;
      } catch {}
    }

    entry.title = newTitle;
    const updated = history.map((r) => (r.id === editingId ? entry : r));
    await saveHistory(updated);

    if (currentUriRef.current === oldUri) {
      currentUriRef.current = entry.uri;
    }

    setEditingId(null);
    setEditingTitle("");
  }

  async function handleShare(uri: string) {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: "audio/wav" });
    }
  }

  async function saveToHistory(recording: Recording) {
    const history = await loadHistory();
    history.unshift(recording);
    await saveHistory(history);
  }

  const progressRatio = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  // Estimated time
  const estSeconds = Math.ceil((text.trim().length || 0) * 3 / 1000) + 30;
  const estMins = Math.floor(estSeconds / 60);
  const estSecs = estSeconds % 60;
  const timeEstimate = text.trim()
    ? `~${estMins > 0 ? `${estMins}m ` : ""}${estSecs}s`
    : "";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TopBar
          appName="FreeSurf Reader"
          isLoggedIn={isLoggedIn}
          onSignIn={() => navigation.navigate("Auth")}
          onSignOut={handleSignOut}
          menuItems={[{ label: `Saved ${historyCount > 0 ? `(${historyCount})` : ""}`, onPress: () => navigation.navigate("History") }]}
        />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <TextInput
          style={styles.titleInput}
          placeholder="Title (optional)"
          placeholderTextColor="#5f6b7a"
          value={title}
          onChangeText={setTitle}
        />

        {/* Text area */}
        <TextInput
          style={styles.textInput}
          placeholder="Paste or type text to read aloud..."
          placeholderTextColor="#5f6b7a"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />

        {/* Controls row */}
        <View style={styles.controls}>
          {/* Voice picker */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setShowVoicePicker(true)}
          >
            <Text style={styles.controlLabel}>🎙 {selectedVoice.label}</Text>
          </TouchableOpacity>

          {/* Speed */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => {
              const speeds = [0.75, 1.0, 1.25, 1.5];
              const idx = speeds.indexOf(speed);
              setSpeed(speeds[(idx + 1) % speeds.length]);
            }}
          >
            <Text style={styles.controlLabel}>⚡ {speed}x</Text>
          </TouchableOpacity>

          {/* Import */}
          <TouchableOpacity style={styles.controlBtn} onPress={handleImport} disabled={isImporting}>
            {isImporting ? (
              <ActivityIndicator color="#b3bddf" size="small" />
            ) : (
              <Text style={styles.controlLabel}>📄 Import</Text>
            )}
          </TouchableOpacity>

          {/* Time estimate */}
          {timeEstimate ? (
            <Text style={styles.estimate}>{timeEstimate}</Text>
          ) : null}
        </View>

        {/* Playback progress (shown when playing) */}
        {isPlaying && durationMs > 0 ? (
          <View style={styles.progressSection}>
            <TouchableOpacity
              style={styles.seekTrack}
              activeOpacity={0.9}
              onLayout={(e) => { seekTrackWidthRef.current = e.nativeEvent.layout.width; }}
              onPress={(e) => handleSeek(e.nativeEvent.locationX)}
            >
              <View
                style={[styles.seekFill, { width: `${progressRatio * 100}%` as any }]}
              />
            </TouchableOpacity>

            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
              <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
            </View>

            <View style={styles.jumpRow}>
              <TouchableOpacity style={styles.jumpBtn} onPress={() => handleJump(-15000)}>
                <Text style={styles.jumpText}>-15s</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.jumpBtn} onPress={() => setPositionMs(0).then(() => handleSeek(0))}>
                <Text style={styles.jumpText}>Restart</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.jumpBtn} onPress={() => handleJump(15000)}>
                <Text style={styles.jumpText}>+15s</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Play/Stop button */}
      <View style={styles.bottomBar}>
        {(isGenerating || isPlaying) ? (
          <TouchableOpacity
            style={[styles.playBtn, styles.stopBtn]}
            onPress={handleStop}
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
            ) : null}
            <Text style={styles.playBtnText}>
              {isGenerating ? "Generating..." : "Stop"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.playBtn, !text.trim() && styles.playBtnDisabled]}
            onPress={handleRead}
            disabled={!text.trim() || isImporting}
          >
            <Text style={styles.playBtnText}>Read Aloud</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Voice picker modal */}
      <Modal
        visible={showVoicePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowVoicePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a voice</Text>
              <TouchableOpacity onPress={() => setShowVoicePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={VOICE_GROUPS}
              keyExtractor={(g) => g.label}
              renderItem={({ item: group }) => (
                <View style={styles.voiceGroup}>
                  <Text style={styles.voiceGroupLabel}>{group.label}</Text>
                  {group.voices.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.voiceItem,
                        selectedVoice.id === v.id && styles.voiceItemActive,
                      ]}
                      onPress={() => {
                        setSelectedVoice(v);
                        setShowVoicePicker(false);
                      }}
                    >
                      <Text style={styles.voiceItemLabel}>
                        {selectedVoice.id === v.id ? "● " : "  "}{v.label}
                      </Text>
                      <Text style={styles.voiceItemDesc}>{v.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1020" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 56,
    backgroundColor: "#111937",
    borderBottomWidth: 1,
    borderBottomColor: "#2a3568",
    gap: 12,
  },
  brand: { fontSize: 13, fontWeight: "600", color: "#5b8cff" },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#e8ecff",
  },
  historyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1e2a4a",
  },
  historyBtnText: { color: "#b3bddf", fontSize: 13, fontWeight: "500" },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 100 },

  titleInput: {
    fontSize: 20,
    fontWeight: "600",
    color: "#e8ecff",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3568",
  },
  textInput: {
    flex: 1,
    minHeight: 250,
    fontSize: 16,
    lineHeight: 24,
    color: "#e8ecff",
    backgroundColor: "#111937",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a3568",
  },

  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 20,
    gap: 10,
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111937",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a3568",
  },
  controlLabel: { color: "#e8ecff", fontSize: 14, fontWeight: "500" },
  estimate: {
    color: "#5f6b7a",
    fontSize: 13,
    marginLeft: "auto",
  },

  // Progress section
  progressSection: {
    marginTop: 20,
    backgroundColor: "#111937",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a3568",
    gap: 10,
  },
  seekTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#1e2a4a",
    overflow: "hidden",
    justifyContent: "center",
  },
  seekFill: {
    height: "100%",
    backgroundColor: "#5b8cff",
    borderRadius: 999,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    color: "#5f6b7a",
    fontSize: 12,
    fontWeight: "600",
  },
  jumpRow: {
    flexDirection: "row",
    gap: 8,
  },
  jumpBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1e2a4a",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a3568",
  },
  jumpText: {
    color: "#b3bddf",
    fontSize: 13,
    fontWeight: "600",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 36,
    backgroundColor: "#111937",
    borderTopWidth: 1,
    borderTopColor: "#2a3568",
  },
  playBtn: {
    backgroundColor: "#5b8cff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  playBtnDisabled: { opacity: 0.4 },
  stopBtn: { backgroundColor: "#ef4444" },
  playBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  // Voice picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#111937",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3568",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#e8ecff" },
  modalClose: { fontSize: 20, color: "#b3bddf", padding: 4 },
  voiceGroup: { paddingHorizontal: 20, marginTop: 16 },
  voiceGroupLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5b8cff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  voiceItem: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#0b1433",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  voiceItemActive: { borderColor: "#5b8cff", backgroundColor: "#151f44" },
  voiceItemLabel: { fontSize: 15, fontWeight: "600", color: "#e8ecff" },
  voiceItemDesc: { fontSize: 12, color: "#5f6b7a", marginTop: 2 },
});
