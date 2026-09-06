/**
 * Free Surf Natural Reader — Cloudflare Worker
 * Proxies TTS requests to RunPod Kokoro. Keeps API keys server-side.
 * Also provides PDF text extraction.
 */

export interface Env {
  POD_URL: string;
  OPENROUTER_API_KEY?: string;
  TOGETHER_API_KEY?: string;
  TOGETHER_TTS_VOICE?: string;
  // Usage metering (shared Free Surf Supabase). When these are set, TTS is gated by the
  // weekly free allowance. Without them, the app runs unmetered (existing behavior).
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  READER_WEEKLY_CHARS?: string;
}

const READER_METRIC = "reader_chars";
const DEFAULT_WEEKLY_CHARS = 30000;

// Monday (UTC) of the current week, as yyyy-mm-dd — weekly allowance bucket.
function weekStartIso(now: Date): string {
  const day = (now.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

function srHeaders(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY || "",
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || ""}`,
  };
}

// Resolve the signed-in user id from the Authorization Bearer token (Supabase auth).
async function authedUserId(env: Env, authHeader: string): Promise<string | null> {
  if (!authHeader.startsWith("Bearer ") || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authHeader },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data?.id || null;
  } catch {
    return null;
  }
}

async function readUsage(env: Env, userId: string, metric: string, week: string): Promise<number> {
  try {
    const q = new URLSearchParams({
      user_id: `eq.${userId}`, metric: `eq.${metric}`, week_start: `eq.${week}`, select: "count",
    });
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/usage?${q.toString()}`, { headers: srHeaders(env) });
    if (!res.ok) return 0;
    const rows = (await res.json()) as any[];
    return Number(rows?.[0]?.count) || 0;
  } catch {
    return 0;
  }
}

