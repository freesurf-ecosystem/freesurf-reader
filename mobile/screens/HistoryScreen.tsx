import React, { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import FloatingHamburger from "../components/FloatingHamburger";
import { Play, Pause, Share2, X, EllipsisVertical } from "lucide-react-native";

const HISTORY_PATH = FileSystem.documentDirectory + "reader-audio/history.json";

interface Recording { id: string; title: string; text: string; voice: string; uri: string; uris?: string[]; createdAt: number; }

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
  const insets = useSafeAreaInsets();
  const topPad = insets.top + 12;
  const isDark = route.params?.isDark ?? true;
  const c = isDark
    ? { bg: "#000000", card: "#0d0d0d", text: "#e8ecff", dim: "#8899bb", border: "#1a1a1a", accent: "#5b8cff" }
    : { bg: "#f8f9fa", card: "#ffffff", text: "#111827", dim: "#6b7280", border: "#e5e7eb", accent: "#2563eb" };

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [chunkDurs, setChunkDurs] = useState<number[]>([]);
  const totalDur = chunkDurs.reduce((s, d) => s + d, 0);
  const cumulative = chunkDurs.reduce<number[]>((a, d, i) => { a.push((a[i - 1] || 0) + d); return a; }, []);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const progW = useRef(0);

  useFocusEffect(useCallback(() => { loadHistory(); return () => { soundRef.current?.unloadAsync().catch(() => {}); }; }, []));

  async function loadHistory() {
    try {
      const raw = await FileSystem.readAsStringAsync(HISTORY_PATH, { encoding: FileSystem.EncodingType.Utf8 }).catch(() => "[]");
      try { const r = JSON.parse(raw); setRecordings(r); } catch { setRecordings([]); }
    } catch { setRecordings([]); }
  }
  async function persist(u: Recording[]) { await FileSystem.writeAsStringAsync(HISTORY_PATH, JSON.stringify(u)); setRecordings(u); }

  const nextSoundRef = useRef<Audio.Sound | null>(null);

  async function togglePlay(item: Recording) {
    if (playingId === item.id && isPlaying) {
      await soundRef.current?.stopAsync(); await soundRef.current?.unloadAsync();
      await nextSoundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null; nextSoundRef.current = null;
      setPlayingId(null); setPos(0); setIsPlaying(false); setChunkIndex(0); return;
    }
    await togglePlayAt(item, 0, 0);
  }
  async function togglePlayAt(item: Recording, ci: number, posMs: number) {
    const uris = item.uris && item.uris.length > 0 ? item.uris : [item.uri];
    await soundRef.current?.stopAsync().catch(() => {});
    await soundRef.current?.unloadAsync().catch(() => {});
    await nextSoundRef.current?.unloadAsync().catch(() => {});

    const playChunk = async (idx: number, startAt: number) => {
      if (idx >= uris.length) { setPlayingId(null); setIsPlaying(false); setChunkIndex(0); return; }
      setChunkIndex(idx);
      if (idx + 1 < uris.length) {
        nextSoundRef.current?.unloadAsync().catch(() => {});
        const { sound: next } = await Audio.Sound.createAsync({ uri: uris[idx + 1] }, { shouldPlay: false });
        nextSoundRef.current = next;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: uris[idx] }, { shouldPlay: true, positionMillis: startAt }, (s) => {
        if (s.isLoaded) { setPos(s.positionMillis); if (s.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (nextSoundRef.current) { soundRef.current = nextSoundRef.current; nextSoundRef.current = null; soundRef.current!.playAsync(); playChunk(idx + 1, 0); }
          else { playChunk(idx + 1, 0); }
        }}
      });
      soundRef.current = sound;
    };
    setPlayingId(item.id); setIsPlaying(true); setPos(posMs);
    await playChunk(ci, posMs);
  }
  async function jump(ms: number) { const np = Math.max(0, Math.min(dur, pos + ms)); await soundRef.current?.setPositionAsync(np); setPos(np); }
  async function openCardPanel(item: Recording) {
    setOpenMenuId(item.id);
    if (playingId !== item.id) {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      nextSoundRef.current?.unloadAsync().catch(() => {});
      const uris = item.uris || [item.uri];
      const durs: number[] = [];
      for (const u of uris) {
        const { sound } = await Audio.Sound.createAsync({ uri: u }, { shouldPlay: false });
        const st = await sound.getStatusAsync();
        durs.push(st.isLoaded ? (st.durationMillis || 0) : 0);
        sound.unloadAsync().catch(() => {});
      }
      setChunkDurs(durs);
      setPlayingId(null); setIsPlaying(false); setChunkIndex(0);
    }
  }

  function closeCardPanel() { setOpenMenuId(null); setChunkDurs([]); }
  function startRename(item: Recording) { setEditingId(item.id); setEditingTitle(item.title); }
  function cancelRename() { setEditingId(null); setEditingTitle(""); }
  async function saveRename() { const id = editingId; if (!id || !editingTitle.trim()) { cancelRename(); return; } await persist(recordings.map(r => r.id === id ? { ...r, title: editingTitle.trim() } : r)); cancelRename(); }
  async function shareItem(item: Recording) { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(item.uri); }
  function deleteItem(item: Recording) {
    Alert.alert("Delete", `Delete "${item.title}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => {
      const uris = item.uris || [item.uri];
      for (const u of uris) { FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {}); }
      await persist(recordings.filter(r => r.id !== item.id));
      if (playingId === item.id) { await soundRef.current?.unloadAsync(); setPlayingId(null); setIsPlaying(false); }
    }}]);
  }

  function renderCard(item: Recording) {
    const isActive = playingId === item.id;
    const isEditing = editingId === item.id;
    const isMenuOpen = openMenuId === item.id;

    return (
      <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={s.row}>
          <TouchableOpacity style={[s.play, { borderColor: c.border, backgroundColor: isActive ? c.text : c.bg }]} onPress={async () => { if (!isMenuOpen) await openCardPanel(item); togglePlay(item); }}>
            {isActive ? <Pause size={18} color={c.bg} /> : <Play size={18} color={c.text} />}
          </TouchableOpacity>
          <View style={s.info}>
            {isEditing ? (
              <TextInput style={[s.input, { color: c.text, borderColor: c.accent, backgroundColor: c.bg }]} value={editingTitle} onChangeText={setEditingTitle} onSubmitEditing={saveRename} onBlur={cancelRename} autoFocus selectTextOnFocus />
            ) : (
              <>
                <Text style={[s.title, { color: c.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.meta, { color: c.dim }]}>
                  {item.voice} · {formatDate(item.createdAt)}
                  {isActive && (item.uris?.length || 0) > 1 ? ` · part ${chunkIndex + 1}/${item.uris?.length}` : ""}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity style={[s.menuBtn, { borderColor: c.border }]} onPress={async () => {
            if (isMenuOpen) { closeCardPanel(); } else { await openCardPanel(item); }
          }}>
            <EllipsisVertical size={18} color={c.text} />
          </TouchableOpacity>
        </View>

        {isMenuOpen && (
          <View>
            <View style={s.progRow}>
              <Text style={[s.time, { color: c.dim }]}>{formatTime(pos + (cumulative[chunkIndex - 1] || 0))}</Text>
              <TouchableOpacity style={[s.track, { backgroundColor: c.bg }]}
                onLayout={(e) => { progW.current = e.nativeEvent.layout.width; }}
                onPress={(e) => {
                  if (!totalDur || !progW.current) return;
                  const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / progW.current));
                  const targetMs = ratio * totalDur;
                  let ci = 0, offset = 0;
                  for (let j = 0; j < cumulative.length; j++) { if (targetMs < cumulative[j]) { ci = j; offset = j > 0 ? cumulative[j - 1] : 0; break; } }
                  togglePlayAt(item, ci, targetMs - offset);
                }} activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}>
                <View style={[s.fill, { width: `${totalDur > 0 ? Math.min(1, (pos + (cumulative[chunkIndex - 1] || 0)) / totalDur) * 100 : 0}%`, backgroundColor: c.accent }]} />
              </TouchableOpacity>
              <Text style={[s.time, { color: c.dim }]}>{formatTime(totalDur)}</Text>
            </View>
            <View style={s.ctrls}>
              <TouchableOpacity style={[s.ctrl, { borderColor: c.border, backgroundColor: c.bg }]} onPress={() => jump(-15000)}><Text style={[s.ctrlT, { color: c.text }]}>-15s</Text></TouchableOpacity>
              <TouchableOpacity style={[s.ctrl, { borderColor: c.border, backgroundColor: c.bg }]} onPress={() => { setPos(0); soundRef.current?.setPositionAsync(0); }}><Text style={[s.ctrlT, { color: c.text }]}>Restart</Text></TouchableOpacity>
              <TouchableOpacity style={[s.ctrl, { borderColor: c.border, backgroundColor: c.bg }]} onPress={() => jump(15000)}><Text style={[s.ctrlT, { color: c.text }]}>+15s</Text></TouchableOpacity>
            </View>

            <View style={[s.actions, { borderTopColor: c.border }]}>
              {isEditing ? (
                <>
                  <TouchableOpacity style={[s.act, { borderColor: c.border, backgroundColor: c.bg }]} onPress={saveRename}><Text style={[s.actT, { color: c.text }]}>Save</Text></TouchableOpacity>
                  <TouchableOpacity style={[s.act, { borderColor: c.border, backgroundColor: c.bg }]} onPress={cancelRename}><Text style={[s.actT, { color: c.text }]}>Cancel</Text></TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[s.act, { borderColor: c.border, backgroundColor: c.bg }]} onPress={() => startRename(item)}><Text style={[s.actT, { color: c.text }]}>Rename</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={[s.act, { borderColor: c.border, backgroundColor: c.bg }]} onPress={() => shareItem(item)}><Share2 size={16} color={c.text} /></TouchableOpacity>
              <TouchableOpacity style={[s.del, { borderColor: c.border, backgroundColor: c.bg }]} onPress={() => deleteItem(item)}><X size={18} color="#f87171" /></TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <FloatingHamburger topOffset={topPad} colors={{ text: c.text, dim: c.dim, card: c.card, border: c.border }} menuItems={[{ label: "Dashboard", onPress: () => navigation.goBack() }]} />
      <FlatList data={recordings} keyExtractor={(r) => r.id} contentContainerStyle={[s.list, { paddingTop: topPad + 48 }]} removeClippedSubviews={false}
        ListEmptyComponent={<View style={s.empty}><Text style={[s.emptyT, { color: c.text }]}>No recordings yet</Text><Text style={[s.emptyS, { color: c.dim }]}>Generated audio will appear here</Text></View>}
        renderItem={({ item }) => renderCard(item)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 16, paddingBottom: 48 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyT: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptyS: { fontSize: 14, textAlign: "center" },
  card: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  play: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  meta: { fontSize: 12 },
  input: { fontSize: 14, fontWeight: "600", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  menuBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  progRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 10 },
  time: { fontSize: 11, minWidth: 36 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  ctrls: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 4 },
  ctrl: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  ctrlT: { fontSize: 13, fontWeight: "500" },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  act: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  actT: { fontSize: 13, fontWeight: "500" },
  del: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
