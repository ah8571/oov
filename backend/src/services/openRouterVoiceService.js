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
        timeout: 60000,
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
 * Transcribe audio using OpenRouter STT (OpenAI-compatible /audio/transcriptions).
 */
export const openRouterSpeechToText = async (audioBuffer, options = {}) => {
  if (!API_KEY) {
    throw new Error('OPENROUTER_CODING_KEY is not configured.');
  }

  const model = options.model || 'nvidia/parakeet-tdt-0.6b-v3';
  const language = options.language || 'en';
  const format = options.format || 'mp3';
  const mimeType = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;

  // Use native FormData (Node 22+) and fetch for proper multipart upload
  const formData = new FormData();
  formData.append('model', model);
  formData.append('language', language);
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), `audio.${format}`);

  try {
    const response = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://oov.digital',
        'X-OpenRouter-Title': 'oov',
      },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(errText.substring(0, 200));
    }

    const data = await response.json();

    return {
      success: true,
      text: (data?.text || '').trim(),
      model: data?.model || model,
    };
  } catch (error) {
    const detail = error.message || 'Unknown error';
    console.error('[OpenRouter STT] Error:', detail.substring(0, 200));
    throw new Error(`OpenRouter STT failed: ${detail.substring(0, 100)}`);
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
