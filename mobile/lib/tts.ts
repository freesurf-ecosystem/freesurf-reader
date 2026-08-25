/**
 * FreeSurf Natural Reader — TTS Service
 * Calls the Cloudflare Worker which proxies to RunPod.
 * Voice list matches Chatterbox Multilingual V3 (23 languages).
 */

import { TTS_WORKER_URL } from "./config";

export interface Voice {
  id: string;
  label: string;
  description: string;
  voice: string;
  language: string;
}

export const VOICES: Voice[] = [
  { id: "en", label: "English", description: "English", voice: "en", language: "en" },
  { id: "ar", label: "Arabic", description: "العربية", voice: "ar", language: "ar" },
  { id: "da", label: "Danish", description: "Dansk", voice: "da", language: "da" },
  { id: "de", label: "German", description: "Deutsch", voice: "de", language: "de" },
  { id: "el", label: "Greek", description: "Ελληνικά", voice: "el", language: "el" },
  { id: "es", label: "Spanish", description: "Español", voice: "es", language: "es" },
  { id: "fi", label: "Finnish", description: "Suomi", voice: "fi", language: "fi" },
  { id: "fr", label: "French", description: "Français", voice: "fr", language: "fr" },
  { id: "he", label: "Hebrew", description: "עברית", voice: "he", language: "he" },
  { id: "hi", label: "Hindi", description: "हिन्दी", voice: "hi", language: "hi" },
  { id: "it", label: "Italian", description: "Italiano", voice: "it", language: "it" },
  { id: "ja", label: "Japanese", description: "日本語", voice: "ja", language: "ja" },
  { id: "ko", label: "Korean", description: "한국어", voice: "ko", language: "ko" },
  { id: "ms", label: "Malay", description: "Bahasa Melayu", voice: "ms", language: "ms" },
  { id: "nl", label: "Dutch", description: "Nederlands", voice: "nl", language: "nl" },
  { id: "no", label: "Norwegian", description: "Norsk", voice: "no", language: "no" },
  { id: "pl", label: "Polish", description: "Polski", voice: "pl", language: "pl" },
  { id: "pt", label: "Portuguese", description: "Português", voice: "pt", language: "pt" },
  { id: "ru", label: "Russian", description: "Русский", voice: "ru", language: "ru" },
  { id: "sv", label: "Swedish", description: "Svenska", voice: "sv", language: "sv" },
  { id: "sw", label: "Swahili", description: "Kiswahili", voice: "sw", language: "sw" },
  { id: "tr", label: "Turkish", description: "Türkçe", voice: "tr", language: "tr" },
  { id: "zh", label: "Chinese", description: "中文", voice: "zh", language: "zh" },
];

export async function textToSpeech(
  text: string,
  voice = "en",
  speed = 1.0
): Promise<string> {
  const res = await fetch(`${TTS_WORKER_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, language: voice, speed }),
  });

  const raw = await res.text();
  let data: any;
  try { data = JSON.parse(raw); } catch {
    throw new Error(`TTS returned non-JSON (${res.status}): ${raw.slice(0, 200)}`);
  }

  if (!res.ok || data.error) {
    throw new Error(data.error || `TTS request failed (${res.status})`);
  }

  if (!data.audio_base64) {
    throw new Error("TTS response missing audio_base64");
  }

  return data.audio_base64;
}

export async function extractPdfText(
  pdfBase64: string
): Promise<string> {
  const res = await fetch(`${TTS_WORKER_URL}/api/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdf_base64: pdfBase64 }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "PDF extraction failed");
  }

  return data.text;
}
