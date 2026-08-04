const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },

  body: { flex: 1 },
  bodyContent: { padding: 24, paddingBottom: 24 },

  titleInput: {
    fontSize: 22, fontWeight: "600", paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1,
  },
  textInput: { fontSize: 18, lineHeight: 28 },

  readerBar: { borderTopWidth: 1, paddingBottom: 36 },
  toast: { backgroundColor: "#0d6b61", paddingVertical: 8, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  barRow: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 4 },
  barBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  barBtnText: { fontSize: 14, fontWeight: "600" },
  barRight: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  estimate: { fontSize: 12, fontWeight: "600" },
  playBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 22, backgroundColor: "#e8ecff15",
  },
  playBtnActive: { backgroundColor: "#5b8cff" },
  playBtnText: { color: "#e8ecff", fontSize: 14, fontWeight: "700" },
  playBtnTextActive: { color: "#fff", fontSize: 14, fontWeight: "700" },
  voiceChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  voiceChipText: { fontSize: 12, fontWeight: "600" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 56 },
  sheetTitle: { fontSize: 16, fontWeight: "700", padding: 16, borderBottomWidth: 1 },
  voiceOption: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  voiceSelected: { backgroundColor: "#5b8cff15" },
  voiceLabel: { fontSize: 15 },
  voiceDesc: { fontSize: 12, marginTop: 2 },
});