/**
 * FreeSurf Natural Reader — TTS Service
 * Calls the Cloudflare Worker which proxies to RunPod.
 * Voice list matches Chatterbox Multilingual V3 (23 languages).
 */

import { TTS_WORKER_URL } from "./config";
import { getDeviceId } from "./device";

export type VoiceGender = "female" | "male";

export interface Voice {
  id: string;
  label: string;
  /** Accent/language key appended to `voice` to form an i18n string (e.g. "EnglishUS" -> voiceEnglishUS). */
  accent: string;
  gender: VoiceGender;
  voice: string;
  language: string;
}

export const VOICES: Voice[] = [
  { id: "af_heart", label: "Heart", accent: "EnglishUS", gender: "female", voice: "af_heart", language: "en" },
  { id: "af_alloy", label: "Alloy", accent: "EnglishUS", gender: "female", voice: "af_alloy", language: "en" },
  { id: "af_bella", label: "Bella", accent: "EnglishUS", gender: "female", voice: "af_bella", language: "en" },
  { id: "af_nova", label: "Nova", accent: "EnglishUS", gender: "female", voice: "af_nova", language: "en" },
  { id: "af_sarah", label: "Sarah", accent: "EnglishUS", gender: "female", voice: "af_sarah", language: "en" },
  { id: "am_michael", label: "Michael", accent: "EnglishUS", gender: "male", voice: "am_michael", language: "en" },
  { id: "am_echo", label: "Echo", accent: "EnglishUS", gender: "male", voice: "am_echo", language: "en" },
  { id: "am_fenrir", label: "Fenrir", accent: "EnglishUS", gender: "male", voice: "am_fenrir", language: "en" },
  { id: "bf_emma", label: "Emma", accent: "EnglishUK", gender: "female", voice: "bf_emma", language: "en" },
  { id: "bm_george", label: "George", accent: "EnglishUK", gender: "male", voice: "bm_george", language: "en" },
  { id: "ef_dora", label: "Dora", accent: "Spanish", gender: "female", voice: "ef_dora", language: "es" },
  { id: "em_alex", label: "Alex", accent: "Spanish", gender: "male", voice: "em_alex", language: "es" },
  { id: "ff_siwis", label: "Siwis", accent: "French", gender: "female", voice: "ff_siwis", language: "fr" },
  { id: "hf_alpha", label: "Alpha", accent: "Hindi", gender: "female", voice: "hf_alpha", language: "hi" },
  { id: "hm_omega", label: "Omega", accent: "Hindi", gender: "male", voice: "hm_omega", language: "hi" },
  { id: "if_sara", label: "Sara", accent: "Italian", gender: "female", voice: "if_sara", language: "it" },
  { id: "im_nicola", label: "Nicola", accent: "Italian", gender: "male", voice: "im_nicola", language: "it" },
  { id: "jf_alpha", label: "Alpha", accent: "Japanese", gender: "female", voice: "jf_alpha", language: "ja" },
  { id: "jm_kumo", label: "Kumo", accent: "Japanese", gender: "male", voice: "jm_kumo", language: "ja" },
  { id: "pf_dora", label: "Dora", accent: "Portuguese", gender: "female", voice: "pf_dora", language: "pt" },
  { id: "pm_alex", label: "Alex", accent: "Portuguese", gender: "male", voice: "pm_alex", language: "pt" },
  { id: "zf_xiaobei", label: "Xiaobei", accent: "Mandarin", gender: "female", voice: "zf_xiaobei", language: "zh" },
  { id: "zf_xiaoxiao", label: "Xiaoxiao", accent: "Mandarin", gender: "female", voice: "zf_xiaoxiao", language: "zh" },
  { id: "zm_yunjian", label: "Yunjian", accent: "Mandarin", gender: "male", voice: "zm_yunjian", language: "zh" },
];

export async function textToSpeech(
  text: string,
  voice = "af_heart",
  speed = 1.0
): Promise<string> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${TTS_WORKER_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Id": deviceId },
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
