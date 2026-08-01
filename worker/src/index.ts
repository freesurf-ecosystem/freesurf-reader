/**
 * FreeSurf Natural Reader — Cloudflare Worker
 * Proxies TTS requests to RunPod Kokoro. Keeps API keys server-side.
 * Also provides PDF text extraction.
 */

export interface Env {
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
  OPENROUTER_API_KEY?: string;
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

        const runpodRes = await fetch(
          `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/runsync`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                text: body.text,
                voice: body.voice || "af_heart",
                speed: body.speed || 1.0,
                response_format: "mp3",
              },
            }),
          }
        );

        const runpodData = (await runpodRes.json()) as {
          output?: { audio_base64?: string };
          error?: string;
        };

        if (runpodData.error) {
          return jsonResponse({ error: runpodData.error }, 500, headers);
        }

        const audioBase64 = runpodData.output?.audio_base64;
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
