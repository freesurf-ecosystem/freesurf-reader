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
    dashboardLabel: "Dashboard",
    languageLabel: "Language",
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
    freeCredits: "Free credits", thisMonth: "this month",
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
    freeCredits: "Créditos gratis", thisMonth: "este mes",
    dashboardLabel: "Panel",
    languageLabel: "Idioma",
    goPro: "Hazte Pro",
    proTitle: "Reader Pro",
    proSubtitle: "Lectura en voz alta ilimitada para artículos y notas.",
    proPrice: "$20", proPerMonth: "/ mes",
    featureUnlimited: "Minutos de lectura ilimitados",
    featureNoAds: "Sin anuncios",
    subscribeCta: "Suscribirse", restoreCta: "Restaurar compra",
    activatedMsg: "Suscripción activada. ¡Disfruta Pro!",
    restoredMsg: "Tus compras se han restaurado.",
    cancelAnytime: "Cancela cuando quieras en Google Play o App Store.",
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
    freeCredits: "Crédits gratuits", thisMonth: "ce mois-ci",
    dashboardLabel: "Tableau de bord",
    languageLabel: "Langue",
    goPro: "Passer à Pro",
    proTitle: "Reader Pro",
    proSubtitle: "Lecture à voix haute illimitée pour articles et notes.",
    proPrice: "$20", proPerMonth: "/ mois",
    featureUnlimited: "Minutes de lecture illimitées",
    featureNoAds: "Sans publicité",
    subscribeCta: "S'abonner", restoreCta: "Restaurer l'achat",
    activatedMsg: "Abonnement activé. Profitez de Pro !",
    restoredMsg: "Vos achats ont été restaurés.",
    cancelAnytime: "Annulez à tout moment dans Google Play ou l'App Store.",
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
    freeCredits: "मुफ्त क्रेडिट", thisMonth: "इस माह",
    dashboardLabel: "डैशबोर्ड",
    languageLabel: "भाषा",
    goPro: "Pro लें",
    proTitle: "Reader Pro",
    proSubtitle: "लेखों और नोट्स के लिए असीमित पठन।",
    proPrice: "$20", proPerMonth: "/ माह",
    featureUnlimited: "असीमित पठन मिनट",
    featureNoAds: "कोई विज्ञापन नहीं",
    subscribeCta: "सदस्यता लें", restoreCta: "खरीद पुनर्स्थापित करें",
    activatedMsg: "सदस्यता सक्रिय हो गई। Pro का आनंद लें!",
    restoredMsg: "आपकी खरीदारी बहाल कर दी गई है।",
    cancelAnytime: "Google Play या App Store में कभी भी रद्द करें।",
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
    freeCredits: "Crediti gratuiti", thisMonth: "questo mese",
    dashboardLabel: "Dashboard",
    languageLabel: "Lingua",
    goPro: "Passa a Pro",
    proTitle: "Reader Pro",
    proSubtitle: "Lettura ad alta voce illimitata per articoli e note.",
    proPrice: "$20", proPerMonth: "/ mese",
    featureUnlimited: "Minuti di lettura illimitati",
    featureNoAds: "Nessuna pubblicità",
    subscribeCta: "Abbonati", restoreCta: "Ripristina acquisto",
    activatedMsg: "Abbonamento attivato. Buon Pro!",
    restoredMsg: "I tuoi acquisti sono stati ripristinati.",
    cancelAnytime: "Annulla in qualsiasi momento su Google Play o App Store.",
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
    freeCredits: "無料クレジット", thisMonth: "今月",
    dashboardLabel: "ダッシュボード",
    languageLabel: "言語",
    goPro: "Pro にする",
    proTitle: "Reader Pro",
    proSubtitle: "記事やノートを無制限に読み上げ。",
    proPrice: "$20", proPerMonth: "/ 月",
    featureUnlimited: "読み上げ時間は無制限",
    featureNoAds: "広告なし",
    subscribeCta: "登録する", restoreCta: "購入を復元",
    activatedMsg: "登録が完了しました。Proをお楽しみください！",
    restoredMsg: "購入を復元しました。",
    cancelAnytime: "Google Play または App Store でいつでも解約できます。",
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
    freeCredits: "Créditos grátis", thisMonth: "este mês",
    dashboardLabel: "Painel",
    languageLabel: "Idioma",
    goPro: "Seja Pro",
    proTitle: "Reader Pro",
    proSubtitle: "Leitura em voz alta ilimitada para artigos e notas.",
    proPrice: "$20", proPerMonth: "/ mês",
    featureUnlimited: "Minutos de leitura ilimitados",
    featureNoAds: "Sem anúncios",
    subscribeCta: "Assinar", restoreCta: "Restaurar compra",
    activatedMsg: "Assinatura ativada. Aproveite o Pro!",
    restoredMsg: "Suas compras foram restauradas.",
    cancelAnytime: "Cancele quando quiser no Google Play ou na App Store.",
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
    freeCredits: "免费额度", thisMonth: "本月",
    dashboardLabel: "主页",
    languageLabel: "语言",
    goPro: "升级 Pro",
    proTitle: "Reader Pro",
    proSubtitle: "文章和笔记无限朗读。",
    proPrice: "$20", proPerMonth: "/ 月",
    featureUnlimited: "无限朗读时长",
    featureNoAds: "无广告",
    subscribeCta: "订阅", restoreCta: "恢复购买",
    activatedMsg: "订阅已激活。尽情享受 Pro！",
    restoredMsg: "您的购买已恢复。",
    cancelAnytime: "可随时在 Google Play 或 App Store 取消。",
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

// Module-level shared language state so every component that calls useAppLanguage()
// re-renders when the language changes (dashboard, menus, paywall, etc.).
let currentCode: string | null = null;
let loadedFlag = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  if (loadPromise) return loadPromise;
  loadPromise = AsyncStorage.getItem(LANG_KEY)
    .then((v) => { if (v) currentCode = v; })
    .catch(() => {})
    .finally(() => { loadedFlag = true; emit(); });
  return loadPromise;
}

export function setAppLanguage(code: string) {
  currentCode = code;
  AsyncStorage.setItem(LANG_KEY, code).catch(() => {});
  emit();
}

export function useAppLanguage(): {
  lang: Lang;
  loaded: boolean;
  chosen: boolean;
  chosenCode: string | null;
  setLanguage: (code: string) => void;
} {
  const [, force] = useState(0);
  useEffect(() => {
    ensureLoaded();
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  const lang = normalizeLang(currentCode ?? deviceLang());
  return {
    lang,
    loaded: loadedFlag,
    chosen: loadedFlag && currentCode !== null,
    chosenCode: currentCode,
    setLanguage: setAppLanguage,
  };
}
