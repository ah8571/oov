/**
 * Google Cloud Speech-to-Text Service
 * Handles real-time transcription of audio streams
 */

import speech from '@google-cloud/speech';
import {
  getGoogleCloudClientOptions,
  hasGoogleCloudCredentials
} from './googleCloudAuth.js';

let speechClient = null;

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
  teacher_es_en: {
    languageCode: 'en-US',
    alternativeLanguageCodes: ['es-US'],
    speechContexts: [
      'reminder', 'note', 'todo', 'schedule', 'call', 'email',
      'meeting', 'project', 'task', 'follow up', 'action item',
      'translate', 'translation', 'teacher', 'practice', 'repeat after me',
      'recordatorio', 'nota', 'tarea', 'agenda', 'llamar', 'correo',
      'reunion', 'proyecto', 'seguimiento', 'accion', 'traducir', 'traduccion',
      'profesor', 'practicar', 'repite despues de mi'
    ]
  }
};

export const resolveLanguagePreference = (languagePreference) => {
  const value = String(languagePreference || '').trim().toLowerCase();

  if (value.includes('teacher') || value.includes('bilingual') || value.includes('multilingual')) {
    return 'teacher_es_en';
  }

  if (value.startsWith('es')) {
    return 'es';
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

export default {
  createStreamingRecognizer,
  transcribeAudioChunk,
  processTranscriptResponse,
  parseStreamingResponse,
  processAudioChunk,
  createStreamingRecognizeRequest,
  resolveLanguagePreference,
  validateSpeechConfig,
  getSpeechClient
};
