import React, { useState } from "react";
import { View, ScrollView, Pressable, Linking } from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { translationsFor, useAppLanguage } from "../i18n";

type Props = { onAgree: () => void };

const TERMS_URL = "https://freesurf.tools/terms";
const PRIVACY_URL = "https://freesurf.tools/privacy";
const AI_URL = "https://freesurf.tools/privacy#ai-processing";

export default function AIConsentScreen({ onAgree }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { lang } = useAppLanguage();
  const T = translationsFor(lang);
  const [agreed, setAgreed] = useState(false);

  const linkStyle = { color: theme.colors.primary, textDecorationLine: "underline" as const };

  const links: Record<string, { url: string; label: string }> = {
    terms: { url: TERMS_URL, label: T.aiAgreeTerms },
    privacy: { url: PRIVACY_URL, label: T.aiAgreePrivacy },
    ai: { url: AI_URL, label: T.aiAgreeHow },
  };

  // Splits the localized agreement sentence on {terms}/{privacy}/{ai} tokens and
  // renders each token as an inline, tappable link.
  const renderAgreement = () =>
    T.aiAgreeText.split(/(\{terms\}|\{privacy\}|\{ai\})/g).map((part, i) => {
      const link = links[part.replace(/[{}]/g, "")];
      if (link) {
        return (
          <Text key={i} style={linkStyle} onPress={() => Linking.openURL(link.url)}>
            {link.label}
          </Text>
        );
      }
      return <Text key={i}>{part}</Text>;
    });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: 24 }}>
        <Text variant="headlineSmall" style={{ fontWeight: "800", marginBottom: 10 }}>{T.aiWelcome}</Text>

        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22, marginBottom: 12 }}>
          {T.aiReview}
        </Text>

        <Text variant="titleMedium" style={{ fontWeight: "700", marginBottom: 8 }}>{T.aiHowWeUse}</Text>

        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22, marginBottom: 24 }}>
          {T.aiBody} {T.aiBody2}
        </Text>

        <Pressable onPress={() => setAgreed(!agreed)} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24, paddingVertical: 4 }}>
          <View style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: theme.colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: agreed ? theme.colors.primary : "transparent" }}>
            {agreed && <Text style={{ color: theme.colors.onPrimary, fontWeight: "800", fontSize: 16 }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, fontSize: 15, color: theme.colors.onSurface, lineHeight: 21 }}>
            {renderAgreement()}
          </Text>
        </Pressable>

        <Button mode="contained" disabled={!agreed} onPress={onAgree} contentStyle={{ height: 54 }} labelStyle={{ fontSize: 17, fontWeight: "700" }}>
          {T.aiContinue}
        </Button>
      </ScrollView>
    </View>
  );
}
