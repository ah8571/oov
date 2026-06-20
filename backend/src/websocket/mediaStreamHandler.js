/**
 * WebSocket Media Stream Handler
 * Handles Twilio media stream connections
 * Processes audio in real-time and sends transcripts back
 */

import { mediaStreamManager } from '../services/mediaStreamManager.js';
import {
  createStreamingRecognizer,
  processTranscriptResponse,
  resolveLanguagePreference,
  validateSpeechConfig
} from '../services/speechToTextService.js';
import {
  createNote,
  getUserPricingTier,
  getNotesForUser,
  linkNotesToCall,
  saveCall,
  saveCallMessages,
  saveCallCosts,
  saveSummary,
  saveTranscript,
  updateNote
} from '../services/databaseService.js';
import {
  detectNoteAction,
  generateResponse,
  generateStructuredNoteDocument,
  sanitizeSpokenResponse,
  summarizeTranscript
} from '../services/aiService.js';
import { buildEstimatedCallCostEntries } from '../services/costTrackingService.js';
import { textToAudio } from '../services/textToSpeechService.js';
import { getCallFromTwilio } from '../services/twilioService.js';

const TWILIO_FRAME_SIZE = 160;
const TURN_RESPONSE_DELAY_MS = parseInt(process.env.VOICE_TURN_RESPONSE_DELAY_MS || '1600', 10);
const STREAMING_RECOGNIZER_REFRESH_MS = parseInt(process.env.GOOGLE_STREAMING_REFRESH_MS || '290000', 10);
const STREAMING_RECOGNIZER_DURATION_ERROR_CODE = 11;
const CONTINUE_LISTENING_BRIDGE = {
  en: "Go ahead, I'm listening.",
  es: 'Adelante, te escucho.'
};
const CALL_LANGUAGE_CONFIG = {
  en: {
    languageCode: 'en-US',
    voice: process.env.GOOGLE_TTS_VOICE || 'en-US-Neural2-C',
    greeting: 'Hi, this is Emmaline. Tell me what you want to think through. If you want me to create, update, or read a note while we are speaking, just say so and I can do that for you.'
  },
  es: {
    languageCode: 'es-US',
    voice: process.env.GOOGLE_TTS_VOICE_ES || 'es-US-Neural2-A',
    greeting: 'Hola, soy Emmaline. Cuéntame qué quieres pensar en voz alta. Si quieres que cree, actualice o lea una nota mientras hablamos, solo dímelo y puedo hacerlo.'
  },
  teacher_es_en: {
    languageCode: 'en-US',
    voice: process.env.GOOGLE_TTS_VOICE_TEACHER || process.env.GOOGLE_TTS_VOICE || 'en-US-Neural2-C',
    greeting: 'Hi, this is Emmaline. We are in English and Spanish teacher mode, so you can ask me how to say things in Spanish, practice short phrases, and I will keep the explanations beginner friendly.'
  }
};

const getCallLogPrefix = (mediaConnection) => {
  return `[call:${mediaConnection?.callSid || 'unknown'} stream:${mediaConnection?.streamSid || 'unknown'}]`;
};

const parseUserIdFromIdentity = (identity) => {
  const value = String(identity || '').trim();
  return value.startsWith('user_') ? value.slice(5) : null;
};

const resolveCallLanguageConfig = (languagePreference) => {
  const language = resolveLanguagePreference(languagePreference);

  return {
    preference: language,
    ...CALL_LANGUAGE_CONFIG[language]
  };
};

const normalizeSpeechRatePreference = (value) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(1.15, Math.max(0.75, parsed));
};

const normalizeTurnResponseDelayPreference = (value) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return TURN_RESPONSE_DELAY_MS;
  }

  return Math.min(3000, Math.max(700, parsed));
};

const normalizeTranscriptText = (value) => {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeTitleKey = (value) => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const looksLikeNoteInstruction = (value) => {
  const text = normalizeTranscriptText(value).toLowerCase();

  if (!text) {
    return false;
  }

  return [
    /\bnote\b/,
    /\bnotes\b/,
    /\bwrite (this|that) down\b/,
    /\bsave (this|that)\b/,
    /\bremember (this|that)\b/,
    /\bmake a note\b/,
    /\bcreate a note\b/
  ].some((pattern) => pattern.test(text));
};

const findBestMatchingNote = (notes = [], query) => {
  const normalizedQuery = normalizeTitleKey(query);

  if (!normalizedQuery) {
    return { note: null, ambiguous: [] };
  }

  const scored = notes
    .map((note) => {
      const normalizedTitle = normalizeTitleKey(note.title);
      if (!normalizedTitle) {
        return { note, score: 0 };
      }

      let score = 0;

      if (normalizedTitle === normalizedQuery) {
        score = 100;
      } else if (normalizedTitle.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedTitle)) {
        score = 90;
      } else if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
        score = 80;
      } else {
        const queryTokens = normalizedQuery.split(' ').filter(Boolean);
        const titleTokens = normalizedTitle.split(' ').filter(Boolean);
        const overlap = queryTokens.filter((token) => titleTokens.includes(token)).length;
        score = overlap * 10;
      }

      return { note, score };
    })
    .sort((left, right) => right.score - left.score);

  if (!scored.length || scored[0].score < 10) {
    return { note: null, ambiguous: [] };
  }

  if (scored[1] && scored[0].score - scored[1].score <= 5) {
    return {
      note: null,
      ambiguous: scored.slice(0, 3).map((entry) => entry.note)
    };
  }

  return { note: scored[0].note, ambiguous: [] };
};

