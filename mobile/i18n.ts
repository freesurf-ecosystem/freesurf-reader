import { useEffect, useState } from "react";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Strings = Record<string, string>;
export type Lang = string;

export const translations: Record<Lang, Strings> = {
  en: {
    titlePlaceholder: "Document title",
    textPlaceholder: "Paste an article, study guide, or document text here...",
    importLabel: "Import",
    readLabel: "Read",
    stopLabel: "Stop",
    preparingLabel: "Preparing...",
    voicePickerTitle: "Choose language",
    savedToast: "Saved to Recordings",
    recordingsTitle: "Your Recordings",
    noRecordings: "No recordings yet",
    createFirst: "Tap + to create your first note",
    newNote: "New note",
    menuSupport: "Support",
    menuPrivacy: "Privacy",
    menuTerms: "Terms",
    untitled: "Untitled",
    restart: "Restart",
  },
  es: {
    titlePlaceholder: "Título del documento",
    textPlaceholder: "Pega aquí un artículo, guía de estudio o texto de documento...",
    importLabel: "Importar",
    readLabel: "Leer",
    stopLabel: "Detener",
    preparingLabel: "Preparando...",
    voicePickerTitle: "Elegir idioma",
    savedToast: "Guardado en grabaciones",
    recordingsTitle: "Tus grabaciones",
    noRecordings: "Aún no hay grabaciones",
    createFirst: "Toca + para crear tu primera nota",
    newNote: "Nueva nota",
    menuSupport: "Soporte",
    menuPrivacy: "Privacidad",
    menuTerms: "Términos",
    untitled: "Sin título",
    restart: "Reiniciar",
  },
};

export const DEFAULT_LANG: Lang = "en";
const LANG_KEY = "freesurf-app-lang";

export function normalizeLang(code?: string | null): Lang {
  return code && translations[code] ? code : DEFAULT_LANG;
}

export function deviceLang(): Lang {
  try {
    return normalizeLang(getLocales()?.[0]?.languageCode);
  } catch {
    return DEFAULT_LANG;
  }
}

export function useAppLanguage(): {
  lang: Lang;
  loaded: boolean;
  chosen: boolean;
  chosenCode: string | null;
  setLanguage: (code: string) => void;
} {
  const [chosenCode, setChosenCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((v) => { if (v) setChosenCode(v); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);
  const lang = normalizeLang(chosenCode ?? deviceLang());
  const setLanguage = (code: string) => {
    setChosenCode(code);
    AsyncStorage.setItem(LANG_KEY, code).catch(() => {});
  };
  return { lang, loaded, chosen: loaded && chosenCode !== null, chosenCode, setLanguage };
}
