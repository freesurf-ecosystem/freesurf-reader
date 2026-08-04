import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  Alert,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";

const HISTORY_PATH = FileSystem.documentDirectory + "reader-audio/history.json";

interface Recording {
  id: string;
  title: string;
  text: string;
  voice: string;
  uri: string;
  createdAt: number;
}

type Props = NativeStackScreenProps<RootStackParamList, "History">;

const sanitizeFileName = (value: string) =>
  String(value || "recording")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "recording";

export default function HistoryScreen({ navigation, route }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const soundRef = useRef<Audio.Sound | null>(null);
  const isDark = route.params?.isDark ?? true;

  const colors = isDark
    ? { bg: "#0b1020", card: "#111937", text: "#e8ecff", muted: "#5f6b7a", border: "#2a3568", accent: "#5b8cff" }
    : { bg: "#f8f9fa", card: "#ffffff", text: "#1a1a2e", muted: "#6b7280", border: "#e5e7eb", accent: "#2563eb" };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      return () => {
        soundRef.current?.unloadAsync().catch(() => {});
        soundRef.current = null;
      };
    }, [])
  );

  async function loadHistory() {
    try {
      const raw = await FileSystem.readAsStringAsync(
        HISTORY_PATH,
        { encoding: FileSystem.EncodingType.Utf8 }
      ).catch(() => "[]");
      setRecordings(JSON.parse(raw));
    } catch {}
  }

  async function persistHistory(updated: Recording[]) {
    await FileSystem.writeAsStringAsync(
      HISTORY_PATH,
      JSON.stringify(updated),
      { encoding: FileSystem.EncodingType.Utf8 }
    );
    setRecordings(updated);
  }

  async function togglePlayback(recording: Recording) {
    if (playingId === recording.id) {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlayingId(null);
      return;
    }

    await soundRef.current?.stopAsync();
    await soundRef.current?.unloadAsync();

    const info = await FileSystem.getInfoAsync(recording.uri);
    if (!info.exists) {
      const updated = recordings.filter((r) => r.id !== recording.id);
      await persistHistory(updated);
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: recording.uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingId(null);
          }
        }
      );

      soundRef.current = sound;
      setPlayingId(recording.id);
    } catch {
      setPlayingId(null);
    }
  }

  async function deleteRecording(recording: Recording) {
    await FileSystem.deleteAsync(recording.uri, { idempotent: true }).catch(() => {});
    const updated = recordings.filter((r) => r.id !== recording.id);
    await persistHistory(updated);
  }

  async function shareRecording(recording: Recording) {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(recording.uri, {
        mimeType: "audio/mpeg",
        dialogTitle: recording.title,
      });
    }
  }

  async function startRename(recording: Recording) {
    setEditingId(recording.id);
    setEditingTitle(recording.title);
  }

  async function saveRename() {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null);
      setEditingTitle("");
      return;
    }

    const entry = recordings.find((r) => r.id === editingId);
    if (!entry) {
      setEditingId(null);
      setEditingTitle("");
      return;
    }

    const newTitle = editingTitle.trim();
    const oldStem = sanitizeFileName(entry.title);
    const newStem = sanitizeFileName(newTitle);
    let newUri = entry.uri;

    if (oldStem !== newStem && entry.uri) {
      const dir = entry.uri.substring(0, entry.uri.lastIndexOf("/") + 1);
      newUri = `${dir}${newStem}-${Date.now()}.mp3`;
      try {
        const info = await FileSystem.getInfoAsync(entry.uri);
        if (info.exists) {
          await FileSystem.moveAsync({ from: entry.uri, to: newUri });
        }
      } catch {}
    }

    const updated = recordings.map((r) =>
      r.id === editingId ? { ...r, title: newTitle, uri: newUri } : r
    );
    await persistHistory(updated);

    setEditingId(null);
    setEditingTitle("");
  }

  function cancelRename() {
    setEditingId(null);
    setEditingTitle("");
  }

  function formatDate(ts: number) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Recordings</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={recordings}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎧</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No recordings yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              Generated audio will appear here automatically
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.itemMain}
              onPress={() => togglePlayback(item)}
            >
              <Text style={styles.playIcon}>
                {playingId === item.id ? "⏸" : "▶️"}
              </Text>
              <View style={styles.itemInfo}>
                {editingId === item.id ? (
                  <TextInput
                    style={[styles.renameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                    value={editingTitle}
                    onChangeText={setEditingTitle}
                    onSubmitEditing={saveRename}
                    onBlur={cancelRename}
                    autoFocus
                    selectTextOnFocus
                    placeholder="Recording name"
                    placeholderTextColor={colors.muted}
                  />
                ) : (
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                )}
                <Text style={[styles.itemMeta, { color: colors.muted }]}>
                  {item.voice} · {formatDate(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.itemActions}>
              {editingId === item.id ? (
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={saveRename}>
                  <Text style={[styles.actionBtnText, { color: colors.accent }]}>Save</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => startRename(item)}>
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>Rename</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.border }]}
                onPress={() => shareRecording(item)}
              >
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.border }]}
                onPress={() => {
                  Alert.alert(
                    "Delete recording",
                    `Delete "${item.title}"?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => deleteRecording(item),
                      },
                    ]
                  );
                }}
              >
                <Text style={[styles.actionBtnText, { color: "#f87171" }]}>Del</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, paddingTop: 56, borderBottomWidth: 1,
  },
  back: { fontSize: 15, fontWeight: "500" },
  headerTitle: { fontSize: 16, fontWeight: "700" },

  list: { padding: 16, paddingBottom: 48 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: "center" },

  item: { borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1 },
  itemMain: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  playIcon: { fontSize: 20, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: "600" },
  itemMeta: { fontSize: 12, marginTop: 2 },
  renameInput: {
    fontSize: 15, fontWeight: "600", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
  },

  itemActions: { flexDirection: "row", justifyContent: "flex-end", gap: 4 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  actionBtnText: { fontSize: 13, fontWeight: "500" },
});
