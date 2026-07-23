/**
 * Google Cloud Speech-to-Text Service
 * Handles real-time transcription of audio streams
 */

import speech from '@google-cloud/speech';
import { OpenAI, toFile } from 'openai';
import {
  getGoogleCloudClientOptions,
  hasGoogleCloudCredentials
} from './googleCloudAuth.js';
import { openRouterSpeechToText, isOpenRouterConfigured, OPENROUTER_STT_MODELS } from './openRouterVoiceService.js';

let speechClient = null;
let openaiClient = null;

const LANGUAGE_CONFIGS = {
  en: {
    languageCode: 'en-US',
    alternativeLanguageCodes: [],
    speechContexts: [
      'reminder', 'note', 'todo', 'schedule', 'call', 'email',
      'meeting', 'project', 'task', 'follow up', 'action item'
    ]
  },
  es: {
    languageCode: 'es-US',
    alternativeLanguageCodes: [],
    speechContexts: [
      'recordatorio', 'nota', 'tarea', 'agenda', 'llamar', 'correo',
      'reunion', 'proyecto', 'seguimiento', 'accion'
    ]
  },
  pt: {
    languageCode: 'pt-BR',
    alternativeLanguageCodes: [],
    speechContexts: [
      'lembrete', 'nota', 'tarefa', 'agenda', 'ligar', 'email',
      'reuniao', 'projeto', 'acompanhamento', 'acao'
    ]
  },
  fr: {
    languageCode: 'fr-FR',
    alternativeLanguageCodes: [],
    speechContexts: [
      'rappel', 'note', 'tache', 'agenda', 'appel', 'email',
      'reunion', 'projet', 'suivi', 'action'
    ]
  },
  de: {
    languageCode: 'de-DE',
    alternativeLanguageCodes: [],
    speechContexts: [
      'erinnerung', 'notiz', 'aufgabe', 'plan', 'anruf', 'e-mail',
      'besprechung', 'projekt', 'nachverfolgung', 'aktion'
    ]
  },
  it: {
    languageCode: 'it-IT',
    alternativeLanguageCodes: [],
    speechContexts: [
      'promemoria', 'nota', 'attivita', 'agenda', 'chiamata', 'email',
      'riunione', 'progetto', 'seguito', 'azione'
    ]
  },
  zh: {
    languageCode: 'cmn-Hans-CN',
    alternativeLanguageCodes: [],
    speechContexts: [
      'beiwanglu', 'biji', 'renwu', 'rili', 'dianhua', 'youjian',
      'huiyi', 'xiangmu', 'genjin', 'xingdong'
    ]
  },
  hi: {
    languageCode: 'hi-IN',
    alternativeLanguageCodes: [],
    speechContexts: [
      'yaad', 'note', 'kaam', 'schedule', 'call', 'email',
      'meeting', 'project', 'follow up', 'action item'
    ]
  },
  ar: {
    languageCode: 'ar-XA',
    alternativeLanguageCodes: [],
    speechContexts: [
      'tadhkir', 'mulahaza', 'muhimma', 'jadwal', 'ittisal', 'barid',
      'ijtima', 'mashru', 'mutabaea', 'ijra'
    ]
  },
  ja: {
    languageCode: 'ja-JP',
    alternativeLanguageCodes: [],
    speechContexts: [
      'memo', 'noto', 'task', 'schedule', 'call', 'email',
      'meeting', 'project', 'follow up', 'action item'
    ]
  }
};

export const resolveLanguagePreference = (languagePreference) => {
  const value = String(languagePreference || '').trim().toLowerCase();

  if (value.startsWith('es')) {
    return 'es';
  }

  if (value.startsWith('pt')) {
    return 'pt';
  }

  if (value.startsWith('fr')) {
    return 'fr';
  }

  if (value.startsWith('de')) {
    return 'de';
  }

  if (value.startsWith('it')) {
    return 'it';
  }

  if (value.startsWith('zh')) {
    return 'zh';
  }

  if (value.startsWith('hi')) {
    return 'hi';
  }

  if (value.startsWith('ar')) {
    return 'ar';
  }

  if (value.startsWith('ja')) {
    return 'ja';
  }

  return 'en';
};

const getLanguageConfig = (languagePreference) => {
  return LANGUAGE_CONFIGS[resolveLanguagePreference(languagePreference)] || LANGUAGE_CONFIGS.en;
};

const getSpeechClient = () => {
  if (speechClient) {
    return speechClient;
  }

  speechClient = new speech.SpeechClient(getGoogleCloudClientOptions());
  return speechClient;
};

const getOpenAIClient = () => {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured for uploaded audio transcription');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
};

/**
 * Streaming recognition request configuration
 */