async function incrementUsage(env: Env, userId: string, metric: string, week: string, delta: number): Promise<number> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/meter_usage`, {
    method: "POST",
    headers: { ...srHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_metric: metric, p_week: week, p_delta: delta }),
  });
  if (!res.ok) return 0;
  const n = Number(await res.text());
  return Number.isFinite(n) ? n : 0;
}

// Metered only when Supabase is configured. Returns { ok, userId?, usage? } — when not
// configured this allows everything (keeps prod working until secrets are set).
async function gateTtsUsage(env: Env, request: Request, delta: number): Promise<{
  ok: boolean; userId?: string; usage?: { metric: string; used: number; limit: number; reset: string };
}> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) return { ok: true };
  const userId = await authedUserId(env, request.headers.get("Authorization") || "");
  if (!userId) return { ok: false, userId: undefined, usage: undefined }; // caller returns 401
  const week = weekStartIso(new Date());
  const limit = Math.max(0, Number(env.READER_WEEKLY_CHARS) || DEFAULT_WEEKLY_CHARS);
  const used = await readUsage(env, userId, READER_METRIC, week);
  if (used + delta > limit) {
    return { ok: false, userId, usage: { metric: READER_METRIC, used, limit, reset: week } };
  }
  await incrementUsage(env, userId, READER_METRIC, week, delta);
  const newUsed = used + delta;
  return { ok: true, userId, usage: { metric: READER_METRIC, used: newUsed, limit, reset: week } };
}

// Kokoro language→voice defaults (used when the client sends a language code).
const KOKORO_LANG_VOICE: Record<string, string> = {
  en: "af_heart", es: "ef_dora", fr: "ff_siwis", zh: "zf_xiaobei", ja: "jf_alpha",
};
// A small allowlist of valid Kokoro voice ids (avoids sending garbage to the API).
const KOKORO_VOICES = new Set([
  "af_heart","af_alloy","af_aoede","af_bella","af_jessica","af_kore","af_nicole","af_nova","af_river","af_sarah","af_sky",
  "am_adam","am_echo","am_eric","am_fenrir","am_liam","am_michael","am_onyx","am_puck","am_santa",
  "bf_alice","bf_emma","bf_isabella","bf_lily","bm_daniel","bm_fable","bm_george","bm_lewis",
  "jf_alpha","jf_gongitsune","jf_nezumi","jf_tebukuro","jm_kumo",
  "zf_xiaobei","zf_xiaoni","zf_xiaoxiao","zf_xiaoyi","zm_yunjian","zm_yunxi","zm_yunxia","zm_yunyang",
  "ef_dora","em_alex","em_santa","ff_siwis","hf_alpha","hf_beta","hm_omega","hm_psi","if_sara","im_nicola",
  "pf_dora","pm_alex","pm_santa",
]);

function pickKokoroVoice(voice: string | undefined, env: Env): string {
  const candidate = env.TOGETHER_TTS_VOICE || voice || "en";
  if (KOKORO_VOICES.has(candidate)) return candidate;
  const lang = String(candidate).toLowerCase();
  return KOKORO_LANG_VOICE[lang] || "af_heart";
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function ttsWithTogether(apiKey: string, text: string, voice: string): Promise<{ audio_base64: string }> {
  const res = await fetch("https://api.together.ai/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "hexgrad/Kokoro-82M", input: text, voice, response_format: "wav", sample_rate: 24000 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Together TTS error ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { audio_base64: bytesToBase64(bytes) };
}

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8081",
  "exp://",
  "https://freesurf.tools",
];

function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.some(
    (o) => origin === o || origin.startsWith("exp://") || origin.startsWith("http://localhost")
  );
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    // ── Usage meter (GET /api/usage) — how much of the weekly allowance is left ──
    if (request.method === "GET" && url.pathname === "/api/usage") {
      if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) {
        return jsonResponse({ error: "Usage metering not configured" }, 500, headers);
      }
      const userId = await authedUserId(env, request.headers.get("Authorization") || "");
      if (!userId) return jsonResponse({ error: "Unauthorized" }, 401, headers);
      const week = weekStartIso(new Date());
      const limit = Math.max(0, Number(env.READER_WEEKLY_CHARS) || DEFAULT_WEEKLY_CHARS);
      const used = await readUsage(env, userId, READER_METRIC, week);
      return jsonResponse(
        { usage: { metric: READER_METRIC, used, limit, reset: week } },
        200,
        headers
      );
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, headers);
    }

    try {
      // ── PDF Text Extraction ──────────────────────────────
      if (url.pathname === "/api/extract") {
        const body = (await request.json()) as { pdf_base64: string };
        if (!body.pdf_base64) {
          return jsonResponse({ error: "No PDF data provided" }, 400, headers);
        }

        const pdfBytes = Uint8Array.from(atob(body.pdf_base64), (c) =>
          c.charCodeAt(0)
        );

        // Use OpenRouter with a vision/general model to extract text from PDF
        // Fallback: basic text extraction from the PDF binary
        let text = "";
        const rawStr = new TextDecoder("utf-8", { fatal: false }).decode(pdfBytes);
        // Extract readable text segments from the PDF structure
        const textMatches = rawStr.match(/\(([^)]{3,})\)/g);
        if (textMatches && textMatches.length > 0) {
          text = textMatches
            .map((m) => m.slice(1, -1))
            .filter((s) => /[a-zA-Z]{3,}/.test(s))
            .join("\n");
        }

        if (!text.trim()) {
          // Try OpenRouter vision model as fallback
          if (env.OPENROUTER_API_KEY) {
            try {
              const orRes = await fetch(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "meta-llama/llama-4-maverick",
                    messages: [
                      {
                        role: "user",
                        content: [
                          {
                            type: "text",
                            text: "Extract all readable text from this document. Return only the extracted text, nothing else.",
                          },
                          {
                            type: "image_url",
                            image_url: {
                              url: `data:application/pdf;base64,${body.pdf_base64}`,
                            },
                          },
                        ],
                      },
                    ],
                    max_tokens: 4096,
                  }),
                }
              );

              if (orRes.ok) {
                const orData = (await orRes.json()) as {
                  choices?: { message?: { content?: string } }[];
                };
                text = orData.choices?.[0]?.message?.content?.trim() ?? "";
              }
            } catch {}
          }

          if (!text.trim()) {
            return jsonResponse(
              { error: "Could not extract text from this PDF. Try importing a .txt file instead." },
              400,
              headers
            );
          }
        }

        return jsonResponse({ text }, 200, headers);
      }

      // ── TTS ──────────────────────────────────────────────
      if (url.pathname === "/api/tts") {
        const body = (await request.json()) as {
          text: string;
          voice?: string;
          speed?: number;
        };

        if (!body.text?.trim()) {
          return jsonResponse({ error: "No text provided" }, 400, headers);
        }

        // Weekly free allowance gate (only active when Supabase metering is configured).
        const gate = await gateTtsUsage(env, request, body.text.length);
        if (!gate.ok) {
          if (gate.usage) {
            return jsonResponse(
              { error: "Weekly limit reached — upgrade or try again next week.", usage: gate.usage },
              429,
              headers
            );
          }
          return jsonResponse({ error: "Please sign in to use the reader." }, 401, headers);
        }

        // Hosted Together Kokoro path. Falls back to the pod when no key is set.
        if (env.TOGETHER_API_KEY) {
          const voice = pickKokoroVoice(body.voice, env);
          try {
            const out = await ttsWithTogether(env.TOGETHER_API_KEY, body.text, voice);
            return jsonResponse(out, 200, headers);
          } catch (e: unknown) {
            return jsonResponse({ error: e instanceof Error ? e.message : "TTS failed" }, 500, headers);
          }
        }

        const podRes = await fetch(env.POD_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_type: "tts",
            text: body.text,
            voice: body.voice || "af_heart",
            speed: body.speed || 1.0,
          }),
        });

        const podData = (await podRes.json()) as {
          audio_base64?: string;
          error?: string;
        };

        if (!podRes.ok || podData.error) {
          return jsonResponse({ error: podData.error || "TTS failed" }, podRes.status || 500, headers);
        }

        const audioBase64 = podData.audio_base64;
        if (!audioBase64) {
          return jsonResponse(
            { error: "No audio returned from TTS service" },
            500,
            headers
          );
        }

        return jsonResponse({ audio_base64: audioBase64 }, 200, headers);
      }

      return jsonResponse({ error: "Not found" }, 404, headers);
    } catch (e) {
      return jsonResponse({ error: "Internal server error" }, 500, headers);
    }
  },
};