const markTouchedNote = (mediaConnection, noteId) => {
  if (!noteId) {
    return;
  }

  mediaConnection.touchedNoteIds = mediaConnection.touchedNoteIds || new Set();
  mediaConnection.touchedNoteIds.add(noteId);
};

const buildListNotesReply = (notes = [], languagePreference = 'en') => {
  if (!notes.length) {
    return String(languagePreference || '').toLowerCase().startsWith('es')
      ? 'Todavía no tienes notas guardadas.'
      : 'You do not have any saved notes yet.';
  }

  const titles = notes.slice(0, 5).map((note) => note.title).join(', ');
  const hasMore = notes.length > 5;

  return String(languagePreference || '').toLowerCase().startsWith('es')
    ? `Tienes ${notes.length} notas. ${titles}${hasMore ? ', y algunas más.' : '.'}`
    : `You have ${notes.length} notes. ${titles}${hasMore ? ', and a few more.' : '.'}`;
};

const buildReadNoteReply = (note, languagePreference = 'en') => {
  const excerpt = normalizeTranscriptText(
    String(note?.content || '')
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h1|h2|h3|ul|ol)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^#+\s+/gm, '')
      .replace(/\n+/g, ' ')
  ).slice(0, 420);

  if (!excerpt) {
    return String(languagePreference || '').toLowerCase().startsWith('es')
      ? `Encontré la nota ${note.title}, pero está vacía.`
      : `I found the note ${note.title}, but it is empty.`;
  }

  return String(languagePreference || '').toLowerCase().startsWith('es')
    ? `Encontré la nota ${note.title}. Empieza así: ${excerpt}`
    : `I found the note ${note.title}. It starts like this: ${excerpt}`;
};

const buildNoteContextSummary = (notes = [], languagePreference = 'en') => {
  if (!Array.isArray(notes) || notes.length === 0) {
    return String(languagePreference || '').toLowerCase().startsWith('es')
      ? 'No hay notas guardadas todavía.'
      : 'There are no saved notes yet.';
  }

  const titles = notes
    .slice(0, 8)
    .map((note) => String(note.title || '').trim())
    .filter(Boolean);

  if (titles.length === 0) {
    return String(languagePreference || '').toLowerCase().startsWith('es')
      ? `Hay ${notes.length} notas guardadas.`
      : `There are ${notes.length} saved notes.`;
  }

  return String(languagePreference || '').toLowerCase().startsWith('es')
    ? `Hay ${notes.length} notas guardadas. Los títulos incluyen: ${titles.join(', ')}.`
    : `There are ${notes.length} saved notes. Titles include: ${titles.join(', ')}.`;
};

const refreshAvailableNotesContext = async (mediaConnection) => {
  if (!mediaConnection?.userId) {
    mediaConnection.availableNotes = [];
    mediaConnection.noteContextSummary = 'There are no saved notes yet.';
    return [];
  }

  try {
    const noteListResult = await getNotesForUser(mediaConnection.userId, { limit: 25, offset: 0 });
    const notes = noteListResult.notes || [];
    mediaConnection.availableNotes = notes;
    mediaConnection.noteContextSummary = buildNoteContextSummary(notes, mediaConnection.languagePreference);
    return notes;
  } catch (error) {
    console.warn(`${getCallLogPrefix(mediaConnection)} Unable to refresh note context: ${error.message}`);
    mediaConnection.availableNotes = [];
    mediaConnection.noteContextSummary = buildNoteContextSummary([], mediaConnection.languagePreference);
    return [];
  }
};

