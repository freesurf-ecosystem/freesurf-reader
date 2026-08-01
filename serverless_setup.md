# RunPod Serverless Setup — FreeSurf Natural Reader (Kokoro TTS)

Self-hosted GPU text-to-speech via Kokoro TTS on RunPod.

## Architecture

```
Mobile App → Cloudflare Worker (reader.freesurf.tools) → RunPod Serverless (GPU)
                                                           └─ Kokoro KPipeline
```

## Build & Push

```bash
cd serverless
docker build -t freesurf-reader-kokoro:latest .
docker tag freesurf-reader-kokoro:latest <registry>/freesurf-reader-kokoro:latest
docker push <registry>/freesurf-reader-kokoro:latest
```

The Kokoro model (~82M params) is pre-downloaded at build time, so cold starts skip HuggingFace.

## Create RunPod Serverless Endpoint

1. Go to https://www.runpod.io/console/serverless → New Endpoint
2. **Template**: select your pushed Docker image
3. **GPU**: 24GB tier (L4 / A5000 / 3090 at ~$0.69/hr)
4. **Min workers**: 0, **Max workers**: 3
5. **Idle timeout**: 60 seconds
6. **FlashBoot**: enabled
7. Note the **Endpoint ID** (e.g., `abc123def456`)

## Deploy Cloudflare Worker

```bash
cd worker
npm install
npx wrangler secret put RUNPOD_API_KEY
npx wrangler secret put RUNPOD_ENDPOINT_ID
npx wrangler deploy
```

## Performance

| State | Latency |
|---|---|
| Warm request | ~2-5s |
| Cold start (container boot + model load) | ~10-15s |

## Pricing

~$0.0006 per paragraph. ~$5-10/month for modest usage on 24GB GPU tier.

## Troubleshooting

- **espeak-ng errors**: Ensure espeak-ng and libespeak-ng-dev are installed in the Dockerfile
- **CUDA not available**: Verify GPU tier has CUDA drivers (L4, A5000, 3090 all do)
- **HuggingFace download on cold start**: Means model wasn't cached at build time — check `RUN python3 -c "from kokoro import KPipeline; KPipeline(lang_code='a')"` runs successfully during build
- **Worker returns RunPod error**: Check `wrangler secret list` to verify RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are set
