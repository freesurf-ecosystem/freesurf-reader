# FreeSurf Reader

Text-to-speech that respects your privacy. No account required. No data stored on servers.

Paste or import any text, choose from 20 natural voices across 9 languages, and listen instantly. Audio is generated on your device — nothing is saved, tracked, or logged.

## Why it's free

The reader uses [Kokoro TTS](https://github.com/remsky/Kokoro-FastAPI), a self-hosted AI model running on our own GPU infrastructure. No per-request API fees to third-party providers. The app is supported by minimal, non-intrusive ads. Subscription removes ads.

## Privacy

- No account or login required
- Audio generated on-device after model inference
- Nothing stored on our servers — audio plays once and is gone
- Text you paste never leaves the app except for the TTS request

## Features

- 20 natural voices (American, British, Spanish, French, Italian, Portuguese, German, Hindi, Polish)
- Adjustable playback speed (0.75x–1.5x)
- Seek, jump, and progress tracking
- Import PDF and TXT files
- Save recordings locally for replay

## Tech

- **Mobile:** React Native (Expo)
- **Backend:** Cloudflare Worker
- **TTS:** Kokoro TTS on RunPod GPU (self-hosted)
- **No OpenAI, no Google, no third-party API dependencies**

[Privacy Policy](https://freesurf.tools/privacy) · [Terms](https://freesurf.tools/terms)
