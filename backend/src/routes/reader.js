import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.js';
import {
  deleteReaderAudio as deleteReaderAudioRecord,
  listReaderAudio as listReaderAudioRecords,
  updateReaderAudio as updateReaderAudioRecord,
  saveReaderAudio as saveReaderAudioRecord,
  saveCallCosts
} from '../services/databaseService.js';
import { extractReaderTextFromUpload } from '../services/documentReaderService.js';
import { textToAudio } from '../services/textToSpeechService.js';
import { consumeCredits } from '../services/creditService.js';

const router = express.Router();
const MAX_AUDIO_EXPORT_CHARACTERS = 50000;
const MAX_AUDIO_CHUNK_LENGTH = 4000;
const DEFAULT_READER_PROVIDER = String(process.env.READER_TTS_PROVIDER || process.env.TTS_PROVIDER || 'google').trim().toLowerCase();
const DEFAULT_RESEMBLE_VOICE_PROFILE = String(process.env.READER_RESEMBLE_VOICE_PROFILE || 'lucy').trim().toLowerCase();
const RESEMBLE_MODEL = process.env.RESEMBLE_MODEL || 'chatterbox-turbo';
const RESEMBLE_VOICE_CATALOG = [
  {
    id: 'lucy',
    voiceUuid: 'fb2d2858',
    model: RESEMBLE_MODEL
  },
  {
    id: 'ethan',
    voiceUuid: 'bee581c1',
    model: RESEMBLE_MODEL
  }
];
const RESEMBLE_VOICE_PROFILES = RESEMBLE_VOICE_CATALOG.reduce((profiles, voice) => {
  profiles[voice.id] = {
    voiceUuid: voice.voiceUuid,
    model: voice.model
  };
  return profiles;
}, {});
const READER_PROVIDER_CONFIG = {
  google: {
    en: {
      languageCode: 'en-US',
      voice: process.env.GOOGLE_TTS_VOICE || 'en-US-Neural2-C'
    },
    es: {
      languageCode: 'es-US',
      voice: process.env.GOOGLE_TTS_VOICE_ES || 'es-US-Neural2-A'
    }
  },
  resemble: {
    en: {
      languageCode: 'en-US',
      voiceProfile: DEFAULT_RESEMBLE_VOICE_PROFILE
    },
    es: {
      languageCode: 'es-US',
      voiceProfile: DEFAULT_RESEMBLE_VOICE_PROFILE
    }
  },
  openrouter: {
    en: {
      languageCode: 'en-US',
      voiceProfile: 'af_heart'
    },
    es: {
      languageCode: 'es-US',
      voiceProfile: 'ef_dora'
    }
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

const splitTextIntoAudioChunks = (text) => {
  const source = String(text || '').trim();

  if (!source) {
    return [];
  }

  const chunks = [];
  let remainingText = source;

  while (remainingText.length > MAX_AUDIO_CHUNK_LENGTH) {
    const candidate = remainingText.slice(0, MAX_AUDIO_CHUNK_LENGTH);
    const sentenceBreak = Math.max(
      candidate.lastIndexOf('. '),
      candidate.lastIndexOf('? '),
      candidate.lastIndexOf('! '),
      candidate.lastIndexOf('\n')
    );
    const wordBreak = candidate.lastIndexOf(' ');
    const breakIndex = sentenceBreak > 300 ? sentenceBreak + 1 : wordBreak > 300 ? wordBreak : MAX_AUDIO_CHUNK_LENGTH;

    chunks.push(remainingText.slice(0, breakIndex).trim());
    remainingText = remainingText.slice(breakIndex).trim();
  }

  if (remainingText) {
    chunks.push(remainingText);
  }

  return chunks.filter(Boolean);
};

const sanitizeFileStem = (value) => {
  const normalized = String(value || 'reader-audio')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'reader-audio';
};

const resolveReaderVoiceConfig = (provider, languagePreference, voiceProfile) => {
  const providerConfig = READER_PROVIDER_CONFIG[provider] || READER_PROVIDER_CONFIG.google;
  const baseConfig = providerConfig[languagePreference] || providerConfig.en;

  if (provider !== 'resemble') {
    return baseConfig;
  }

  const normalizedProfile = String(voiceProfile || baseConfig.voiceProfile || DEFAULT_RESEMBLE_VOICE_PROFILE).trim().toLowerCase();
  const profileConfig = RESEMBLE_VOICE_PROFILES[normalizedProfile] || RESEMBLE_VOICE_PROFILES[DEFAULT_RESEMBLE_VOICE_PROFILE] || RESEMBLE_VOICE_PROFILES.lucy;

  return {
    ...baseConfig,
    voiceProfile: normalizedProfile,
    voiceUuid: profileConfig.voiceUuid,
    model: profileConfig.model
  };
};

const normalizeReaderAudioRequest = (body = {}) => {
  const normalizedText = String(body.text || '').trim();
  const title = String(body.title || '').trim();
  const languagePreference = String(body.languagePreference || 'en').trim().toLowerCase();
  const speechRate = Math.max(0.75, Math.min(1.1, Number(body.speechRate) || 1));
  const provider = String(body.provider || DEFAULT_READER_PROVIDER).trim().toLowerCase();
  const voiceProfile = String(body.voiceProfile || '').trim().toLowerCase();

  return {
    normalizedText,
    title,
    languagePreference,
    speechRate,
    provider,
    voiceProfile
  };
};

const buildReaderAudioResponse = async ({ normalizedText, title, languagePreference, speechRate, provider, voiceProfile }) => {
  if (!normalizedText) {
    throw new Error('Paste text or import a document first.');
  }

  if (normalizedText.length > MAX_AUDIO_EXPORT_CHARACTERS) {
    throw new Error(`Audio export is limited to ${MAX_AUDIO_EXPORT_CHARACTERS.toLocaleString()} characters right now.`);
  }

  const voiceConfig = resolveReaderVoiceConfig(provider, languagePreference, voiceProfile);
  const chunks = splitTextIntoAudioChunks(normalizedText);
  const audioBuffers = [];

  // Process chunks in parallel batches of 4 for speed
  for (let i = 0; i < chunks.length; i += 4) {
    const batch = chunks.slice(i, i + 4);
    const batchResults = await Promise.all(
      batch.map((chunk) =>
        textToAudio(chunk, {
          provider,
          languageCode: voiceConfig.languageCode,
          voice: voiceConfig.voice,
          speakingRate: speechRate,
          audioEncoding: 'MP3',
          responseFormat: 'mp3',
          outputFormat: 'mp3',
          title,
          voiceUuid: voiceConfig.voiceUuid,
          model: voiceConfig.model
        })
      )
    );
    audioBuffers.push(...batchResults);
  }

  const mergedAudio = Buffer.concat(audioBuffers);
  const fileStem = sanitizeFileStem(title || normalizedText.slice(0, 48));

  return {
    fileName: `${fileStem}.mp3`,
    contentType: 'audio/mpeg',
    audioBase64: mergedAudio.toString('base64'),
    metadata: {
      characterCount: normalizedText.length,
      chunkCount: chunks.length,
      languageCode: voiceConfig.languageCode,
      provider,
      voiceProfile: voiceConfig.voiceProfile || null
    }
  };
};

router.post('/extract', authMiddleware, upload.single('document'), async (req, res) => {
  try {
    const result = await extractReaderTextFromUpload(req.file);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Reader document import failed:', error.message);
    return res.status(400).json({ error: error.message || 'Unable to import document' });
  }
});

router.post('/audio', authMiddleware, async (req, res) => {
  try {
    const requestData = normalizeReaderAudioRequest(req.body);
    const audioResponse = await buildReaderAudioResponse(requestData);

    // Deduct credits for reader
    const creditMode = requestData.provider === 'resemble' || requestData.provider === 'elevenlabs' || requestData.provider === 'openrouter'
      ? 'reader_natural'
      : 'reader_basic';
    const estimatedDurationSeconds = Math.ceil((audioResponse.metadata.characterCount / 900) * 60);
    let creditResult = null;
    try {
      creditResult = await consumeCredits(req.user.userId, creditMode, estimatedDurationSeconds, {
        provider: requestData.provider,
        characterCount: audioResponse.metadata.characterCount
      });
    } catch (creditError) {
      console.error('Credit deduction failed for reader audio:', creditError.message);
    }

    // Auto-save for non-basic voices
    let savedAudio = null;
    if (requestData.provider !== 'device') {
      try {
        savedAudio = await saveReaderAudioRecord(req.user.userId, {
          title: requestData.title || 'Reader audio',
          sourceText: requestData.normalizedText,
          fileName: audioResponse.fileName,
          contentType: audioResponse.contentType,
          audioBase64: audioResponse.audioBase64,
          characterCount: audioResponse.metadata.characterCount,
          chunkCount: audioResponse.metadata.chunkCount,
          languageCode: audioResponse.metadata.languageCode,
          provider: audioResponse.metadata.provider,
          voiceProfile: audioResponse.metadata.voiceProfile,
        });
      } catch (saveError) {
        console.error('Auto-save failed for reader audio:', saveError.message);
      }
    }

    return res.status(200).json({
      success: true,
      ...audioResponse,
      savedAudioId: savedAudio?.id || null,
      credits: creditResult
        ? { consumed: creditResult.consumed, balanceAfter: creditResult.balanceAfter }
        : null
    });
  } catch (error) {
    console.error('Reader audio export failed:', error.message);
    return res.status(400).json({ error: error.message || 'Unable to create reader audio' });
  }
});

router.post('/audio/save', authMiddleware, async (req, res) => {
  try {
    const requestData = normalizeReaderAudioRequest(req.body);
    const audioResponse = await buildReaderAudioResponse(requestData);

    // Deduct credits for reader (2/min for natural voice, 0 for basic)
    const creditMode = requestData.provider === 'resemble' || requestData.provider === 'elevenlabs' || requestData.provider === 'openrouter'
      ? 'reader_natural'
      : 'reader_basic';
    const estimatedDurationSeconds = Math.ceil((audioResponse.metadata.characterCount / 900) * 60);
    let creditResult = null;
    try {
      creditResult = await consumeCredits(req.user.userId, creditMode, estimatedDurationSeconds, {
        provider: requestData.provider,
        characterCount: audioResponse.metadata.characterCount
      });
    } catch (creditError) {
      console.error('Credit deduction failed for saved reader audio:', creditError.message);
    }

    const savedAudio = await saveReaderAudioRecord(req.user.userId, {
      title: requestData.title || 'Reader audio',
      sourceText: requestData.normalizedText,
      fileName: audioResponse.fileName,
      contentType: audioResponse.contentType,
      audioBase64: audioResponse.audioBase64,
      characterCount: audioResponse.metadata.characterCount,
      chunkCount: audioResponse.metadata.chunkCount,
      languageCode: audioResponse.metadata.languageCode,
      metadata: {
        provider: requestData.provider,
        voiceProfile: audioResponse.metadata.voiceProfile,
        languagePreference: requestData.languagePreference,
        speechRate: requestData.speechRate
      }
    });

    return res.status(200).json({
      success: true,
      savedAudioId: savedAudio.id,
      createdAt: savedAudio.created_at,
      ...audioResponse
    });
  } catch (error) {
    console.error('Reader audio save failed:', error.message);
    return res.status(400).json({ error: error.message || 'Unable to save reader audio' });
  }
});

router.get('/audio/saved', authMiddleware, async (req, res) => {
  try {
    const savedAudioEntries = await listReaderAudioRecords(req.user.userId);

    return res.status(200).json({
      success: true,
      entries: savedAudioEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        fileName: entry.file_name,
        contentType: entry.content_type,
        audioBase64: entry.audio_base64,
        metadata: {
          ...(entry.metadata || {}),
          characterCount: entry.character_count,
          chunkCount: entry.chunk_count,
          languageCode: entry.language_code
        },
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
      }))
    });
  } catch (error) {
    console.error('Reader audio list failed:', error.message);
    return res.status(400).json({ error: error.message || 'Unable to load saved reader audio' });
  }
});

