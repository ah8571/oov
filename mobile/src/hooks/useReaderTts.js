/**
 * useReaderTts — Reusable hook for text-to-speech in the reader bar.
 * Extracted from ReaderScreen so the CreateNoteScreen can use it.
 */
import { useCallback, useRef, useState, useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { useTextToSpeech, models } from 'react-native-executorch';
import {
  generateReaderAudio,
  getSavedReaderAudio,
  saveReaderAudio,
  getSavedReaderAudioById
} from '../services/api.js';
import { getCallLanguagePreference, getSpeechRatePreference } from '../utils/secureStorage.js';

// ── Voice options (Kokoro only) ────────────────────────────────
// Full catalog: 9 languages, 20 voices from Kokoro-82M
export const READER_VOICE_OPTIONS = [
  // ── American English ──
  { id: 'kokoro_heart',   label: 'Heart',   description: 'American English · Female', provider: 'kokoro-runpod', voice: 'af_heart',   language: 'en-us' },
  { id: 'kokoro_river',   label: 'River',   description: 'American English · Female', provider: 'kokoro-runpod', voice: 'af_river',   language: 'en-us' },
  { id: 'kokoro_sarah',   label: 'Sarah',   description: 'American English · Female', provider: 'kokoro-runpod', voice: 'af_sarah',   language: 'en-us' },
  { id: 'kokoro_adam',    label: 'Adam',    description: 'American English · Male',   provider: 'kokoro-runpod', voice: 'am_adam',    language: 'en-us' },
  { id: 'kokoro_michael', label: 'Michael', description: 'American English · Male',   provider: 'kokoro-runpod', voice: 'am_michael', language: 'en-us' },
  { id: 'kokoro_santa',   label: 'Santa',   description: 'American English · Male',   provider: 'kokoro-runpod', voice: 'am_santa',   language: 'en-us' },
  // ── British English ──
  { id: 'kokoro_emma',    label: 'Emma',    description: 'British English · Female',  provider: 'kokoro-runpod', voice: 'bf_emma',    language: 'en-gb' },
  { id: 'kokoro_daniel',  label: 'Daniel',  description: 'British English · Male',    provider: 'kokoro-runpod', voice: 'bm_daniel',  language: 'en-gb' },
  // ── Spanish ──
  { id: 'kokoro_es_dora', label: 'Dora',    description: 'Spanish · Female',          provider: 'kokoro-runpod', voice: 'ef_dora',    language: 'es' },
  { id: 'kokoro_es_alex', label: 'Alex',    description: 'Spanish · Male',            provider: 'kokoro-runpod', voice: 'em_alex',    language: 'es' },
  // ── French ──
  { id: 'kokoro_siwis',   label: 'Siwis',   description: 'French · Female',           provider: 'kokoro-runpod', voice: 'ff_siwis',   language: 'fr' },
  // ── Italian ──
  { id: 'kokoro_it_sara',  label: 'Sara',    description: 'Italian · Female',          provider: 'kokoro-runpod', voice: 'if_sara',    language: 'it' },
  { id: 'kokoro_it_nicola',label: 'Nicola',  description: 'Italian · Male',            provider: 'kokoro-runpod', voice: 'im_nicola',  language: 'it' },
  // ── Portuguese ──
  { id: 'kokoro_pt_dora',  label: 'Dora',    description: 'Portuguese · Female',       provider: 'kokoro-runpod', voice: 'pf_dora',    language: 'pt' },
  { id: 'kokoro_pt_santa', label: 'Santa',   description: 'Portuguese · Male',         provider: 'kokoro-runpod', voice: 'pm_santa',   language: 'pt' },
  // ── German ──
  { id: 'kokoro_anna',     label: 'Anna',    description: 'German · Female',           provider: 'kokoro-runpod', voice: 'df_anna',    language: 'de' },
  // ── Hindi ──
  { id: 'kokoro_alpha',    label: 'Alpha',   description: 'Hindi · Female',            provider: 'kokoro-runpod', voice: 'hf_alpha',   language: 'hi' },
  { id: 'kokoro_omega',    label: 'Omega',   description: 'Hindi · Male',              provider: 'kokoro-runpod', voice: 'hm_omega',   language: 'hi' },
  { id: 'kokoro_psi',      label: 'Psi',     description: 'Hindi · Male',              provider: 'kokoro-runpod', voice: 'hm_psi',     language: 'hi' },
  // ── Polish ──
  { id: 'kokoro_mateusz',  label: 'Mateusz', description: 'Polish · Male',             provider: 'kokoro-runpod', voice: 'pm_mateusz', language: 'pl' },
];

// ── WAV helpers ────────────────────────────────────────────────
const KOKORO_SAMPLE_RATE = 24000;

const buildWavHeader = (dataLength, sampleRate = KOKORO_SAMPLE_RATE, numChannels = 1, bitsPerSample = 16) => {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
};

const READER_AUDIO_DIRECTORY = `${FileSystem.documentDirectory}reader-audio`;

const ensureReaderAudioDirectory = async () => {
  const dirInfo = await FileSystem.getInfoAsync(READER_AUDIO_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(READER_AUDIO_DIRECTORY, { intermediates: true });
  }
};

const sanitizeAudioFileName = (value) =>
  String(value || 'reader-audio').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'reader-audio';

// ── Text chunking for basic voice ──────────────────────────────
const MAX_SPEECH_CHUNK_LENGTH = 1600;

const splitTextIntoSpeechChunks = (source) => {
  const chunks = [];
  let remaining = source;
  while (remaining.length > MAX_SPEECH_CHUNK_LENGTH) {
    const candidate = remaining.slice(0, MAX_SPEECH_CHUNK_LENGTH);
    const sentenceBreak = Math.max(
      candidate.lastIndexOf('. '),
      candidate.lastIndexOf('? '),
      candidate.lastIndexOf('! '),
      candidate.lastIndexOf('\n')
    );
    const wordBreak = candidate.lastIndexOf(' ');
    const minBreak = Math.max(80, Math.floor(MAX_SPEECH_CHUNK_LENGTH * 0.75));
    const breakIndex = sentenceBreak > minBreak ? sentenceBreak + 1 : wordBreak > minBreak ? wordBreak : MAX_SPEECH_CHUNK_LENGTH;
    chunks.push(remaining.slice(0, breakIndex).trim());
    remaining = remaining.slice(breakIndex).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
};

// ── Hook ───────────────────────────────────────────────────────
export const useReaderTts = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [savedAudioEntries, setSavedAudioEntries] = useState([]);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [justCompletedTs, setJustCompletedTs] = useState(0);

  const speechChunksRef = useRef([]);
  const speechIndexRef = useRef(0);
  const speechCancelledRef = useRef(false);
  const activeSoundRef = useRef(null);
  const activeSoundUriRef = useRef(null);

  // On-device Kokoro hook (deferred load)
  const [kokoroLoadRequested, setKokoroLoadRequested] = useState(false);
  const kokoroTts = useTextToSpeech(
    models.text_to_speech.kokoro.en_us.heart(),
    { preventLoad: !kokoroLoadRequested }
  );
  const kokoroTtsRef = useRef(kokoroTts);
  kokoroTtsRef.current = kokoroTts;

  // ── Stop all playback + refresh saved list ─────────────────
  const stopReading = useCallback(async () => {
    speechCancelledRef.current = true;
    speechChunksRef.current = [];
    speechIndexRef.current = 0;
    setIsPreparing(false);
    setIsSpeaking(false);
    setEstimatedTime(null);
    try { await Speech.stop(); } catch {}
    try { activeSoundRef.current?.unloadAsync(); } catch {}
    activeSoundRef.current = null;
    // Backend auto-saves during generation — refresh the list so the recording appears
    refreshSavedAudio();
  }, [refreshSavedAudio]);

  // Unload on unmount
  useEffect(() => () => { stopReading(); }, [stopReading]);

  // ── Fallback audio playback (Resemble / backend TTS) ────────
  const playFallbackAudio = useCallback(async ({ text, title, provider, voiceProfile, languagePreference, speechRate }) => {
    setIsPreparing(true);
    try {
      const response = await generateReaderAudio({ text, title, provider, voiceProfile, languagePreference, speechRate });
      if (!response?.success || !response.audioBase64) {
        throw new Error(response?.error || 'Unable to generate audio');
      }
      if (speechCancelledRef.current) return;

      await ensureReaderAudioDirectory();
      const fileName = sanitizeAudioFileName(title || response.fileName || 'reader');
      const uri = `${READER_AUDIO_DIRECTORY}/preview-${Date.now()}-${fileName}.mp3`;
      await FileSystem.writeAsStringAsync(uri, response.audioBase64, { encoding: FileSystem.EncodingType.Base64 });
      activeSoundUriRef.current = uri;

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (status) => {
        if (status.didJustFinish) {
          setIsSpeaking(false);
          setEstimatedTime(null);
          setJustCompletedTs(Date.now());
          sound.unloadAsync().catch(() => {});
          activeSoundRef.current = null;
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
          // Refresh saved list so the "Saved" indicator appears
          refreshSavedAudio();
        }
      });
      activeSoundRef.current = sound;
      setIsPreparing(false);
      setIsSpeaking(true);
    } catch (error) {
      setIsPreparing(false);
      setIsSpeaking(false);
      setEstimatedTime(null);
      Alert.alert('Reader error', error?.message || 'Unable to play audio');
    }
  }, [refreshSavedAudio]);

  // ── On-device Kokoro playback ───────────────────────────────
  const playKokoroOnDevice = useCallback(async (text, title, speechRate) => {
    const tts = kokoroTtsRef.current;
    if (!tts.isReady) {
      setKokoroLoadRequested(true);
      setIsPreparing(true);
      // Wait for model
      for (let i = 0; i < 30; i++) {
        if (kokoroTtsRef.current.isReady) break;
        await new Promise(r => setTimeout(r, 1000));
      }
      setIsPreparing(false);
      if (!kokoroTtsRef.current.isReady) {
        throw new Error('Voice model is still downloading. Please wait.');
      }
    }
    if (tts.error) throw new Error(tts.error.message || 'Model failed to load');

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
    await ensureReaderAudioDirectory();

    const fileStem = sanitizeAudioFileName((title || 'reader').replace(/\.mp3$|\.wav$/i, ''));
    const allPcmChunks = [];
    const wavQueue = [];
    let streamDone = false;
    const MIN_BUFFERED_CHUNKS = 3;

    const streamPromise = tts.stream({
      text,
      speed: speechRate,
      phonemize: true,
      stopAutomatically: true,
      onNext: (float32Audio) => {
        const int16 = new Int16Array(float32Audio.length);
        for (let i = 0; i < float32Audio.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Audio[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const pcmBytes = new Uint8Array(int16.buffer);
        allPcmChunks.push(pcmBytes);
        const wavHeader = buildWavHeader(pcmBytes.length);
        const wavBuffer = new Uint8Array(wavHeader.length + pcmBytes.length);
        wavBuffer.set(wavHeader, 0);
        wavBuffer.set(pcmBytes, wavHeader.length);
        const uri = `${READER_AUDIO_DIRECTORY}/kokoro-${Date.now()}-${wavQueue.length}-${fileStem}.wav`;
        FileSystem.writeAsStringAsync(uri, Buffer.from(wavBuffer).toString('base64'), { encoding: FileSystem.EncodingType.Base64 })
          .then(() => wavQueue.push(uri)).catch(() => {});
      }
    });

    // Wait for buffered chunks
    while (wavQueue.length < MIN_BUFFERED_CHUNKS && !streamDone) {
      const settled = await Promise.race([streamPromise.then(() => true), new Promise(r => setTimeout(r, 200))]);
      if (settled) { streamDone = true; try { await streamPromise; } catch {} }
    }

    setIsSpeaking(true);
    let chunkIndex = 0;
    while (!speechCancelledRef.current) {
      if (wavQueue.length === 0) {
        if (streamDone) break;
        await new Promise(r => setTimeout(r, 150));
        continue;
      }
      const uri = wavQueue.shift();
      await new Promise((resolve) => {
        Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (status) => {
          if (status.didJustFinish) resolve();
        }).then(({ sound }) => { activeSoundRef.current = sound; });
      });
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      chunkIndex++;
    }
    try { await streamPromise; } catch {}

    // Auto-save full audio
    if (!speechCancelledRef.current && allPcmChunks.length > 0) {
      const totalPcm = allPcmChunks.reduce((sum, c) => sum + c.length, 0);
      const fullPcm = new Uint8Array(totalPcm);
      let off = 0;
      for (const c of allPcmChunks) { fullPcm.set(c, off); off += c.length; }
      const fullWav = Buffer.concat([buildWavHeader(totalPcm), Buffer.from(fullPcm)]);
      saveReaderAudio({ text, title, provider: 'device', voiceProfile: 'kokoro-on-device', audioBase64: fullWav.toString('base64') })
        .then((r) => { if (r.success) refreshSavedAudio(); }).catch(() => {});
    }
    setIsSpeaking(false);
    setEstimatedTime(null);
    setJustCompletedTs(Date.now());
    for (const uri of wavQueue) { FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}); }
  }, []);

  // ── Basic voice playback ────────────────────────────────────
  const speakNextChunk = useCallback(async (language, rate) => {
    if (speechCancelledRef.current) return;
    const nextChunk = speechChunksRef.current[speechIndexRef.current];
    if (!nextChunk) { setIsSpeaking(false); return; }

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, playThroughEarpieceAndroid: false });
    } catch {}

    let callbackFired = false;
    Speech.speak(nextChunk, {
      rate,
      onDone: () => {
        callbackFired = true;
        speechIndexRef.current++;
        if (speechIndexRef.current >= speechChunksRef.current.length) { setIsSpeaking(false); return; }
        speakNextChunk(language, rate);
      },
      onStopped: () => { callbackFired = true; setIsSpeaking(false); },
      onError: (e) => { callbackFired = true; setIsSpeaking(false); }
    });

    // Polling fallback for Android
    const poll = async () => {
      for (let i = 0; i < 30 && !callbackFired && !speechCancelledRef.current; i++) {
        await new Promise(r => setTimeout(r, 500));
        try { const s = await Speech.isSpeakingAsync(); if (!s && !callbackFired) { speechIndexRef.current++; if (speechIndexRef.current >= speechChunksRef.current.length) { setIsSpeaking(false); return; } speakNextChunk(language, rate); return; } } catch {}
      }
    };
    poll().catch(() => {});
  }, []);

  // ── Main read-aloud entry ───────────────────────────────────
  const readAloud = useCallback(async (text, title, voiceId) => {
    const normalized = String(text || '').trim();
    if (!normalized) { Alert.alert('Nothing to read', 'Paste text or import a document first.'); return; }

    await stopReading();
    const voice = READER_VOICE_OPTIONS.find(o => o.id === voiceId) || READER_VOICE_OPTIONS[0];

    const [lang, savedRate] = await Promise.all([getCallLanguagePreference(), getSpeechRatePreference()]);
    const rate = Math.max(0.75, Math.min(1.1, Number(savedRate) || 1));
    const language = lang === 'es' ? 'es-US' : 'en-US';

    speechCancelledRef.current = false;

    // Estimate time
    const charCount = normalized.length;
    const msPerChar = 3; // GPU Kokoro ~3ms/char
    const estSecs = Math.ceil(charCount * msPerChar / 1000);
    const mins = Math.floor(estSecs / 60);
    const secs = estSecs % 60;
    setEstimatedTime(mins > 0 ? `~${mins}m ${secs}s` : `~${secs}s`);

    // All voices use the Kokoro GPU backend — pass the voice name (e.g. af_heart)
    playFallbackAudio({
      text: normalized,
      title,
      provider: 'kokoro-runpod',
      voiceProfile: voice.voice || 'af_heart',
      languagePreference: lang,
      speechRate: rate
    });
  }, [stopReading, playFallbackAudio]);

  // ── Saved audio ─────────────────────────────────────────────
  const refreshSavedAudio = useCallback(async () => {
    try {
      const resp = await getSavedReaderAudio();
      if (resp?.success) setSavedAudioEntries(resp.entries || []);
    } catch {}
  }, []);

  return {
    isSpeaking,
    isPreparing,
    savedAudioEntries,
    readAloud,
    stopReading,
    refreshSavedAudio,
    estimatedTime,
    justCompletedTs,
    voiceOptions: READER_VOICE_OPTIONS
  };
};
