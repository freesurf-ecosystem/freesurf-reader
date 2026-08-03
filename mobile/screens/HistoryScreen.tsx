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

export default function HistoryScreen({ navigation }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const soundRef = useRef<Audio.Sound | null>(null);

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Recordings</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={recordings}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎧</Text>
            <Text style={styles.emptyTitle}>No recordings yet</Text>
            <Text style={styles.emptySub}>
              Generated audio will appear here automatically
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
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
                    style={styles.renameInput}
                    value={editingTitle}
                    onChangeText={setEditingTitle}
                    onSubmitEditing={saveRename}
                    onBlur={cancelRename}
                    autoFocus
                    selectTextOnFocus
                    placeholder="Recording name"
                    placeholderTextColor="#5f6b7a"
                  />
                ) : (
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                )}
                <Text style={styles.itemMeta}>
                  {item.voice} · {formatDate(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.itemActions}>
              {editingId === item.id ? (
                <TouchableOpacity style={styles.actionBtn} onPress={saveRename}>
                  <Text style={[styles.actionBtnText, { color: "#5b8cff" }]}>Save</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={() => startRename(item)}>
                  <Text style={styles.actionBtnText}>Rename</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => shareRecording(item)}
              >
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
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
  container: { flex: 1, backgroundColor: "#0b1020" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 56,
    backgroundColor: "#111937",
    borderBottomWidth: 1,
    borderBottomColor: "#2a3568",
  },
  back: { color: "#5b8cff", fontSize: 15, fontWeight: "500" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#e8ecff" },

  list: { padding: 16, paddingBottom: 48 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#e8ecff", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#5f6b7a", textAlign: "center" },

  item: {
    backgroundColor: "#111937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2a3568",
  },
  itemMain: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  playIcon: { fontSize: 20, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: "600", color: "#e8ecff" },
  itemMeta: { fontSize: 12, color: "#5f6b7a", marginTop: 2 },
  renameInput: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e8ecff",
    backgroundColor: "#1e2a4a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#5b8cff",
  },

  itemActions: { flexDirection: "row", justifyContent: "flex-end", gap: 4 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1e2a4a",
  },
  actionBtnText: { color: "#b3bddf", fontSize: 13, fontWeight: "500" },
});
