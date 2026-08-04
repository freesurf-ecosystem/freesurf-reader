import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  appName: string;
  onSignIn: () => void;
  onSignOut: () => void;
  isLoggedIn: boolean;
  menuItems?: { label: string; onPress: () => void }[];
  colors?: { text: string; muted: string; card: string; border: string };
};

const DARK = { text: "#e8ecff", muted: "#5f6b7a", card: "#111937", border: "#2a3568" };

export default function TopBar({ appName, onSignIn, onSignOut, isLoggedIn, menuItems, colors }: Props) {
  const [open, setOpen] = useState(false);
  const c = colors || DARK;

  return (
    <View style={styles.bar}>
      <Text style={[styles.brand, { color: "#5b8cff" }]}>{appName}</Text>
      <Pressable style={styles.hamburger} onPress={() => setOpen(true)} accessibilityLabel="Open menu">
        <View style={[styles.line, { backgroundColor: c.text }]} />
        <View style={[styles.line, { backgroundColor: c.text }]} />
        <View style={[styles.line, { backgroundColor: c.text }]} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: c.card, borderColor: c.border }]}>
            {menuItems?.map((item, i) => (
              <Pressable key={i} style={styles.item} onPress={() => { setOpen(false); item.onPress(); }}>
                <Text style={[styles.label, { color: c.text }]}>{item.label}</Text>
              </Pressable>
            ))}
            {menuItems && menuItems.length > 0 ? <View style={[styles.divider, { backgroundColor: c.border }]} /> : null}
            {isLoggedIn ? (
              <Pressable style={styles.item} onPress={() => { setOpen(false); onSignOut(); }}>
                <Text style={[styles.signOut, { color: c.muted }]}>Log out</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.item} onPress={() => { setOpen(false); onSignIn(); }}>
                <Text style={[styles.label, { color: c.text }]}>Sign in to sync</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  hamburger: { padding: 6, gap: 5, justifyContent: "center", alignItems: "center" },
  line: { width: 22, height: 2, borderRadius: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  menu: {
    position: "absolute", top: 44, right: 20,
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 6, minWidth: 210,
  },
  item: { paddingHorizontal: 20, paddingVertical: 13 },
  label: { fontSize: 15 },
  divider: { height: 1, marginVertical: 4 },
  signOut: { fontSize: 15 },
});