const maybeHandleNoteAction = async (mediaConnection, ws, userText) => {
  if (!mediaConnection.userId || !looksLikeNoteInstruction(userText)) {
    return false;
  }

  const existingNotes = await refreshAvailableNotesContext(mediaConnection);
  const detection = await detectNoteAction(mediaConnection.conversationHistory, {
    noteTitles: existingNotes.map((note) => note.title),
    languagePreference: mediaConnection.languagePreference
  });

  if (mediaConnection.usageMetrics) {
    recordUsage(mediaConnection.usageMetrics.chatUsage, detection.usage);
  }

  if (!detection || detection.action === 'none' || detection.confidence < 0.45) {
    return false;
  }

  if (detection.action === 'list') {
    await sendAssistantReply(ws, mediaConnection, buildListNotesReply(existingNotes, mediaConnection.languagePreference));
    return true;
  }

  if (detection.action === 'read') {
    const match = findBestMatchingNote(existingNotes, detection.targetNoteTitle || detection.instruction || userText);

    if (match.ambiguous.length > 0) {
      await sendAssistantReply(
        ws,
        mediaConnection,
        `I found more than one possible note: ${match.ambiguous.map((note) => note.title).join(', ')}. Tell me which one you want.`
      );
      return true;
    }

    if (!match.note) {
      await sendAssistantReply(ws, mediaConnection, 'I could not find that note yet.');
      return true;
    }

    await sendAssistantReply(ws, mediaConnection, buildReadNoteReply(match.note, mediaConnection.languagePreference));
    return true;
  }

  const requestedTitle = detection.targetNoteTitle || detection.newNoteTitle || null;
  const match = requestedTitle ? findBestMatchingNote(existingNotes, requestedTitle) : { note: null, ambiguous: [] };

  if (match.ambiguous.length > 0) {
    await sendAssistantReply(
      ws,
      mediaConnection,
      `I found more than one possible note: ${match.ambiguous.map((note) => note.title).join(', ')}. Tell me which one you want me to update.`
    );
    return true;
  }

  const shouldCreate = detection.action === 'create' || (detection.action === 'update' && !match.note && !requestedTitle);
  const targetNote = shouldCreate ? null : match.note;

  if (detection.action === 'update' && requestedTitle && !targetNote) {
    await sendAssistantReply(ws, mediaConnection, `I could not find a note called ${requestedTitle}. You can ask me to create it if you want.`);
    return true;
  }

  const noteDraft = await generateStructuredNoteDocument({
    mode: shouldCreate ? 'create' : 'update',
    preferredTitle: shouldCreate ? requestedTitle : targetNote?.title,
    existingNote: targetNote,
    userInstruction: detection.instruction || userText,
    conversationHistory: detection.useRecentConversation === false
      ? mediaConnection.conversationHistory.slice(-2)
      : mediaConnection.conversationHistory,
    languagePreference: mediaConnection.languagePreference
  });

  if (mediaConnection.usageMetrics) {
    recordUsage(mediaConnection.usageMetrics.chatUsage, noteDraft.usage);
  }

  if (!noteDraft.content) {
    await sendAssistantReply(ws, mediaConnection, 'I was not able to draft that note yet. Please try again.');
    return true;
  }

  if (shouldCreate) {
    const createdNote = await createNote(
      mediaConnection.userId,
      {
        title: noteDraft.title,
        content: noteDraft.content
      },
      {
        source: 'voice_assistant',
        editSummary: 'Created note during live call',
        metadata: {
          callSid: mediaConnection.callSid
        }
      }
    );

    markTouchedNote(mediaConnection, createdNote.id);
    await refreshAvailableNotesContext(mediaConnection);
    await sendAssistantReply(ws, mediaConnection, `I created a note called ${createdNote.title} and saved what we just discussed.`);
    return true;
  }

  const updatedNote = await updateNote(
    mediaConnection.userId,
    targetNote.id,
    {
      title: noteDraft.title,
      content: noteDraft.content,
      topicId: targetNote.topic_id || null,
      callId: targetNote.call_id || null
    },
    {
      source: 'voice_assistant',
      editSummary: 'Updated note during live call',
      metadata: {
        callSid: mediaConnection.callSid
      }
    }
  );

  markTouchedNote(mediaConnection, updatedNote?.id || targetNote.id);
  await refreshAvailableNotesContext(mediaConnection);
  await sendAssistantReply(ws, mediaConnection, `I updated ${updatedNote?.title || targetNote.title} with what we just covered.`);
  return true;
};

const isLikelyIncompleteUtterance = (value) => {
  const text = normalizeTranscriptText(value).toLowerCase();

  if (!text) {
    return false;
  }

  if (/[.!?]$/.test(text)) {
    return false;
  }

  if (/[,:;\-]$/.test(text)) {
    return true;
  }

  const incompleteEndings = [
    'and', 'or', 'but', 'to', 'for', 'with', 'about', 'on', 'in', 'at', 'from',
    'uh', 'um', 'like', 'actually', 'because', 'if', 'when', 'then',
    'y', 'o', 'pero', 'para', 'con', 'sobre', 'en', 'de', 'eh', 'este'
  ];

  return incompleteEndings.some((ending) => text.endsWith(` ${ending}`) || text === ending);
};

