# Credit Model

*Last updated: 2026-07-15*

## Overview

Emmaline uses a **credit system** to unify usage across all AI-powered modes. Users receive a base allocation of free credits, and Pro subscribers receive monthly credits with rollover. Credits are consumed at different rates depending on the mode, reflecting the underlying provider costs.

## Rate Card (user-facing)

| Mode | Credits per minute | Notes |
|---|---|---|
| **Voice Mode** (OpenAI Realtime) | 5 credits | Full-duplex AI conversation |
| **Reader — Natural Voice** (Resemble / ElevenLabs) | 2 credits | Premium TTS narration |
| **Reader — Basic** (device TTS) | 0 credits | Falls back to phone's built-in voice |
| **Listen Mode** (Google STT + AI) | 1 credit | Transcription and AI processing |

## Rate Card (internal costs)

| Mode | Provider | Our cost/min | Credit cost/min | Implied margin |
|---|---|---|---|---|
| Voice Mode | OpenAI Realtime | ~$0.17 | 5 credits ($0.50) | ~3x |
| Reader Natural | Resemble / ElevenLabs | ~$0.05–0.10 | 2 credits ($0.20) | ~2–5x |
| Listen Mode | Google STT + OpenAI chat | ~$0.03 | 1 credit ($0.10) | ~3x |
| Reader Basic | Device-local | $0.00 | 0 credits | N/A |

*Costs estimated at OpenAI Realtime $0.06 input + $0.24 output per minute (~40/60 split), Google STT $0.016/min, Resemble per-character pricing. Actual costs tracked via `call_costs` and `credit_transactions` tables.*

### Alternative to real time voice mode:

"Option A" Grok's realtime voice supposedly half price of OpenAI

Deepgram AI, Nova 2.0 Sonic, Gemini 2.5 Flash NativeAudio Dialog (Thinking)

"Option B" — split STT from the rest of the stack. We'd use:

Deepgram or Google STT for transcription
OpenAI GPT-4o-mini for the AI response (cheap, fast)
ElevenLabs or Resemble for TTS output

## Tiers

### Free Tier
- **20 credits** one-time grant on account creation
- Enough to try: ~2 min Voice Mode + 4 min Reader Natural + 10 min Listen Mode
- Reader Basic (device TTS) always available at no credit cost
- No monthly renewal

### Pro Tier ($9.99/mo)
- **100 credits per month** with rollover
- Unused credits roll over to the next month (capped at 2x monthly allocation = 200 max)
- Additional credits can be purchased (future)
- All modes available

## Rollover Rules
- On monthly renewal: `new_balance = 100 + min(previous_balance, 100)`
- Effect: unused credits carry forward, but you can never have more than 200 at renewal
- Free tier credits never expire



---

# API Provider Research


## Decision Framework

Compare providers on:

- voice quality
- latency
- interruption handling and barge-in
- multilingual support, especially English and Spanish in one product
- real-time streaming support
- pricing transparency
- operational complexity
- privacy and compliance posture
- mobile integration friction
- future flexibility for phone and text expansion

## Provider Shortlist

### Direct providers
- OpenAI: best first test for in-app voice mode because it can unify speech, reasoning, and reply audio in one loop.
- Google: strongest direct comparison for voice mode and STT if we want a broader speech platform option.
- Deepgram: strong STT benchmark if we intentionally split transcription from the rest of the stack.
- AssemblyAI: secondary STT comparison vendor.
- Soniox: niche STT benchmark if noisy multilingual speech becomes a blocker.

### Packaged voice-agent vendors
- Retell: strongest packaged benchmark if direct orchestration feels too slow to build.
- Vapi: useful abstraction layer for fast experiments across multiple underlying providers.
- Bland: more relevant for future external phone-agent workflows than in-app voice mode.
- Hume: future UX benchmark if expressive or affect-aware voice becomes important.

## Product Mapping

### In-app Voice Mode
Rename product thinking from live call to voice mode.