router.delete('/audio/saved/:savedAudioId', authMiddleware, async (req, res) => {
  try {
    const deletedAudio = await deleteReaderAudioRecord(req.user.userId, req.params.savedAudioId);

    if (!deletedAudio) {
      return res.status(404).json({ error: 'Saved reader audio not found' });
    }

    return res.status(200).json({
      success: true,
      deletedId: deletedAudio.id
    });
  } catch (error) {
    console.error('Reader audio delete failed:', error.message);
    return res.status(400).json({ error: error.message || 'Unable to delete saved reader audio' });
  }
});

router.patch('/audio/saved/:savedAudioId', authMiddleware, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();

    if (!title) {
      return res.status(400).json({ error: 'Saved audio title is required' });
    }

    const fileName = `${sanitizeFileStem(title)}.mp3`;
    const updatedAudio = await updateReaderAudioRecord(req.user.userId, req.params.savedAudioId, {
      title,
      fileName
    });

    if (!updatedAudio) {
      return res.status(404).json({ error: 'Saved reader audio not found' });
    }

    return res.status(200).json({
      success: true,
      savedAudioId: updatedAudio.id,
      title: updatedAudio.title,
      fileName: updatedAudio.file_name,
      updatedAt: updatedAudio.updated_at
    });
  } catch (error) {
    console.error('Reader audio update failed:', error.message);
    return res.status(400).json({ error: error.message || 'Unable to update saved reader audio' });
  }
});

router.use((error, req, res, next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Document is too large. Keep uploads under 8 MB.' });
  }

  return next(error);
});

export default router;