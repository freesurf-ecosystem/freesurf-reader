/**
 * FreeSurf Natural Reader — TTS Service
 * Calls the Cloudflare Worker which proxies to RunPod Kokoro.
 * Full Kokoro-82M catalog: 41 voices across 9 languages.
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
  // ── American English (19) ──
  { id: "heart",   label: "Heart",   description: "American English · Female", voice: "af_heart",   language: "en-us" },
  { id: "bella",   label: "Bella",   description: "American English · Female", voice: "af_bella",   language: "en-us" },
  { id: "nicole",  label: "Nicole",  description: "American English · Female", voice: "af_nicole",  language: "en-us" },
  { id: "aoede",   label: "Aoede",   description: "American English · Female", voice: "af_aoede",   language: "en-us" },
  { id: "kore",    label: "Kore",    description: "American English · Female", voice: "af_kore",    language: "en-us" },
  { id: "sarah",   label: "Sarah",   description: "American English · Female", voice: "af_sarah",   language: "en-us" },
  { id: "nova",    label: "Nova",    description: "American English · Female", voice: "af_nova",    language: "en-us" },
  { id: "sky",     label: "Sky",     description: "American English · Female", voice: "af_sky",     language: "en-us" },
  { id: "alloy",   label: "Alloy",   description: "American English · Female", voice: "af_alloy",   language: "en-us" },
  { id: "river",   label: "River",   description: "American English · Female", voice: "af_river",   language: "en-us" },
  { id: "adam",    label: "Adam",    description: "American English · Male",   voice: "am_adam",    language: "en-us" },
  { id: "michael", label: "Michael", description: "American English · Male",   voice: "am_michael", language: "en-us" },
  { id: "santa",   label: "Santa",   description: "American English · Male",   voice: "am_santa",   language: "en-us" },
  { id: "fenrir",  label: "Fenrir",  description: "American English · Male",   voice: "am_fenrir",  language: "en-us" },
  { id: "puck",    label: "Puck",    description: "American English · Male",   voice: "am_puck",    language: "en-us" },
  { id: "echo",    label: "Echo",    description: "American English · Male",   voice: "am_echo",    language: "en-us" },
  { id: "eric",    label: "Eric",    description: "American English · Male",   voice: "am_eric",    language: "en-us" },
  { id: "liam",    label: "Liam",    description: "American English · Male",   voice: "am_liam",    language: "en-us" },
  { id: "onyx",    label: "Onyx",    description: "American English · Male",   voice: "am_onyx",    language: "en-us" },
  // ── British English (8) ──
  { id: "emma",     label: "Emma",     description: "British English · Female", voice: "bf_emma",     language: "en-gb" },
  { id: "isabella", label: "Isabella", description: "British English · Female", voice: "bf_isabella", language: "en-gb" },
  { id: "alice",    label: "Alice",    description: "British English · Female", voice: "bf_alice",    language: "en-gb" },
  { id: "lily",     label: "Lily",     description: "British English · Female", voice: "bf_lily",     language: "en-gb" },
  { id: "daniel",   label: "Daniel",   description: "British English · Male",   voice: "bm_daniel",   language: "en-gb" },
  { id: "george",   label: "George",   description: "British English · Male",   voice: "bm_george",   language: "en-gb" },
  { id: "fable",    label: "Fable",    description: "British English · Male",   voice: "bm_fable",    language: "en-gb" },
  { id: "lewis",    label: "Lewis",    description: "British English · Male",   voice: "bm_lewis",    language: "en-gb" },
  // ── Spanish (3) ──
  { id: "dora",      label: "Dora",      description: "Spanish · Female", voice: "ef_dora",      language: "es" },
  { id: "alex",      label: "Alex",      description: "Spanish · Male",   voice: "em_alex",      language: "es" },
  { id: "es_santa",  label: "Santa",     description: "Spanish · Male",   voice: "em_santa",     language: "es" },
  // ── French (1) ──
  { id: "siwis",   label: "Siwis",   description: "French · Female", voice: "ff_siwis",   language: "fr" },
  // ── Italian (2) ──
  { id: "sara",    label: "Sara",    description: "Italian · Female", voice: "if_sara",    language: "it" },
  { id: "nicola",  label: "Nicola",  description: "Italian · Male",   voice: "im_nicola",  language: "it" },
  // ── Portuguese (2) ──
  { id: "pt_dora",  label: "Dora",    description: "Portuguese · Female", voice: "pf_dora",    language: "pt" },
  { id: "pt_santa", label: "Santa",   description: "Portuguese · Male",   voice: "pm_santa",   language: "pt" },
  // ── German (1) ──
  { id: "anna",     label: "Anna",    description: "German · Female", voice: "df_anna",    language: "de" },
  // ── Hindi (3) ──
  { id: "alpha",    label: "Alpha",   description: "Hindi · Female", voice: "hf_alpha",   language: "hi" },
  { id: "omega",    label: "Omega",   description: "Hindi · Male",   voice: "hm_omega",   language: "hi" },
  { id: "psi",      label: "Psi",     description: "Hindi · Male",   voice: "hm_psi",     language: "hi" },
  // ── Japanese (2) ──
  { id: "jp_alpha", label: "Alpha",   description: "Japanese · Female", voice: "jf_alpha",   language: "ja" },
  { id: "jp_omega", label: "Omega",   description: "Japanese · Male",   voice: "jm_omega",   language: "ja" },
  // ── Polish (1) ──
  { id: "mateusz",  label: "Mateusz", description: "Polish · Male", voice: "pm_mateusz", language: "pl" },
];

export async function textToSpeech(
  text: string,
  voice = "af_heart",
  speed = 1.0
): Promise<string> {
  const res = await fetch(`${TTS_WORKER_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, speed }),
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