const extractAudioPayload = (audioBuffer) => {
  if (!audioBuffer || audioBuffer.length < 12) {
    return audioBuffer;
  }

  const hasRiffHeader = audioBuffer.subarray(0, 4).toString('ascii') === 'RIFF';
  if (!hasRiffHeader) {
    return audioBuffer;
  }

  let offset = 12;
  while (offset + 8 <= audioBuffer.length) {
    const chunkId = audioBuffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = audioBuffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;

    if (chunkId === 'data' && chunkEnd <= audioBuffer.length) {
      return audioBuffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  return audioBuffer;
};

const streamAudioResponse = async (ws, streamSid, audioBuffer) => {
  const payload = extractAudioPayload(audioBuffer);

  for (let index = 0; index < payload.length; index += TWILIO_FRAME_SIZE) {
    const chunk = payload.subarray(index, index + TWILIO_FRAME_SIZE);
    if (chunk.length > 0) {
      sendAudioResponse(ws, streamSid, chunk);
    }
  }
};

const synthesizeAssistantReply = async (mediaConnection, text) => {
  const safeText = sanitizeSpokenResponse(text);
  const languageConfig = resolveCallLanguageConfig(mediaConnection.languagePreference);

  return textToAudio(safeText, {
    provider: 'google',
    languageCode: languageConfig.languageCode,
    voice: languageConfig.voice,
    audioEncoding: 'MULAW',
    sampleRateHertz: 8000,
    speakingRate: mediaConnection.speechRatePreference
  });
};

const addTranscriptTurn = (mediaConnection, speaker, text, metadata = {}) => {
  mediaConnection.addTranscriptLine(normalizeTranscriptText(text), true, speaker, metadata);
};

const initializeUsageTracking = (mediaConnection) => {
  mediaConnection.usageMetrics = {
    pricingTier: 'tier1',
    assistantCharacters: 0,
    chatUsage: {
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    },
    summaryUsage: {
      model: process.env.OPENAI_SUMMARY_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    }
  };
};

const recordUsage = (target, usage = {}) => {
  target.model = usage.model || target.model;
  target.inputTokens += Number(usage.inputTokens || 0);
  target.outputTokens += Number(usage.outputTokens || 0);
  target.totalTokens += Number(usage.totalTokens || 0);
};

const getStructuredTranscript = (mediaConnection) => {
  return mediaConnection.transcriptBuffer
    .filter((line) => line.isFinal)
    .map((line) => ({
      speaker: line.speaker || 'user',
      text: normalizeTranscriptText(line.text),
      createdAt: line.createdAt,
      sequenceNumber: line.sequenceNumber
    }))
    .filter((line) => line.text);
};

const buildFullTranscript = (messages) => {
  return messages
    .map((message) => `${message.speaker === 'assistant' ? 'Assistant' : message.speaker === 'system' ? 'System' : 'User'}: ${message.text}`)
    .join('\n')
    .trim();
};

const clearPendingTurnTimer = (mediaConnection) => {
  if (mediaConnection.pendingTurnTimer) {
    clearTimeout(mediaConnection.pendingTurnTimer);
    mediaConnection.pendingTurnTimer = null;
  }
};

const getTurnResponseDelayMs = (mediaConnection) => {
  return Number(mediaConnection?.turnResponseDelayMs || TURN_RESPONSE_DELAY_MS);
};

const markSpeechActivity = (mediaConnection) => {
  mediaConnection.lastSpeechEventAt = Date.now();
};

const appendPendingUserSegment = (mediaConnection, value) => {
  const text = normalizeTranscriptText(value);

  if (!text) {
    return false;
  }

  mediaConnection.pendingUserSegments = mediaConnection.pendingUserSegments || [];

  if (mediaConnection.pendingUserSegments.length === 0) {
    mediaConnection.pendingUserSegments.push(text);
    return true;
  }

  const lastIndex = mediaConnection.pendingUserSegments.length - 1;
  const previousText = normalizeTranscriptText(mediaConnection.pendingUserSegments[lastIndex]);
  const normalizedPrevious = previousText.toLowerCase();
  const normalizedCurrent = text.toLowerCase();

  if (normalizedCurrent === normalizedPrevious) {
    return false;
  }

  if (normalizedCurrent.startsWith(`${normalizedPrevious} `)) {
    mediaConnection.pendingUserSegments[lastIndex] = text;
    return true;
  }

  if (normalizedPrevious.startsWith(`${normalizedCurrent} `)) {
    return false;
  }

  mediaConnection.pendingUserSegments.push(text);
  return true;
};

const releaseRecognizer = (mediaConnection, recognizer = mediaConnection.recognizer) => {
  const stream = recognizer?.stream;

  if (mediaConnection.recognizer === recognizer) {
    mediaConnection.recognizer = null;
    mediaConnection.recognizerExpiresAt = 0;
  }

  if (!stream) {
    return;
  }

  try {
    if (!stream.destroyed && !stream.writableEnded) {
      stream.end();
    }
  } catch (error) {
    console.warn(`${getCallLogPrefix(mediaConnection)} Error ending streaming recognizer:`, error.message);
  }

  try {
    if (!stream.destroyed) {
      stream.destroy();
    }
  } catch (error) {
    console.warn(`${getCallLogPrefix(mediaConnection)} Error destroying streaming recognizer:`, error.message);
  }
};

const getPendingUserTurnText = (mediaConnection) => {
  return normalizeTranscriptText((mediaConnection.pendingUserSegments || []).join(' '));
};

const commitPendingUserTurn = (mediaConnection) => {
  const text = getPendingUserTurnText(mediaConnection);

  if (!text) {
    mediaConnection.pendingUserSegments = [];
    mediaConnection.pendingPromptSent = false;
    return '';
  }

  addTranscriptTurn(mediaConnection, 'user', text);
  mediaConnection.conversationHistory.push({ role: 'user', content: text });
  mediaConnection.pendingUserSegments = [];
  mediaConnection.pendingPromptSent = false;
  return text;
};

const sendAssistantReply = async (ws, mediaConnection, text, options = {}) => {
  const reply = sanitizeSpokenResponse(text);

  if (!reply) {
    return '';
  }

  if (options.includeInConversationHistory !== false) {
    mediaConnection.conversationHistory.push({ role: 'assistant', content: reply });
  }

  if (mediaConnection.usageMetrics) {
    mediaConnection.usageMetrics.assistantCharacters += reply.length;
  }

  addTranscriptTurn(mediaConnection, options.speaker || 'assistant', reply);

  const audio = await synthesizeAssistantReply(mediaConnection, reply);
  console.log(`${getCallLogPrefix(mediaConnection)} Synthesized assistant audio (${audio.length} bytes)`);
  await streamAudioResponse(ws, mediaConnection.streamSid, audio);
  return reply;
};

const schedulePendingTurnProcessing = (mediaConnection, ws, delayMs = getTurnResponseDelayMs(mediaConnection)) => {
  clearPendingTurnTimer(mediaConnection);

  mediaConnection.pendingTurnTimer = setTimeout(async () => {
    try {
      if (!mediaConnection?.isActive) {
        return;
      }

      if (mediaConnection.isResponding) {
        schedulePendingTurnProcessing(mediaConnection, ws, getTurnResponseDelayMs(mediaConnection));
        return;
      }

      const pendingText = getPendingUserTurnText(mediaConnection);
      if (!pendingText) {
        return;
      }

      const silenceElapsedMs = Date.now() - Number(mediaConnection.lastSpeechEventAt || 0);
      const targetDelayMs = getTurnResponseDelayMs(mediaConnection);

      if (silenceElapsedMs < targetDelayMs) {
        schedulePendingTurnProcessing(mediaConnection, ws, targetDelayMs - silenceElapsedMs);
        return;
      }

      if (isLikelyIncompleteUtterance(pendingText) && !mediaConnection.pendingPromptSent) {
        mediaConnection.pendingPromptSent = true;
        mediaConnection.isResponding = true;

        try {
          const bridge = CONTINUE_LISTENING_BRIDGE[mediaConnection.languagePreference] || CONTINUE_LISTENING_BRIDGE.en;
          console.log(`${getCallLogPrefix(mediaConnection)} Prompting user to continue before responding fully`);
          await sendAssistantReply(ws, mediaConnection, bridge, { includeInConversationHistory: false });
        } finally {
          mediaConnection.isResponding = false;
        }

        return;
      }

      const userText = commitPendingUserTurn(mediaConnection);
      if (!userText) {
        return;
      }

      mediaConnection.isResponding = true;

      try {
        const handledNoteAction = await maybeHandleNoteAction(mediaConnection, ws, userText);

        if (handledNoteAction) {
          return;
        }

        console.log(`${getCallLogPrefix(mediaConnection)} Generating assistant response`);
        const response = await generateResponse(mediaConnection.conversationHistory, {
          languagePreference: mediaConnection.languagePreference,
          noteAccessEnabled: true,
          noteContextSummary: mediaConnection.noteContextSummary || buildNoteContextSummary(mediaConnection.availableNotes || [], mediaConnection.languagePreference)
        });
        const assistantReply = response.text;

        if (mediaConnection.usageMetrics) {
          recordUsage(mediaConnection.usageMetrics.chatUsage, response.usage);
        }

        if (!assistantReply) {
          console.warn(`${getCallLogPrefix(mediaConnection)} AI returned an empty response`);
          return;
        }

        console.log(`${getCallLogPrefix(mediaConnection)} Assistant reply: ${assistantReply}`);
        await sendAssistantReply(ws, mediaConnection, assistantReply);
      } finally {
        mediaConnection.isResponding = false;

        if (getPendingUserTurnText(mediaConnection)) {
          schedulePendingTurnProcessing(mediaConnection, ws, getTurnResponseDelayMs(mediaConnection));
        }
      }
    } catch (error) {
      mediaConnection.isResponding = false;
      console.error(`${getCallLogPrefix(mediaConnection)} Error processing queued turn:`, error);
    }
  }, delayMs);
};

const ensureRecognizer = async (mediaConnection, ws, reason = 'refresh') => {
  if (mediaConnection.sttDisabled || !mediaConnection.isActive) {
    return null;
  }

  if (mediaConnection.recognizerPromise) {
    return mediaConnection.recognizerPromise;
  }

  mediaConnection.recognizerPromise = maybeCreateRecognizer(mediaConnection, ws, reason)
    .catch((error) => {
      console.error(`${getCallLogPrefix(mediaConnection)} Unable to create streaming recognizer:`, error);
      return null;
    })
    .finally(() => {
      mediaConnection.recognizerPromise = null;
    });

  return mediaConnection.recognizerPromise;
};

const maybeCreateRecognizer = async (mediaConnection, ws, reason = 'initial') => {
  if (!validateSpeechConfig()) {
    mediaConnection.sttDisabled = true;
    console.warn(`${getCallLogPrefix(mediaConnection)} Speech-to-Text disabled because Google credentials are unavailable`);
    return null;
  }

  releaseRecognizer(mediaConnection);

  const recognizer = await createStreamingRecognizer({
    languagePreference: mediaConnection.languagePreference
  });
  const stream = recognizer.stream;

  mediaConnection.recognizer = recognizer;
  mediaConnection.recognizerExpiresAt = Date.now() + STREAMING_RECOGNIZER_REFRESH_MS;

  console.log(`${getCallLogPrefix(mediaConnection)} Streaming speech recognizer created (${reason})`);

  stream.on('data', async (response) => {
    try {
      if (mediaConnection.recognizer !== recognizer) {
        return;
      }

      const transcript = processTranscriptResponse(response);
      const text = transcript.text?.trim();

      if (!text) {
        return;
      }

      markSpeechActivity(mediaConnection);

      console.log(
        `${getCallLogPrefix(mediaConnection)} Transcript ${transcript.isFinal ? 'final' : 'interim'}: ${text}`
      );

      if (!transcript.isFinal) {
        return;
      }

      if (mediaConnection.lastFinalTranscript === text) {
        return;
      }

      mediaConnection.lastFinalTranscript = text;
      if (appendPendingUserSegment(mediaConnection, text)) {
        mediaConnection.pendingPromptSent = false;
        schedulePendingTurnProcessing(mediaConnection, ws);
      }
    } catch (error) {
      mediaConnection.isResponding = false;
      console.error(`${getCallLogPrefix(mediaConnection)} Error processing streaming transcript:`, error);
    }
  });

  stream.on('error', (error) => {
    if (mediaConnection.recognizer !== recognizer) {
      return;
    }

    const message = String(error?.message || '');
    const reachedDurationLimit =
      error?.code === STREAMING_RECOGNIZER_DURATION_ERROR_CODE ||
      /maximum allowed stream duration/i.test(message);

    if (reachedDurationLimit) {
      console.warn(`${getCallLogPrefix(mediaConnection)} Streaming recognizer reached duration limit; rotating stream`);
      releaseRecognizer(mediaConnection, recognizer);
      return;
    }

    console.error(`${getCallLogPrefix(mediaConnection)} Streaming speech recognizer error:`, error);
    releaseRecognizer(mediaConnection, recognizer);
  });

  return recognizer;
};

const finalizeCallArtifacts = async (mediaConnection, stats) => {
  if (!mediaConnection.userId || mediaConnection.transcriptBuffer.length === 0) {
    return;
  }

  const messages = getStructuredTranscript(mediaConnection);
  const fullTranscript = buildFullTranscript(messages);

  if (!fullTranscript) {
    return;
  }

  const callRecord = await saveCall(mediaConnection.userId, {
    phoneNumber: mediaConnection.identity || `client:${mediaConnection.userId}`,
    duration: Math.round(stats.duration / 1000),
    startedAt: mediaConnection.createdAt.toISOString(),
    endedAt: new Date().toISOString(),
    status: 'completed',
    twilioCallSid: mediaConnection.callSid
  });

  if (mediaConnection.touchedNoteIds?.size) {
    try {
      await linkNotesToCall(mediaConnection.userId, [...mediaConnection.touchedNoteIds], callRecord.id);
    } catch (error) {
      console.warn(`${getCallLogPrefix(mediaConnection)} Unable to link touched notes back to call: ${error.message}`);
    }
  }

  await saveTranscript(callRecord.id, mediaConnection.userId, fullTranscript);
  await saveCallMessages(callRecord.id, mediaConnection.userId, messages);

  try {
    const summary = await summarizeTranscript(fullTranscript, {
      languagePreference: mediaConnection.languagePreference
    });

    if (mediaConnection.usageMetrics) {
      recordUsage(mediaConnection.usageMetrics.summaryUsage, summary.usage);
    }

    await saveSummary(callRecord.id, mediaConnection.userId, {
      text: summary.summary || '',
      keyPoints: summary.keyPoints || [],
      actionItems: summary.actionItems || [],
      sentiment: summary.sentiment || 'neutral'
    });
  } catch (error) {
    console.error('Error generating or saving call summary:', error);
  }

  try {
    const pricingTier = await getUserPricingTier(mediaConnection.userId);
    const usageMetrics = mediaConnection.usageMetrics || {};
    let twilioCall = null;

    try {
      twilioCall = await getCallFromTwilio(mediaConnection.callSid);
    } catch (error) {
      console.warn(`${getCallLogPrefix(mediaConnection)} Unable to fetch Twilio pricing data yet: ${error.message}`);
    }

    const estimatedCostEntries = buildEstimatedCallCostEntries({
      pricingTier,
      callDurationSeconds: Math.round(stats.duration / 1000),
      assistantCharacters: usageMetrics.assistantCharacters || 0,
      chatUsage: usageMetrics.chatUsage || {},
      summaryUsage: usageMetrics.summaryUsage || {},
      twilioCall
    });

    await saveCallCosts(callRecord.id, mediaConnection.userId, estimatedCostEntries);
  } catch (error) {
    console.error('Error generating or saving call cost estimates:', error);
  }
};

export const handleMediaStreamWebSocket = (ws, req) => {
  let mediaConnection = null;
  let callSid = null;
  let userId = null;

  console.log('📞 New WebSocket connection for media stream');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.event) {
        case 'connected':
          handleConnected(message, ws);
          break;

        case 'start':
          callSid = message.start?.callSid;
          userId = parseUserIdFromIdentity(message.start?.customParameters?.identity);

          if (!userId) {
            console.warn(`Rejecting media stream ${callSid || 'unknown'} with invalid identity`, {
              identity: message.start?.customParameters?.identity || null
            });
            ws.close(1008, 'Invalid voice identity');
            break;
          }

          mediaConnection = mediaStreamManager.createConnection(callSid, userId);
          handleStart(message, mediaConnection, ws);
          break;

        case 'media':
          if (mediaConnection) {
            await handleMedia(message, mediaConnection, ws);
          }
          break;

        case 'stop':
          if (mediaConnection) {
            await handleStop(message, mediaConnection, ws);
            mediaStreamManager.closeConnection(callSid);
            mediaConnection = null;
          }
          break;

        case 'mark':
          break;

        default:
          console.warn('Unknown event type:', message.event);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('📞 WebSocket connection closed');

    if (mediaConnection) {
      clearPendingTurnTimer(mediaConnection);
      releaseRecognizer(mediaConnection);
      mediaConnection.close();
      if (callSid) {
        mediaStreamManager.closeConnection(callSid);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);

    if (mediaConnection) {
      clearPendingTurnTimer(mediaConnection);
      releaseRecognizer(mediaConnection);
      mediaConnection.close();
      if (callSid) {
        mediaStreamManager.closeConnection(callSid);
      }
    }
  });
};

function handleConnected(message, ws) {
  console.log('✓ WebSocket connected to Twilio');
}

function handleStart(message, mediaConnection, ws) {
  const { streamSid, callSid, customParameters } = message.start;
  const identity = customParameters?.identity || null;
  const languagePreference = resolveLanguagePreference(customParameters?.language);
  const speechRatePreference = normalizeSpeechRatePreference(customParameters?.speechRate);
  const turnResponseDelayMs = normalizeTurnResponseDelayPreference(customParameters?.responseDelayMs);
  const languageConfig = resolveCallLanguageConfig(languagePreference);

  mediaConnection.activate();
  mediaConnection.streamSid = streamSid;
  mediaConnection.identity = identity;
  mediaConnection.userId = mediaConnection.userId || parseUserIdFromIdentity(identity);
  mediaConnection.languagePreference = languagePreference;
  mediaConnection.speechRatePreference = speechRatePreference;
  mediaConnection.turnResponseDelayMs = turnResponseDelayMs;
  mediaConnection.conversationHistory = [];
  mediaConnection.lastFinalTranscript = null;
  mediaConnection.lastSpeechEventAt = Date.now();
  mediaConnection.isResponding = false;
  mediaConnection.pendingUserSegments = [];
  mediaConnection.pendingPromptSent = false;
  mediaConnection.pendingTurnTimer = null;
  mediaConnection.recognizerExpiresAt = 0;
  mediaConnection.recognizerPromise = null;
  mediaConnection.touchedNoteIds = new Set();
  mediaConnection.availableNotes = [];
  mediaConnection.noteContextSummary = buildNoteContextSummary([], mediaConnection.languagePreference);
  initializeUsageTracking(mediaConnection);

  console.log(`🎤 Media stream started:`);
  console.log(`   Call SID: ${callSid}`);
  console.log(`   Stream SID: ${streamSid}`);
  console.log(`   Identity: ${identity || 'unknown'}`);
  console.log(`   Language: ${languagePreference}`);
  console.log(`   Speech rate: ${speechRatePreference}`);
  console.log(`   Response delay: ${turnResponseDelayMs}ms`);

  ensureRecognizer(mediaConnection, ws, 'initial');
  refreshAvailableNotesContext(mediaConnection);

  sendAssistantReply(ws, mediaConnection, languageConfig.greeting)
    .then(() => {
      console.log(`${getCallLogPrefix(mediaConnection)} Sending initial greeting audio`);
    })
    .catch((error) => {
      console.error(`${getCallLogPrefix(mediaConnection)} Error sending initial greeting audio:`, error);
    });
}

async function handleMedia(message, mediaConnection, ws) {
  try {
    const { payload, sequenceNumber } = message.media;
    const audioBuffer = Buffer.from(payload, 'base64');
    const recognizerExpired =
      Boolean(mediaConnection.recognizer) &&
      Number(mediaConnection.recognizerExpiresAt || 0) <= Date.now();

    mediaConnection.addAudioChunk(audioBuffer);

    if (!mediaConnection.sttDisabled && (!mediaConnection.recognizer || recognizerExpired)) {
      if (recognizerExpired) {
        console.log(`${getCallLogPrefix(mediaConnection)} Refreshing streaming recognizer before duration limit`);
      }

      await ensureRecognizer(mediaConnection, ws, recognizerExpired ? 'refresh' : 'recreate');
    }

    if (
      mediaConnection.recognizer?.stream?.writable &&
      !mediaConnection.recognizer.stream.destroyed &&
      !mediaConnection.recognizer.stream.writableEnded
    ) {
      mediaConnection.recognizer.stream.write(audioBuffer);
    }

    if (sequenceNumber && sequenceNumber % 100 === 0) {
      const stats = mediaConnection.getStats();
      console.log(`${getCallLogPrefix(mediaConnection)} Audio chunks processed: ${stats.audioChunksReceived}`);
    }
  } catch (error) {
    console.error(`${getCallLogPrefix(mediaConnection)} Error handling media chunk:`, error);
  }
}

async function handleStop(message, mediaConnection, ws) {
  try {
    const { callSid } = message.stop;
    const stats = mediaConnection.getStats();

    console.log(`🛑 Media stream stopped:`);
    console.log(`   Call SID: ${callSid}`);
    console.log(`   Duration: ${Math.round(stats.duration / 1000)}s`);
    console.log(`   Audio chunks: ${stats.audioChunksReceived}`);
    console.log(`   Bytes received: ${stats.bytesReceived}`);

    releaseRecognizer(mediaConnection);

    clearPendingTurnTimer(mediaConnection);

    if (getPendingUserTurnText(mediaConnection)) {
      commitPendingUserTurn(mediaConnection);
    }

    await finalizeCallArtifacts(mediaConnection, stats);

    console.log(
      `${getCallLogPrefix(mediaConnection)} Final transcript lines captured: ${mediaConnection.transcriptBuffer.filter((line) => line.isFinal).length}`
    );

    mediaConnection.close();
  } catch (error) {
    console.error(`${getCallLogPrefix(mediaConnection)} Error handling media stop:`, error);
  }
}

function sendMediaMessage(ws, message) {
  try {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message), { compress: false });
    }
  } catch (error) {
    console.error('Error sending media message:', error);
  }
}

export function sendAudioResponse(ws, streamSid, audioPayload) {
  try {
    const message = {
      event: 'media',
      streamSid,
      media: {
        payload: audioPayload.toString('base64')
      }
    };

    sendMediaMessage(ws, message);
  } catch (error) {
    console.error('Error sending audio response:', error);
  }
}

export function sendTranscriptUpdate(ws, streamSid, transcript, isFinal = false) {
  try {
    const message = {
      event: 'transcript',
      streamSid,
      transcript: {
        text: transcript,
        isFinal,
        timestamp: Date.now()
      }
    };

    sendMediaMessage(ws, message);
  } catch (error) {
    console.error('Error sending transcript update:', error);
  }
}

export default {
  handleMediaStreamWebSocket,
  sendAudioResponse,
  sendTranscriptUpdate
};
