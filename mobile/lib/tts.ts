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
  { id: "af_heart", label: "Heart", description: "English (US) · Female", voice: "af_heart", language: "en" },
  { id: "af_alloy", label: "Alloy", description: "English (US) · Female", voice: "af_alloy", language: "en" },
  { id: "af_bella", label: "Bella", description: "English (US) · Female", voice: "af_bella", language: "en" },
  { id: "af_nova", label: "Nova", description: "English (US) · Female", voice: "af_nova", language: "en" },
  { id: "af_sarah", label: "Sarah", description: "English (US) · Female", voice: "af_sarah", language: "en" },
  { id: "am_michael", label: "Michael", description: "English (US) · Male", voice: "am_michael", language: "en" },
  { id: "am_echo", label: "Echo", description: "English (US) · Male", voice: "am_echo", language: "en" },
  { id: "am_fenrir", label: "Fenrir", description: "English (US) · Male", voice: "am_fenrir", language: "en" },
  { id: "bf_emma", label: "Emma", description: "English (UK) · Female", voice: "bf_emma", language: "en" },
  { id: "bm_george", label: "George", description: "English (UK) · Male", voice: "bm_george", language: "en" },
  { id: "ef_dora", label: "Dora", description: "Spanish · Female", voice: "ef_dora", language: "es" },
  { id: "em_alex", label: "Alex", description: "Spanish · Male", voice: "em_alex", language: "es" },
  { id: "ff_siwis", label: "Siwis", description: "French · Female", voice: "ff_siwis", language: "fr" },
  { id: "hf_alpha", label: "Alpha", description: "Hindi · Female", voice: "hf_alpha", language: "hi" },
  { id: "hm_omega", label: "Omega", description: "Hindi · Male", voice: "hm_omega", language: "hi" },
  { id: "if_sara", label: "Sara", description: "Italian · Female", voice: "if_sara", language: "it" },
  { id: "im_nicola", label: "Nicola", description: "Italian · Male", voice: "im_nicola", language: "it" },
  { id: "jf_alpha", label: "Alpha", description: "Japanese · Female", voice: "jf_alpha", language: "ja" },
  { id: "jm_kumo", label: "Kumo", description: "Japanese · Male", voice: "jm_kumo", language: "ja" },
  { id: "pf_dora", label: "Dora", description: "Portuguese · Female", voice: "pf_dora", language: "pt" },
  { id: "pm_alex", label: "Alex", description: "Portuguese · Male", voice: "pm_alex", language: "pt" },
  { id: "zf_xiaobei", label: "Xiaobei", description: "Mandarin · Female", voice: "zf_xiaobei", language: "zh" },
  { id: "zf_xiaoxiao", label: "Xiaoxiao", description: "Mandarin · Female", voice: "zf_xiaoxiao", language: "zh" },
  { id: "zm_yunjian", label: "Yunjian", description: "Mandarin · Male", voice: "zm_yunjian", language: "zh" },
];

export async function textToSpeech(
  text: string,
  voice = "af_heart",
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
