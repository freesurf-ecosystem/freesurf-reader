import React, { useCallback, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import TopBar from "../components/TopBar";
import { Play, Pause, Share2, X, Download } from "lucide-react-native";

const HISTORY_PATH = FileSystem.documentDirectory + "reader-audio/history.json";

interface Recording { id: string; title: string; text: string; voice: string; uri: string; createdAt: number; }

type Props = NativeStackScreenProps<RootStackParamList, "History">;

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatTime(ms: number) {
  if (!ms) return "0:00";
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export default function HistoryScreen({ navigation, route }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const isDark = route.params?.isDark ?? true;
  const colors = isDark
    ? { bg: "#0b1020", card: "#111937", text: "#e8ecff", muted: "#5f6b7a", border: "#2a3568", accent: "#5b8cff" }
    : { bg: "#f8f9fa", card: "#ffffff", text: "#1a1a2e", muted: "#6b7280", border: "#e5e7eb", accent: "#2563eb" };

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const soundRef = useRef<Audio.Sound | null>(null);
  const progRef = useRef(0);

  useFocusEffect(useCallback(() => { loadHistory(); return () => { soundRef.current?.unloadAsync().catch(() => {}); }; }, []));

  async function loadHistory() {
    try {
      const raw = await FileSystem.readAsStringAsync(HISTORY_PATH, { encoding: FileSystem.EncodingType.Utf8 }).catch(() => "[]");
      setRecordings(JSON.parse(raw));
    } catch {}
  }

  async function persistHistory(u: Recording[]) {
    await FileSystem.writeAsStringAsync(HISTORY_PATH, JSON.stringify(u));
    setRecordings(u);
  }

  async function togglePlay(item: Recording) {
    if (playingId === item.id) {
      await soundRef.current?.stopAsync(); await soundRef.current?.unloadAsync();
      soundRef.current = null; setPlayingId(null); setPositionMs(0); return;
    }
    await soundRef.current?.stopAsync().catch(() => {});
    await soundRef.current?.unloadAsync().catch(() => {});
    const { sound } = await Audio.Sound.createAsync({ uri: item.uri }, { shouldPlay: true }, (s) => {
      if (s.isLoaded) { setPositionMs(s.positionMillis); setDurationMs(s.durationMillis); if (s.didJustFinish) { setPlayingId(null); setPositionMs(0); } }
    });
    soundRef.current = sound; setPlayingId(item.id);
    (async () => { const st = await sound.getStatusAsync(); if (st.isLoaded) setDurationMs(st.durationMillis); })();
  }

  async function seek(item: Recording, locX: number) {
    if (playingId !== item.id || !durationMs) return;
    const ratio = Math.max(0, Math.min(1, locX / progRef.current));
    await soundRef.current?.setPositionAsync(ratio * durationMs);
    setPositionMs(ratio * durationMs);
  }

  async function jump(item: Recording, ms: number) {
    if (playingId !== item.id) return;
    const np = Math.max(0, Math.min(durationMs, positionMs + ms));
    await soundRef.current?.setPositionAsync(np);
    setPositionMs(np);
  }

  async function startRename(item: Recording) { setEditingId(item.id); setEditingTitle(item.title); }
  function cancelRename() { setEditingId(null); setEditingTitle(""); }

  async function saveRename() {
    const id = editingId; if (!id || !editingTitle.trim()) { cancelRename(); return; }
    const u = recordings.map(r => r.id === id ? { ...r, title: editingTitle.trim() } : r);
    await persistHistory(u); cancelRename();
  }

  async function shareItem(item: Recording) {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(item.uri);
  }

  async function deleteItem(item: Recording) {
    Alert.alert("Delete", `Delete "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          await persistHistory(recordings.filter(r => r.id !== item.id));
          if (playingId === item.id) { await soundRef.current?.unloadAsync(); setPlayingId(null); }
      }},
    ]);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TopBar appName="Recordings" isLoggedIn={false} onSignIn={() => {}} onSignOut={() => {}}
          colors={{ text: colors.text, muted: colors.muted, card: colors.card, border: colors.border }}
          menuItems={[{ label: "Dashboard", onPress: () => navigation.goBack() }]}
        />
      </View>

      <FlatList
        data={recordings}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No recordings yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>Generated audio will appear here</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = playingId === item.id;
          const isEditing = editingId === item.id;
          const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

          return (
            <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.playBtn, { borderColor: colors.border, backgroundColor: isActive ? colors.text : colors.bg }]}
                  onPress={() => togglePlay(item)}>
                  {isActive ? <Pause size={18} color={isActive ? colors.bg : colors.text} /> : <Play size={18} color={colors.text} />}
                </TouchableOpacity>

                <View style={styles.info}>
                  {isEditing ? (
                    <TextInput style={[styles.renameInput, { color: colors.text, borderColor: colors.accent, backgroundColor: colors.bg }]}
                      value={editingTitle} onChangeText={setEditingTitle} onSubmitEditing={saveRename} onBlur={cancelRename} autoFocus selectTextOnFocus />
                  ) : (
                    <>
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.meta, { color: colors.muted }]}>{item.voice} · {formatDate(item.createdAt)}</Text>
                    </>
                  )}
                </View>
              </View>

              {isActive && (
                <>
                  <View style={styles.progressRow}>
                    <Text style={[styles.timeTxt, { color: colors.muted }]}>{formatTime(positionMs)}</Text>
                    <TouchableOpacity style={[styles.progTrack, { backgroundColor: colors.bg }]}
                      onPress={(e) => seek(item, e.nativeEvent.locationX)}
                      onLayout={(e) => { progRef.current = e.nativeEvent.layout.width; }} activeOpacity={1}>
                      <View style={[styles.progFill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
                    </TouchableOpacity>
                    <Text style={[styles.timeTxt, { color: colors.muted }]}>{formatTime(durationMs)}</Text>
                  </View>
                  <View style={styles.controlsRow}>
                    <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={() => jump(item, -15000)}>
                      <Text style={[styles.ctrlText, { color: colors.text }]}>-15s</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={() => { setPositionMs(0); soundRef.current?.setPositionAsync(0); }}>
                      <Text style={[styles.ctrlText, { color: colors.text }]}>Restart</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={() => jump(item, 15000)}>
                      <Text style={[styles.ctrlText, { color: colors.text }]}>+15s</Text></TouchableOpacity>
                  </View>
                </>
              )}

              <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                {isEditing ? (
                  <>
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={saveRename}>
                      <Text style={[styles.actionText, { color: colors.text }]}>Save</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={cancelRename}>
                      <Text style={[styles.actionText, { color: colors.text }]}>Cancel</Text></TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={() => startRename(item)}>
                    <Text style={[styles.actionText, { color: colors.text }]}>Rename</Text></TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={() => shareItem(item)}>
                  <Share2 size={16} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.delBtn, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={() => deleteItem(item)}>
                  <X size={18} color="#f87171" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1 },
  list: { padding: 16, paddingBottom: 48 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: "center" },

  card: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  playBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  renameInput: { fontSize: 14, fontWeight: "600", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  meta: { fontSize: 12 },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 10 },
  timeTxt: { fontSize: 11, fontVariant: ["tabular-nums"], minWidth: 36 },
  progTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progFill: { height: "100%", borderRadius: 3 },
  controlsRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 4 },
  ctrlBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  ctrlText: { fontSize: 13, fontWeight: "500" },

  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  actionText: { fontSize: 13, fontWeight: "500" },
  delBtn: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
