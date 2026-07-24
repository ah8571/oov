/**
 * Text-to-Speech Service
 * Converts text responses to audio using configurable providers.
 * Supported providers: google, openai, resemble, openrouter
 */

import textToSpeech from '@google-cloud/text-to-speech';
import axios from 'axios';
import { OpenAI } from 'openai';
import {
  getGoogleCloudClientOptions,
  hasGoogleCloudCredentials
} from './googleCloudAuth.js';
import { openRouterTextToSpeech, isOpenRouterConfigured } from './openRouterVoiceService.js';

const DEFAULT_PROVIDER = (process.env.TTS_PROVIDER || 'google').toLowerCase();
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'alloy';
const RESEMBLE_API_BASE_URL = process.env.RESEMBLE_API_BASE_URL || 'https://f.cluster.resemble.ai';
const RESEMBLE_VOICE_UUID = process.env.RESEMBLE_VOICE_UUID || '';
const RESEMBLE_PROJECT_UUID = process.env.RESEMBLE_PROJECT_UUID || '';

let ttsClient = null;
let openaiClient = null;

const getTtsClient = () => {
  if (ttsClient) {
    return ttsClient;
  }

  ttsClient = new textToSpeech.TextToSpeechClient(getGoogleCloudClientOptions());
  console.log('✓ Google Cloud Text-to-Speech client initialized');
  return ttsClient;
};

if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

const resolveProvider = (options = {}) => {
  return (options.provider || DEFAULT_PROVIDER).toLowerCase();
};

const textToAudioGoogle = async (text, options = {}) => {
  if (!hasGoogleCloudCredentials()) {
    throw new Error('Google Text-to-Speech credentials are not configured');
  }

  const client = getTtsClient();

  const {
    languageCode = 'en-US',
    voice = 'en-US-Neural2-C',
    audioEncoding = 'LINEAR16',
    sampleRateHertz,
    speakingRate
  } = options;

  const request = {
    input: { text },
    voice: {
      languageCode,
      name: voice
    },
    audioConfig: {
      audioEncoding,
      ...(speakingRate ? { speakingRate } : {}),
      ...(sampleRateHertz ? { sampleRateHertz } : {})
    }
  };

  const [response] = await client.synthesizeSpeech(request);
  return Buffer.from(response.audioContent);
};

const textToAudioOpenAI = async (text, options = {}) => {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Set OPENAI_API_KEY');
  }

  const model = options.model || OPENAI_TTS_MODEL;
  const voice = options.voice || OPENAI_TTS_VOICE;
  const responseFormat = options.responseFormat || 'wav';

  const response = await openaiClient.audio.speech.create({
    model,
    voice,
    input: text,
    response_format: responseFormat
  });

  const audioArrayBuffer = await response.arrayBuffer();
  return Buffer.from(audioArrayBuffer);
};

const textToAudioResemble = async (text, options = {}) => {
  const apiKey = process.env.RESEMBLE_API_KEY;

  if (!apiKey) {
    throw new Error('Resemble API key missing. Set RESEMBLE_API_KEY');
  }

  const voiceUuid = options.voiceUuid || RESEMBLE_VOICE_UUID;

  if (!voiceUuid) {
    throw new Error('Resemble voice UUID missing. Set RESEMBLE_VOICE_UUID');
  }

  const response = await axios.post(
    `${RESEMBLE_API_BASE_URL.replace(/\/$/, '')}/synthesize`,
    {
      voice_uuid: voiceUuid,
      data: text,
      ...(options.projectUuid || RESEMBLE_PROJECT_UUID ? { project_uuid: options.projectUuid || RESEMBLE_PROJECT_UUID } : {}),
      ...(options.title ? { title: options.title } : {}),
      output_format: options.outputFormat || 'mp3',
      sample_rate: String(options.sampleRate || 48000),
      ...(options.precision ? { precision: options.precision } : {}),
      ...(options.useHd !== undefined ? { use_hd: Boolean(options.useHd) } : {}),
      ...(options.applyCustomPronunciations !== undefined
        ? { apply_custom_pronunciations: Boolean(options.applyCustomPronunciations) }
        : {})
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip'
      }
    }
  );

  if (!response.data?.success || !response.data?.audio_content) {
    const issueText = Array.isArray(response.data?.issues) ? response.data.issues.join(' ') : '';
    throw new Error(issueText || 'Resemble did not return audio content.');
  }

  return Buffer.from(response.data.audio_content, 'base64');
};

const RUNPOD_KOKORO_ENDPOINT = process.env.RUNPOD_KOKORO_ENDPOINT || '';
const RUNPOD_API_KEY = process.env.RUNPOD_KEY || '';

