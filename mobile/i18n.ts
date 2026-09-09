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
    goPro: "Go Pro", proBadge: "PRO", proTitle: "Reader Pro",
    proSubtitle: "Unlimited read-aloud for articles and notes.",
    proPrice: "$20", proPerMonth: "/ month",
    featureUnlimited: "Unlimited read-aloud minutes",
    featureNoAds: "No ads",
    subscribeCta: "Subscribe", restoreCta: "Restore Purchase",
    activatedMsg: "Subscription activated. Enjoy Pro!",
    restoredMsg: "Your purchases have been restored.",
    cancelAnytime: "Cancel anytime in Google Play or the App Store.",
    proNote: "Subscriptions keep the free tier free for everyone.",
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
  fr: {
    titlePlaceholder: "Titre du document",
    textPlaceholder: "Collez ici un article, un guide ou un texte...",
    importLabel: "Importer",
    readLabel: "Lire",
    stopLabel: "Arrêter",
    preparingLabel: "Préparation...",
    voicePickerTitle: "Choisir la langue",
    savedToast: "Enregistré dans les enregistrements",
    recordingsTitle: "Vos enregistrements",
    noRecordings: "Aucun enregistrement",
    createFirst: "Touchez + pour créer votre première note",
    newNote: "Nouvelle note",
    menuSupport: "Assistance",
    menuPrivacy: "Confidentialité",
    menuTerms: "Conditions",
    untitled: "Sans titre",
    restart: "Recommencer",
  },
  hi: {
    titlePlaceholder: "दस्तावेज़ का शीर्षक",
    textPlaceholder: "यहाँ एक लेख, अध्ययन मार्गदर्शिका या दस्तावेज़ पाठ चिपकाएँ...",
    importLabel: "आयात करें",
    readLabel: "पढ़ें",
    stopLabel: "रोकें",
    preparingLabel: "तैयार हो रहा है...",
    voicePickerTitle: "भाषा चुनें",
    savedToast: "रिकॉर्डिंग में सहेजा गया",
    recordingsTitle: "आपकी रिकॉर्डिंग",
    noRecordings: "अभी कोई रिकॉर्डिंग नहीं",
    createFirst: "पहली नोट बनाने के लिए + दबाएं",
    newNote: "नई नोट",
    menuSupport: "सहायता",
    menuPrivacy: "गोपनीयता",
    menuTerms: "शर्तें",
    untitled: "बिना शीर्षक",
    restart: "फिर से शुरू करें",
  },
  it: {
    titlePlaceholder: "Titolo del documento",
    textPlaceholder: "Incolla qui un articolo, una guida o un testo...",
    importLabel: "Importa",
    readLabel: "Leggi",
    stopLabel: "Ferma",
    preparingLabel: "Preparazione...",
    voicePickerTitle: "Scegli la lingua",
    savedToast: "Salvato nelle registrazioni",
    recordingsTitle: "Le tue registrazioni",
    noRecordings: "Nessuna registrazione",
    createFirst: "Tocca + per creare la prima nota",
    newNote: "Nuova nota",
    menuSupport: "Supporto",
    menuPrivacy: "Privacy",
    menuTerms: "Termini",
    untitled: "Senza titolo",
    restart: "Ricomincia",
  },
  ja: {
    titlePlaceholder: "文書のタイトル",
    textPlaceholder: "記事やガイド、文書テキストをここに貼り付け...",
    importLabel: "インポート",
    readLabel: "読む",
    stopLabel: "停止",
    preparingLabel: "準備中...",
    voicePickerTitle: "言語を選択",
    savedToast: "録音に保存しました",
    recordingsTitle: "録音",
    noRecordings: "録音はまだありません",
    createFirst: "+ をタップして最初のメモを作成",
    newNote: "新しいメモ",
    menuSupport: "サポート",
    menuPrivacy: "プライバシー",
    menuTerms: "利用規約",
    untitled: "無題",
    restart: "最初から",
  },
  pt: {
    titlePlaceholder: "Título do documento",
    textPlaceholder: "Cole aqui um artigo, guia ou texto de documento...",
    importLabel: "Importar",
    readLabel: "Ler",
    stopLabel: "Parar",
    preparingLabel: "Preparando...",
    voicePickerTitle: "Escolher idioma",
    savedToast: "Salvo em gravações",
    recordingsTitle: "Suas gravações",
    noRecordings: "Ainda não há gravações",
    createFirst: "Toque em + para criar a primeira nota",
    newNote: "Nova nota",
    menuSupport: "Suporte",
    menuPrivacy: "Privacidade",
    menuTerms: "Termos",
    untitled: "Sem título",
    restart: "Recomeçar",
  },
  zh: {
    titlePlaceholder: "文档标题",
    textPlaceholder: "在此粘贴文章、学习指南或文档文本...",
    importLabel: "导入",
    readLabel: "朗读",
    stopLabel: "停止",
    preparingLabel: "准备中...",
    voicePickerTitle: "选择语言",
    savedToast: "已保存到录音",
    recordingsTitle: "您的录音",
    noRecordings: "尚无录音",
    createFirst: "点击 + 创建第一条笔记",
    newNote: "新笔记",
    menuSupport: "支持",
    menuPrivacy: "隐私",
    menuTerms: "条款",
    untitled: "无标题",
    restart: "重新开始",
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

export function translationsFor(lang: Lang): Strings {
  const en = translations[DEFAULT_LANG] ?? {};
  return { ...en, ...(translations[lang] ?? {}) };
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
