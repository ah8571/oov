/**
 * OpenRouter Voice Service
 */

import axios from 'axios';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const API_KEY = process.env.OPENROUTER_CODING_KEY || '';

const getHeaders = (extra = {}) => ({
  Authorization: `Bearer ${API_KEY}`,
  'HTTP-Referer': 'https://oov.digital',
  'X-OpenRouter-Title': 'oov',
  ...extra,
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
        response_format: 'mp3',
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
 * Transcribe audio using OpenRouter STT (OpenAI-compatible transcriptions endpoint).
 */
export const openRouterSpeechToText = async (audioBuffer, options = {}) => {
  if (!API_KEY) {
    throw new Error('OPENROUTER_CODING_KEY is not configured.');
  }

  const model = options.model || 'nvidia/parakeet-tdt-0.6b-v3';
  const language = options.language || 'en';
  const format = options.format || 'mp3';

  try {
    // Build a multipart form using a boundary
    const boundary = `----FormBoundary${Date.now()}`;
    const filename = `audio.${format}`;
    const contentType = `audio/${format === 'mp3' ? 'mpeg' : format}`;

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="model"\r\n\r\n`),
      Buffer.from(`${model}\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="language"\r\n\r\n`),
      Buffer.from(`${language}\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
      Buffer.from(`Content-Type: ${contentType}\r\n\r\n`),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const response = await axios.post(
      `${OPENROUTER_BASE}/audio/transcriptions`,
      body,
      {
        headers: getHeaders({
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        }),
        timeout: 60000,
      }
    );

    return {
      success: true,
      text: (response.data?.text || '').trim(),
      model: response.data?.model || model,
    };
  } catch (error) {
    const detail = error.response?.data?.text
      || (typeof error.response?.data === 'string' ? error.response.data.substring(0, 200) : null)
      || error.response?.data?.error?.message
      || error.message;
    console.error('[OpenRouter STT] Error:', typeof detail === 'string' ? detail.substring(0, 200) : detail);
    throw new Error(`OpenRouter STT failed: ${typeof detail === 'string' ? detail.substring(0, 100) : 'Provider error'}`);
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
