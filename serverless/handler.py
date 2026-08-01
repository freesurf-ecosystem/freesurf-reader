"""
RunPod Serverless handler for Kokoro TTS.
Uses Kokoro directly as a Python library — no HTTP wrapper needed.

Expected input:  { "input": { "text": "...", "voice": "af_heart", "speed": 1.0 } }
Returns:         { "audio_base64": "..." }
"""
print("BOOT: handler.py starting", flush=True)

import base64
import io
import runpod
import traceback
import sys

try:
    import torch
    import soundfile as sf
    from kokoro import KPipeline

    print(f"CUDA available: {torch.cuda.is_available()}", flush=True)
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}", flush=True)
    print("All imports OK", flush=True)
except Exception:
    traceback.print_exc()
    sys.stderr.flush()
    raise

_pipelines = {}
SAMPLE_RATE = 24000


def get_pipeline(lang_code="a"):
    if lang_code not in _pipelines:
        _pipelines[lang_code] = KPipeline(lang_code=lang_code)
    return _pipelines[lang_code]


def handler(event):
    job_input = event.get("input", {})

    text = job_input.get("text", "")
    if not text:
        return {"error": "No text provided"}

    voice = job_input.get("voice", "af_heart")
    speed = job_input.get("speed", 1.0)

    lang_code = voice[0]

    try:
        pipeline = get_pipeline(lang_code)

        generator = pipeline(text, voice=voice, speed=speed)
        all_samples = []
        for _, _, audio in generator:
            all_samples.append(audio)

        if not all_samples:
            return {"error": "No audio generated"}

        import numpy as np
        audio_array = np.concatenate(all_samples)

        buf = io.BytesIO()
        sf.write(buf, audio_array, SAMPLE_RATE, format="WAV")
        buf.seek(0)

        return {"audio_base64": base64.b64encode(buf.read()).decode("utf-8")}

    except Exception as e:
        return {"error": f"TTS error: {str(e)}"}


if __name__ == "__main__":
    try:
        print("Pre-warming Kokoro pipeline...", flush=True)
        get_pipeline("a")
        print("Pipeline ready!", flush=True)
        runpod.serverless.start({"handler": handler})
    except Exception:
        traceback.print_exc()
        sys.stderr.flush()
        raise
