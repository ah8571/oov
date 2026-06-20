# TTS Options

## Goal
Choose a voice provider that sounds natural for real-time phone conversations in Emmaline.

## multilingual support [Gemini]

Advanced Speech-to-Text (STT) for Real-Time Code-Switching

The following modern APIs accept a streaming audio feed and dynamically transcribe multiple languages within the same session without requiring manual toggling:

Deepgram Flux Multilingual: Purpose-built specifically for live conversational AI voice agents. It handles up to 10 core languages in a single streaming session, adapting dynamically mid-stream as the conversation evolves, while maintaining ultra-low latency.

AssemblyAI Universal-Streaming: Capable of real-time code-switching across six major languages (English, Spanish, French, German, Italian, Portuguese). It handles language transitions in a single forward pass without delays, making it highly effective for mixed-language speech.

Soniox v5 Real-Time: Designed for messy, real-world live environments. It natively supports real-time speaker separation and automatically detects and tracks over 60 languages as they happen without losing transcription accuracy.

2. Text-to-Speech (TTS) with Multilingual Fluency
For the output side, standard TTS engines sound robotic or completely break down if text contains a foreign word. You need a single model variant that handles multiple languages fluently:

ElevenLabs Multilingual v2: Widely considered the gold standard for emotional, lifelike voice synthesis. A single voice profile can read text in 29+ languages flawlessly, maintaining the exact same voice persona, accent adjustments, and emotional tone across language changes. Standard ElevenLabs models (like Turbo v2 or Flash v2) are optimized purely for English. If they encounter Spanish, they will read the Spanish words using harsh, phonetic English rules (e.g., pronouncing "buenos" like "bway-nos").The Fix: You must explicitly pass eleven_multilingual_v2 or eleven_flash_v2_5 as the model_id. These models automatically detect the language transitions at a syllable level and switch pronunciation rules instantly

OpenAI GPT-4o Realtime API: If you want an all-in-one system, this natively combines STT, reasoning, and TTS into a single end-to-end network. It supports streaming audio in over 70 input languages and can instantly respond back with low-latency audio output, removing the need to stitch separate STT and TTS models together.

[User Audio Stream] 
       │
       ▼
[Student Audio: EN + ES mixed] 
               │
               ▼
   1. Deepgram Nova-3 (STT) ────► Parameter: language="multi"
               │
               ▼
   2. LLM Orchestrator (System Prompt) ──► Understands code-switching & context
               │
               ▼
   3. ElevenLabs Flash v2.5 (TTS) ────► Unified voice profile, ~75ms inference
               │
               ▼
 [Tutor Audio: EN + ES mixed]