const textToAudioRunPodKokoro = async (text, options = {}) => {
  if (!RUNPOD_KOKORO_ENDPOINT || !RUNPOD_API_KEY) {
    throw new Error('RunPod Kokoro is not configured. Set RUNPOD_KOKORO_ENDPOINT and RUNPOD_KEY.');
  }

  // Use Kokoro voice names (not the provider-agnostic config voice)
  const voice = 'af_heart';
  const response = await axios.post(
    `https://api.runpod.ai/v2/${RUNPOD_KOKORO_ENDPOINT}/runsync`,
    { input: { text, voice } },
    {
      headers: {
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }
  );

  const audioBase64 = response.data?.output?.audio_base64;
  if (!audioBase64) {
    const errorMsg = response.data?.output?.error || 'RunPod Kokoro did not return audio.';
    throw new Error(errorMsg);
  }

  return Buffer.from(audioBase64, 'base64');
};

const textToAudioOpenRouter = async (text, options = {}) => {
  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter is not configured. Set OPENROUTER_CODING_KEY.');
  }

  const result = await openRouterTextToSpeech(text, {
    model: options.model || 'hexgrad/kokoro-82m',
    voice: options.voice || 'af_heart',
    responseFormat: options.responseFormat || 'mp3',
  });

  if (!result.audioBase64) {
    throw new Error('OpenRouter did not return audio data.');
  }

  return Buffer.from(result.audioBase64, 'base64');
};

/**
 * Convert text to speech audio
 * @param {string} text - The text to convert to speech
 * @param {Object} options - Configuration options
 * @param {string} options.languageCode - Language code (default: 'en-US')
 * @param {string} options.voice - Voice name (default: 'en-US-Neural2-C')
 * @param {string} options.audioEncoding - Audio format (default: 'LINEAR16')
 * @returns {Promise<Buffer>} Audio data as buffer
 */
export const textToAudio = async (
  text,
  options = {}
) => {
  try {
    const provider = resolveProvider(options);
    console.log(`Converting to speech with ${provider}: "${text.substring(0, 50)}..."`);

    let audioBuffer;

    if (provider === 'google') {
      audioBuffer = await textToAudioGoogle(text, options);
    } else if (provider === 'openai') {
      audioBuffer = await textToAudioOpenAI(text, options);
    } else if (provider === 'resemble') {
      audioBuffer = await textToAudioResemble(text, options);
    } else if (provider === 'kokoro-runpod') {
      audioBuffer = await textToAudioRunPodKokoro(text, options);
    } else if (provider === 'openrouter') {
      audioBuffer = await textToAudioOpenRouter(text, options);
    } else {
      throw new Error(`Unsupported TTS provider: ${provider}`);
    }

    console.log(`✓ Generated audio (${audioBuffer.length} bytes)`);
    return audioBuffer;
  } catch (error) {
    console.error('Error converting text to speech:', error);
    throw error;
  }
};

/**
 * Get available voices for a language
 * @param {string} languageCode - Language code (default: 'en-US')
 * @returns {Promise<Array>} List of available voices
 */
export const getAvailableVoices = async (languageCode = 'en-US') => {
  try {
    if (DEFAULT_PROVIDER === 'google') {
      if (!hasGoogleCloudCredentials()) {
        throw new Error('Google Text-to-Speech credentials are not configured');
      }

      const client = getTtsClient();
      const request = { languageCode };
      const [response] = await client.listVoices(request);

      return response.voices.map(voice => ({
        provider: 'google',
        name: voice.name,
        ssmlGender: voice.ssmlGender,
        naturalSampleRateHertz: voice.naturalSampleRateHertz,
        languageCodes: voice.languageCodes
      }));
    }

    if (DEFAULT_PROVIDER === 'openai') {
      return [
        { provider: 'openai', name: 'alloy' },
        { provider: 'openai', name: 'ash' },
        { provider: 'openai', name: 'ballad' },
        { provider: 'openai', name: 'coral' },
        { provider: 'openai', name: 'echo' },
        { provider: 'openai', name: 'sage' },
        { provider: 'openai', name: 'shimmer' },
        { provider: 'openai', name: 'verse' }
      ];
    }

    if (DEFAULT_PROVIDER === 'resemble') {
      return [{
        provider: 'resemble',
        name: 'Configured Resemble voice',
        voiceUuid: RESEMBLE_VOICE_UUID || null,
      }];
    }

    throw new Error(`Unsupported TTS provider: ${DEFAULT_PROVIDER}`);
  } catch (error) {
    console.error('Error getting available voices:', error);
    throw error;
  }
};

/**
 * Stream text to speech audio
 * Yields audio chunks as they're generated
 * @param {string} text - The text to convert
 * @param {Object} options - Configuration options
 * @yields {Buffer} Audio chunks
 */
export const streamTextToAudio = async function* (
  text,
  options = {}
) {
  try {
    const audioBuffer = await textToAudio(text, options);
    yield audioBuffer;
  } catch (error) {
    console.error('Error streaming audio:', error);
    throw error;
  }
};

export default {
  resolveProvider,
  textToAudio,
  getAvailableVoices,
  streamTextToAudio,
  getTtsClient
};