Recommended evaluation order:
1. OpenAI Realtime API (current implementation — WebRTC) (price for lower models unclear
2. xAI Grok Voice Agent API (WebSocket — API-compatible, ~half the cost)
3. Inworld
5. Gemini 3.1 Flash Live 
5. Azure Voice Live api: https://azure.microsoft.com/en-us/pricing/details/speech/
6. Amazon Nova Sonic (Listed on livekit)
7. NVIDIA PersonaPlex (Listed on livekit)
8. Phonic Speech-to-speech (Listed on livekit)
assembly ai 4.5 per hr (from their website: https://www.assemblyai.com/blog/assemblyai-voice-agent-api-vs-openai-realtime-api)
9. Ultravox Realtime (open-source) (3$ per minute)

For more voice affordability look into: 
https://openrouter.ai/openai/gpt-audio-mini

Livekit 50 per month paired with another model above like grok could be more affordable

"Modular Chained Stacks: You can build a cheaper custom stack by pairing an open-source model (like Llama via OpenRouter) with specialized live STT/TTS providers like Deepgram or Cartesia" - google.com/ai


### Natural Voices (TTS)
Recommended evaluation order:
1. ElevenLabs
Alternatives to Elevanlabs
2. Chatterbox w/ Resemble [need usage estimate]
3. Google TTS / Vertex AI
2. Fish Audio
3. PlayHT
4. Cartesia
6. Noiz.ai
7. Deepgram AI
4. Nova 2.0 Sonic

low cost models

Self-hosted providers

podtts (need to find the correct name)
StyleTTS 2 [for long form content]
ChatTTS
XTTS v2 by Coqui
RunPod hosting 

### LLM Summaries

Gemini 1.5 Flash

Self hosted
LLama 3.1 8B (deepinfra, openrouter) -





### STT Real-Time Transcription
Recommended evaluation order:
1. Google
2. Deepgram
3. AssemblyAI
4. Soniox

low cost models 
x-ai/grok-stt-1.0 .10 per hour
qwen/qwen3-asr-flash-2026-02-10 .126 per hour
nvidia/parakeet-tdt-0.6b-v3 .09 per hour
deepgram/nova-3 .258 per hour
mistralai/voxtral-mini-transcribe .18 per hour

Self hosted models
Faster Whisper Large-v3 / Insanely Fast Whisper 

Groq's Whisper
Assembly (.0025 per minute)
Gladia (.0033 per minute) - has in built speaker identification / summarization



On Device
Use iOS SFSpeechRecognizer
Android SpeechRecognizer


### Load testing

Utilize an open-source tool like Locust or K6 to simulate hundreds of virtual users hitting your RunPod endpoints simultaneously. Run two distinct scenarios:The Spike Test: Send 100 simultaneous transcription requests to observe how quickly RunPod spins up new GPU instances (cold-start handling).

Implement Concurrent Execution limits
By default, a serverless container processes one request at a time. If 5 users hit your endpoint, RunPod boots up 5 separate GPUs, increasing your costs.The Fix: Use Python frameworks like Asyncio or vLLM to configure your backend container to handle multiple lightweight TTS requests (e.g., 3 to 5 tasks) concurrently on a single GPU.

## Twilio Positioning

Twilio should be treated as a future external communications layer, not the main in-app voice-mode stack.

Best future Twilio use cases:
- direct phone calls to an agent
- direct texting to an agent
- PSTN connectivity and number-based experiences

# Provider research

### Grok Voice Agent (xAI) — Alternative to OpenAI Realtime

- **Docs:** https://docs.x.ai/developers/model-capabilities/audio/voice

---

# Kokoro TTS (On-Device + Self-Hosted)

*Last updated: 2026-07-24*

## Overview

Kokoro-82M is an open-source TTS model (~82M params, Apache 2.0) from Hugging Face. It runs on-device via `react-native-executorch` (XNNPACK/CPU only) and can also be self-hosted on GPU for near real-time performance.

## Performance

| Mode | Speed (paragraph) | Speed (20k chars) | Cost |
|---|---|---|---|
| On-device (phone CPU) | ~80-90s (~250ms/char) | ~83 min | $0 |
| Self-hosted GPU (RunPod) | ~2-5s | ~15-20s | ~$0.0006/paragraph |

## Voice Catalog — 9 Languages, 20 Voices

### American English (`en-us`) — 6 voices
| Voice | Gender | File |
|---|---|---|
| heart | Female | `af_heart.bin` |
| river | Female | `af_river.bin` |
| sarah | Female | `af_sarah.bin` |
| adam | Male | `am_adam.bin` |
| michael | Male | `am_michael.bin` |
| santa | Male | `am_santa.bin` |

### British English (`en-gb`) — 2 voices
| Voice | Gender | File |
|---|---|---|
| emma | Female | `bf_emma.bin` |
| daniel | Male | `bm_daniel.bin` |

### French (`fr`) — 1 voice
| Voice | Gender | File |
|---|---|---|
| siwis | Female | `ff_siwis.bin` |

### Spanish (`es`) — 2 voices
| Voice | Gender | File |
|---|---|---|
| dora | Female | `ef_dora.bin` |
| alex | Male | `em_alex.bin` |

### Italian (`it`) — 2 voices
| Voice | Gender | File |
|---|---|---|
| sara | Female | `if_sara.bin` |
| nicola | Male | `im_nicola.bin` |

### Portuguese (`pt`) — 2 voices
| Voice | Gender | File |
|---|---|---|
| dora | Female | `pf_dora.bin` |
| santa | Male | `pm_santa.bin` |

### Hindi (`hi`) — 3 voices
| Voice | Gender | File |
|---|---|---|
| alpha | Female | `hf_alpha.bin` |
| omega | Male | `hm_omega.bin` |
| psi | Male | `hm_psi.bin` |

### Polish (`pl`) — 1 voice (fine-tuned model)
| Voice | Gender | File |
|---|---|---|
| mateusz | Male | `pm_mateusz.bin` |

### German (`de`) — 1 voice (fine-tuned model)
| Voice | Gender | File |
|---|---|---|
| anna | Female | `df_anna.bin` |

## Self-Hosting: RunPod Serverless Integration Plan

### Why RunPod Serverless
- Pay per GPU-second, zero idle costs
- Cheapest 24GB GPU: $0.69/hr ($0.00019/sec)
- Kokoro-82M only needs ~3GB VRAM → minimal GPU time
- Estimated cost: ~$0.0006 per paragraph, ~$5-10/month for modest usage

### Architecture
```
Mobile App → DO Backend (proxy) → RunPod Serverless (Kokoro-FastAPI worker)
                                           ↓
                                   GPU inference (~3 sec)
                                           ↓
                                   Return WAV/MP3
```

### Deployment Steps (Kokoro-FastAPI on RunPod)

1. **Use Kokoro-FastAPI** (`remsky/Kokoro-FastAPI` on GitHub) — prebuilt Dockerized FastAPI wrapper with OpenAI-compatible speech endpoint, streaming, multi-language, voice mixing.

2. **Create Dockerfile** — based on `nvidia/cuda` image with PyTorch:
   ```dockerfile
   FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04
   # Install Python, clone Kokoro-FastAPI, install deps
   # Entry: uvicorn or python handler
   ```

3. **Create RunPod handler** (`handler.py`):
   ```python
   import runpod
   # Load Kokoro model at module level (cached between requests)
   # handler(event): extract text from event['input'], generate audio, return base64
   runpod.serverless.start({'handler': handler})
   ```

4. **Deploy to RunPod**:
   - Push Docker image to Docker Hub or use GitHub integration
   - Create Serverless endpoint (Queue type)
   - Select GPU: 24GB tier (L4/A5000/3090 at $0.69/hr)
   - Set `workersMin: 0`, `workersMax: 3`, `idleTimeout: 60`
   - Enable FlashBoot for faster cold starts if using cached models

5. **Backend proxy** (in `backend/src/routes/reader.js`):
   - Add `kokoro-server` provider option
   - POST text to RunPod endpoint URL
   - Stream or return audio to mobile client

### Cold Start Strategy
- Cold start: ~10-15s (container boot + model load)
- Warm requests: ~2-5s
- Option: keep 1 warm worker ($0.69/hr = ~$16/day) if traffic warrants
- Or: use RunPod's model caching to reduce cold start to ~5s



### Gemini Live (Google) — WebSocket Voice + LiveKit Plugin

- **Docs:** https://ai.google.dev/gemini-api/docs/live-api
- **WebSocket quickstart:** https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket
- **Ephemeral tokens:** https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- **LiveKit plugin:** https://docs.livekit.io/agents/models/realtime/plugins/gemini/
- **Voices:** https://ai.google.dev/gemini-api/docs/live#change-voices
- **Pricing (Gemini 3.1 Flash Live):** ~$0.005 input + $0.018 output per minute ≈ **$0.023/min** (~1/3 of Grok, ~1/7 of OpenAI)
- **API key / Billing:** https://aistudio.google.com/apikey
- **Model:** `gemini-3.1-flash-live-preview` (confirmed via LiveKit docs)
- **Protocol:** WebSocket (WSS), raw PCM 16-bit
- **Technical specs:**
  - Input: 16kHz 16-bit little-endian PCM (different from Grok's 24kHz)
  - Output: 24kHz 16-bit little-endian PCM
  - Built-in VAD (server-side, no client VAD config needed)
  - Barge-in supported natively
  - 70+ languages including Spanish
  - Function calling / tool use via `tools` config
  - Video input supported (≤1 FPS JPEG)
- **Auth:** API key via `?key=` query param on WebSocket URL. Google recommends ephemeral tokens (via `/v1beta/models/{model}:generateEphemeralToken` over REST) for production to avoid exposing raw keys client-side.
- **Message format (WebSocket):**
  - Setup: `{"setup": {"model": "models/...", "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {...}}}}`
  - Audio input: `{"realtimeInput": {"mediaChunks": [{"mimeType": "audio/pcm;rate=16000", "data": base64}]}}`
  - Audio output: `serverContent.modelTurn.parts[].inlineData.data` (base64)
  - Text input: `{"clientContent": {"turns": [{"role": "user", "parts": [{"text": "..."}]}], "turnComplete": true}}`
- **LiveKit plugin notes (⚠️ for 3.1):**
  - Gemini 3.1 Flash Live has known LiveKit compatibility limitations as of 2026-07
  - `send_client_content` only works for initial history seeding — rejected after first model turn
  - `generate_reply()`, `update_instructions()`, `update_chat_ctx()` incompatible with 3.1
  - Basic voice conversations, tool calling, and audio I/O work fine
  - LiveKit plugin uses `GOOGLE_API_KEY` env var; also supports Vertex AI
- **Our integration:** ✅ Built — WebSocket direct (no LiveKit layer). API key passed via backend route for auth. Input at 16kHz via PcmCaptureModule, output at 24kHz via expo-av WAV playback.
- **LiveKit upgrade path:** Could migrate to LiveKit agent later for WebRTC-quality audio. LiveKit plugin handles the protocol bridge; we'd run a LiveKit Agent process that speaks WebRTC to the phone and Gemini WebSocket internally.

### LiveKit — WebRTC Transport Layer (not a model provider)

- **Docs:** https://docs.livekit.io/
- **Voice AI quickstart:** https://docs.livekit.io/agents/start/voice-ai/
- **Gemini plugin:** https://docs.livekit.io/agents/models/realtime/plugins/gemini/
- **Grok/xAI integration:** https://docs.livekit.io/agents/integrations/xai/; https://docs.livekit.io/agents/models/realtime/plugins/xai/
- **Pricing:** LiveKit Cloud free tier available; paid plans scale with usage. Self-host open-source option.
- **Role:** Open-source WebRTC platform — acts as middleware between mobile SDK and AI model backends
- **Value proposition:**
  - Production-quality WebRTC (Opus codec, jitter buffer, echo cancellation, packet loss concealment)
  - One mobile SDK (`livekit-react-native`) replaces our hand-rolled PCM pipeline
  - Agent framework for bridging WebRTC ↔ WebSocket model providers
  - Built-in turn detection, STT, TTS plugins
  - Would give Grok/Gemini the same audio quality as OpenAI without model-specific code
- **Architecture pattern:** Phone ↔ WebRTC ↔ LiveKit Server ↔ Agent Process ↔ WebSocket ↔ AI Model
- **Tradeoffs:**
  - Adds server infrastructure (LiveKit server + agent process)
  - Another dependency in the stack
  - 3.1 Flash Live compatibility still evolving
  - Would still need OpenAI Realtime path (not needed, OpenAI already has native WebRTC)

### Inworld — Packaged Voice Agent Platform (TTS + STT + LLM Router)

- **Docs:** https://docs.inworld.ai/
- **API reference:** https://docs.inworld.ai/api-reference/introduction
- **Pricing:** https://inworld.ai/pricing
- **Models (Realtime Router):** https://inworld.ai/models
- **Real-time API:** https://docs.inworld.ai/realtime/overview
- **Pricing breakdown (per-minute estimate):**
  - Realtime TTS-2: $9–25 per 1M characters (~$0.009–0.025/min at ~1000 chars/min)
  - Realtime STT 1: $0.10–0.15 per hour (~$0.0017–0.0025/min)
  - LLMs: billed "at cost" through their Router (220+ models including GPT-4o, Gemini, Claude)
  - Combined estimate: ~$0.03–0.06/min depending on LLM choice and plan tier
  - Plans: On-Demand (free tier with 70min TTS), Creator ($25/mo), Builder ($100), Developer ($300), Growth ($1500), Enterprise (custom)
- **Protocol:** WebRTC (real-time API)
- **Key features:**
  - Voice cloning & voice design (TTS-2)
  - 100+ languages for TTS-2, 15 for TTS 1.5
  - Instant voice cloning (TTS-2)
  - 220+ LLM models via Router (you pick the brain, they handle the voice)
  - WebRTC transport (same quality tier as OpenAI)
- **Tradeoffs:**
  - Not a single voice model — it's an orchestration layer (you pick STT + LLM + TTS independently)
  - LLM costs are separate and passed through "at cost" — the 3¢ figure is TTS only
  - More moving parts to configure and debug
  - Credit system similar to ours may create confusing double-billing
  - GDPR, SOC 2 Type II; HIPAA available as add-on
- **Our assessment:** Interesting for the WebRTC quality + model flexibility, but the pricing isn't meaningfully cheaper than Grok direct. The value is in the packaged WebRTC transport, not the per-minute savings.

