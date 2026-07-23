/**
 * OpenRouter Voice Service
 * Free/low-cost TTS and STT via OpenRouter's model proxy.
 *
 * TTS: hexgrad/kokoro-82m ($0.62/M chars)
 * STT: qwen/qwen3-asr-flash ($0.126/hr), nvidia/parakeet-tdt-0.6b-v3 ($0.09/hr), deepgram/nova-3 ($0.258/hr)
 */

import axios from 'axios';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const API_KEY = process.env.OPENROUTER_CODING_KEY || '';

const getHeaders = () => ({
  Authorization: `Bearer ${API_KEY}`,
  'HTTP-Referer': 'https://oov.digital',
  'X-OpenRouter-Title': 'oov',
  'Content-Type': 'application/json',
});

export const OPENROUTER_TTS_MODELS = {
  kokoro: {
    id: 'hexgrad/kokoro-82m',
    label: 'Free (Kokoro)',
    price: '$0.62/M chars',
    languages: ['en', 'es', 'fr', 'hi', 'it', 'ja', 'pt', 'zh'],
    voices: 54,
  },
};

export const OPENROUTER_STT_MODELS = {
  default: {
    id: 'nvidia/parakeet-tdt-0.6b-v3',
    label: 'Free (NVIDIA Parakeet)',
    price: '$0.09/hr',
  },
};

/**
 * Generate speech from text using OpenRouter TTS.
 * Returns { audioBase64, format, generationId }
 */
export const openRouterTextToSpeech = async (text, options = {}) => {
  if (!API_KEY) {
    throw new Error('OPENROUTER_CODING_KEY is not configured.');
  }

  const model = options.model || 'hexgrad/kokoro-82m';
  const voice = options.voice || 'af_heart';

  try {
    const response = await axios.post(
      `${OPENROUTER_BASE}/audio/speech`,
      {
        model,
        input: text,
        voice,
      },
      {
        headers: getHeaders(),
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    const audioBase64 = Buffer.from(response.data).toString('base64');
    const generationId = response.headers['x-generation-id'] || null;
    const contentType = response.headers['content-type'] || 'audio/mp3';
    const format = contentType.includes('wav') ? 'wav' : contentType.includes('pcm') ? 'pcm' : 'mp3';

    return {
      success: true,
      audioBase64,
      format,
      generationId,
      model,
    };
  } catch (error) {
    const detail = error.response?.data
      ? Buffer.from(error.response.data).toString('utf8').substring(0, 200)
      : error.message;
    console.error('[OpenRouter TTS] Error:', detail);
    throw new Error(`OpenRouter TTS failed: ${detail}`);
  }
};

/**
 * Transcribe audio using OpenRouter STT.
 * Accepts { audioBase64, format, language } and returns { text, confidence, durationMs }
 */
export const openRouterSpeechToText = async (audioBase64, options = {}) => {
  if (!API_KEY) {
    throw new Error('OPENROUTER_CODING_KEY is not configured.');
  }

  const model = options.model || 'nvidia/parakeet-tdt-0.6b-v3';
  const language = options.language || 'en';
  const format = options.format || 'wav';

  // For STT, we send the audio as a data URL in the message
  const dataUrl = `data:audio/${format};base64,${audioBase64}`;

  try {
    const response = await axios.post(
      `${OPENROUTER_BASE}/chat/completions`,
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Transcribe this audio. Language: ${language}`,
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        max_tokens: 2048,
      },
      { headers: getHeaders(), timeout: 60000 }
    );

    const choice = response.data?.choices?.[0];
    const text = choice?.message?.content || '';
    const usage = response.data?.usage || {};

    return {
      success: true,
      text: text.trim(),
      model: response.data?.model || model,
      cost: usage?.cost || 0,
      audioDurationMs: usage?.audio_duration_ms || 0,
    };
  } catch (error) {
    const detail = error.response?.data?.error?.message || error.message;
    console.error('[OpenRouter STT] Error:', detail);
    throw new Error(`OpenRouter STT failed: ${detail}`);
  }
};

/**
 * Check if OpenRouter is configured and available.
 */
export const isOpenRouterConfigured = () => {
  return Boolean(API_KEY);
};

export default {
  OPENROUTER_TTS_MODELS,
  OPENROUTER_STT_MODELS,
  openRouterTextToSpeech,
  openRouterSpeechToText,
  isOpenRouterConfigured,
};