const getStreamingRecognizeConfig = (options = {}) => {
  const languageConfig = getLanguageConfig(options.languagePreference);

  return {
    config: {
      encoding: 'MULAW',
      sampleRateHertz: 8000,
      languageCode: languageConfig.languageCode,
      ...(languageConfig.alternativeLanguageCodes?.length
        ? { alternativeLanguageCodes: languageConfig.alternativeLanguageCodes }
        : {}),
      enableAutomaticPunctuation: true,
      model: 'phone_call',
      useEnhanced: true,
      profanityFilter: false,
      speechContexts: [
        {
          phrases: languageConfig.speechContexts,
          boost: 20.0
        }
      ]
    },
    interimResults: true,
    singleUtterance: false
  };
};

/**
 * Create streaming recognize request
 */
export const createStreamingRecognizeRequest = () => {
  return {
    streamingConfig: getStreamingRecognizeConfig(),
    audioContent: null
  };
};

/**
 * Process streaming audio chunk
 * Returns formatted request with audio content
 */
export const processAudioChunk = (audioPayload) => {
  return {
    audioContent: audioPayload
  };
};

/**
 * Parse streaming recognition response
 * Extracts transcript results
 */
export const parseStreamingResponse = (response) => {
  const results = response.results || [];

  const processedResults = results.map((result, index) => {
    const alternatives = result.alternatives || [];

    return {
      isFinal: result.isFinal,
      resultIndex: index,
      alternatives: alternatives.map((alt, altIndex) => ({
        transcript: alt.transcript || '',
        confidence: alt.confidence || 0,
        isAlternative: altIndex > 0
      })),
      // Primary transcript (most confident)
      transcript: alternatives.length > 0 ? alternatives[0].transcript : '',
      confidence: alternatives.length > 0 ? alternatives[0].confidence : 0
    };
  });

  return {
    results: processedResults,
    isFinal: results.length > 0 && results[results.length - 1].isFinal
  };
};

/**
 * Create streaming recognizer
 * Returns bidirectional stream for audio and results
 */
export const createStreamingRecognizer = async (options = {}) => {
  try {
    const request = getStreamingRecognizeConfig(options);
    const stream = getSpeechClient().streamingRecognize(request);

    console.log('Creating streaming speech recognizer...');

    return {
      request,
      stream,
      isActive: true,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error('Error creating streaming recognizer:', error);
    throw error;
  }
};

/**
 * Send audio chunk for transcription
 * Should be called for each audio packet from Twilio
 */
export const transcribeAudioChunk = async (audioPayload) => {
  try {
    const request = processAudioChunk(audioPayload);
    return request;
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    throw error;
  }
};

/**
 * Process full-transcript from Google Cloud response
 * Combines interim and final results into readable format
 */
export const processTranscriptResponse = (googleResponse) => {
  try {
    const parsed = parseStreamingResponse(googleResponse);

    // Return formatted transcript line
    return {
      isFinal: parsed.isFinal,
      text: parsed.results
        .filter(r => !r.alternatives[0]?.isAlternative)
        .map(r => r.transcript)
        .join(' '),
      confidence: parsed.results.length > 0 ? parsed.results[0].confidence : 0,
      alternatives: parsed.results
        .filter(r => r.alternatives.length > 1)
        .map(r => r.alternatives[1]?.transcript)
        .filter(Boolean)
    };
  } catch (error) {
    console.error('Error processing transcript response:', error);
    throw error;
  }
};

/**
 * Validate speech configuration
 * Checks that Google Cloud credentials are available
 */
export const validateSpeechConfig = () => {
  try {
    if (!hasGoogleCloudCredentials()) {
      console.warn('Warning: Google Cloud credentials not configured for Speech-to-Text');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating speech config:', error);
    return false;
  }
};

export const transcribeUploadedAudio = async (file, options = {}) => {
  if (!file?.buffer?.length) {
    throw new Error('Uploaded audio file was empty');
  }

  const languagePreference = resolveLanguagePreference(options.languagePreference);
  const language = languagePreference;
  const audioFile = await toFile(file.buffer, file.originalname || 'listen-mode.m4a', {
    type: file.mimetype || 'audio/mp4'
  });
  const response = await getOpenAIClient().audio.transcriptions.create({
    file: audioFile,
    model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
    language,
    response_format: 'json'
  });

  return String(response.text || '').trim();
};

/**
 * Transcribe audio using OpenRouter (free/low-cost STT models).
 */
export const transcribeWithOpenRouter = async (audioBuffer, options = {}) => {
  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter is not configured. Set OPENROUTER_CODING_KEY.');
  }

  const model = options.model || OPENROUTER_STT_MODELS.default.id;

  const result = await openRouterSpeechToText(audioBuffer, {
    model,
    language: options.language || 'en',
    format: options.format || 'mp3',
  });

  return String(result.text || '').trim();
};

export default {
  createStreamingRecognizer,
  transcribeAudioChunk,
  processTranscriptResponse,
  parseStreamingResponse,
  processAudioChunk,
  createStreamingRecognizeRequest,
  transcribeUploadedAudio,
  resolveLanguagePreference,
  validateSpeechConfig,
  getSpeechClient
};
