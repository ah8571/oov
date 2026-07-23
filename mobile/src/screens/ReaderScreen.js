import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deleteSavedReaderAudio,
  generateReaderAudio,
  getSavedReaderAudio,
  importReaderDocument,
  saveReaderAudio,
  updateSavedReaderAudio
} from '../services/api.js';
import { useAppTheme } from '../theme/appTheme.js';
import { getCallLanguagePreference, getSpeechRatePreference } from '../utils/secureStorage.js';

const BOTTOM_SAFE_ZONE = 44;
const MAX_SPEECH_CHUNK_LENGTH = 1600;
const MIN_BODY_INPUT_HEIGHT = 280;
const READER_AUDIO_DIRECTORY = `${FileSystem.documentDirectory}reader-audio`;
const READER_AUDIO_INDEX_FILE = `${READER_AUDIO_DIRECTORY}/latest.json`;
const READER_TTS_START_TIMEOUT_MS = 2500;
const SAVED_READER_AUDIO_REFRESH_INTERVAL_MS = 8000;
const READER_AUDIO_VOICE_OPTIONS = [
  {
    id: 'lucy',
    label: 'Lucy',
    provider: 'resemble'
  },
  {
    id: 'ethan',
    label: 'Ethan',
    provider: 'resemble'
  },
  {
    id: 'kokoro',
    label: 'Free',
    provider: 'openrouter'
  },
  {
    id: 'basic',
    label: 'Basic',
    provider: 'device'
  }
];

const logReaderTts = (step, details = null) => {
  if (details === null || details === undefined) {
    console.log(`[ReaderTTS] ${step}`);
    return;
  }

  console.log(`[ReaderTTS] ${step}`, details);
};

const resolveSpeechLanguage = (languagePreference) => {
  if (languagePreference === 'es') {
    return 'es-US';
  }

  return 'en-US';
};

const splitTextIntoSpeechChunks = (text) => {
  const source = String(text || '').trim();

  if (!source) {
    return [];
  }

  const chunks = [];
  let remainingText = source;

  while (remainingText.length > MAX_SPEECH_CHUNK_LENGTH) {
    const candidate = remainingText.slice(0, MAX_SPEECH_CHUNK_LENGTH);
    const sentenceBreak = Math.max(
      candidate.lastIndexOf('. '),
      candidate.lastIndexOf('? '),
      candidate.lastIndexOf('! '),
      candidate.lastIndexOf('\n')
    );
    const wordBreak = candidate.lastIndexOf(' ');
    const breakIndex = sentenceBreak > 300 ? sentenceBreak + 1 : wordBreak > 300 ? wordBreak : MAX_SPEECH_CHUNK_LENGTH;

    chunks.push(remainingText.slice(0, breakIndex).trim());
    remainingText = remainingText.slice(breakIndex).trim();
  }

  if (remainingText) {
    chunks.push(remainingText);
  }

  return chunks.filter(Boolean);
};

const buildReaderTextSignature = (title, text) => {
  return JSON.stringify({
    title: String(title || '').trim(),
    text: String(text || '').trim()
  });
};

const sanitizeAudioFileName = (value) => {
  const normalized = String(value || 'reader-audio')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'reader-audio';
};

const ensureReaderAudioDirectory = async () => {
  const directoryInfo = await FileSystem.getInfoAsync(READER_AUDIO_DIRECTORY);

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(READER_AUDIO_DIRECTORY, { intermediates: true });
  }
};

const normalizeSavedReaderAudioEntries = (value) => {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : [];

  return entries
    .filter((entry) => entry && typeof entry === 'object' && entry.uri)
    .sort((leftEntry, rightEntry) => {
      const leftTimestamp = Date.parse(leftEntry.createdAt || 0) || 0;
      const rightTimestamp = Date.parse(rightEntry.createdAt || 0) || 0;
      return rightTimestamp - leftTimestamp;
    });
};

const loadSavedReaderAudio = async () => {
  await ensureReaderAudioDirectory();
  const indexInfo = await FileSystem.getInfoAsync(READER_AUDIO_INDEX_FILE);

  if (!indexInfo.exists) {
    return [];
  }

  const serializedEntry = await FileSystem.readAsStringAsync(READER_AUDIO_INDEX_FILE);
  const parsedEntry = JSON.parse(serializedEntry);
  const normalizedEntries = normalizeSavedReaderAudioEntries(parsedEntry);
  const existingEntries = [];

  for (const entry of normalizedEntries) {
    const audioInfo = await FileSystem.getInfoAsync(entry.uri);

    if (audioInfo.exists) {
      existingEntries.push(entry);
    }
  }

  if (existingEntries.length !== normalizedEntries.length) {
    await persistSavedReaderAudio(existingEntries);
  }

  return existingEntries;
};

const persistSavedReaderAudio = async (entries) => {
  await ensureReaderAudioDirectory();
  await FileSystem.writeAsStringAsync(READER_AUDIO_INDEX_FILE, JSON.stringify(normalizeSavedReaderAudioEntries(entries)));
};

const formatAudioTime = (value) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const buildSavedAudioFileName = (title, fallbackValue = 'reader-audio') => {
  const fallbackStem = String(fallbackValue || 'reader-audio').replace(/\.mp3$/i, '');
  return `${sanitizeAudioFileName(title || fallbackStem)}.mp3`;
};

const renameSavedAudioFileIfNeeded = async (entry, nextTitle, nextFileName = null) => {
  if (!entry?.uri) {
    return {
      uri: entry?.uri || null,
      fileName: nextFileName || buildSavedAudioFileName(nextTitle, entry?.fileName)
    };
  }

  const resolvedFileName = nextFileName || buildSavedAudioFileName(nextTitle, entry.fileName);
  const currentUri = String(entry.uri);
  const currentFileName = currentUri.split('/').pop() || '';
  const entryPrefix = currentFileName.includes('-') ? currentFileName.slice(0, currentFileName.indexOf('-')) : String(entry.savedAudioId || entry.id || Date.now());
  const targetUri = `${READER_AUDIO_DIRECTORY}/${entryPrefix}-${resolvedFileName}`;

  if (targetUri !== currentUri) {
    const currentInfo = await FileSystem.getInfoAsync(currentUri);

    if (currentInfo.exists) {
      await FileSystem.moveAsync({ from: currentUri, to: targetUri });
    }
  }

  return {
    uri: targetUri,
    fileName: resolvedFileName
  };
};

const buildSavedAudioEntryFromRemote = async (entry) => {
  if (!entry?.id || !entry?.audioBase64) {
    return null;
  }

  await ensureReaderAudioDirectory();

  const normalizedFileName = sanitizeAudioFileName((entry.fileName || entry.title || 'reader-audio').replace(/\.mp3$/i, ''));
  const targetUri = `${READER_AUDIO_DIRECTORY}/${entry.id}-${normalizedFileName}.mp3`;
  const audioInfo = await FileSystem.getInfoAsync(targetUri);

  if (!audioInfo.exists) {
    await FileSystem.writeAsStringAsync(targetUri, entry.audioBase64, {
      encoding: FileSystem.EncodingType.Base64
    });
  }

  return {
    id: entry.id,
    savedAudioId: entry.id,
    title: entry.title || 'Reader audio',
    uri: targetUri,
    fileName: entry.fileName || `${normalizedFileName}.mp3`,
    createdAt: entry.createdAt || new Date().toISOString(),
    textSignature: null,
    characterCount: entry.metadata?.characterCount || 0,
    languageCode: entry.metadata?.languageCode || 'en-US'
  };
};

const syncSavedReaderAudioFromBackend = async (existingEntries = []) => {
  const response = await getSavedReaderAudio();

  if (!response.success) {
    throw new Error(response.error || 'Unable to load saved audio.');
  }

  const remoteEntries = [];

  for (const entry of response.entries || []) {
    const normalizedEntry = await buildSavedAudioEntryFromRemote(entry);

    if (normalizedEntry) {
      remoteEntries.push(normalizedEntry);
    }
  }

  const localOnlyEntries = normalizeSavedReaderAudioEntries(existingEntries).filter((entry) => !entry.savedAudioId);
  const mergedEntries = normalizeSavedReaderAudioEntries([...remoteEntries, ...localOnlyEntries]);
  await persistSavedReaderAudio(mergedEntries);

  return mergedEntries;
};

const ReaderScreen = ({ onAppHeaderScroll }) => {
  const { colors, isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [documentTitle, setDocumentTitle] = useState('');
  const [readerText, setReaderText] = useState('');
  const [importMetadata, setImportMetadata] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparingReadAloudFallback, setIsPreparingReadAloudFallback] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [savedAudioEntries, setSavedAudioEntries] = useState([]);
  const [activeSavedAudioId, setActiveSavedAudioId] = useState(null);
  const [editingSavedAudioId, setEditingSavedAudioId] = useState(null);
  const [editingSavedAudioTitle, setEditingSavedAudioTitle] = useState('');
  const [isUpdatingSavedAudioId, setIsUpdatingSavedAudioId] = useState(null);
  const [loadedSavedAudioId, setLoadedSavedAudioId] = useState(null);
  const [playingSavedAudioId, setPlayingSavedAudioId] = useState(null);
  const [selectedReaderVoiceId, setSelectedReaderVoiceId] = useState(READER_AUDIO_VOICE_OPTIONS[0].id);
  const [savedAudioPlaybackState, setSavedAudioPlaybackState] = useState({
    entryId: null,
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0
  });
  const [bodyInputHeight, setBodyInputHeight] = useState(MIN_BODY_INPUT_HEIGHT);
  const speechChunksRef = useRef([]);
  const speechIndexRef = useRef(0);
  const speechCancelledRef = useRef(false);
  const speechStartTimeoutRef = useRef(null);
  const readAloudFallbackSoundRef = useRef(null);
  const readAloudFallbackUriRef = useRef(null);
  const savedAudioSoundRef = useRef(null);
  const savedAudioSeekTrackWidthsRef = useRef({});
  const savedAudioEntriesRef = useRef([]);

  const currentTextSignature = buildReaderTextSignature(documentTitle, readerText);

  useEffect(() => {
    savedAudioEntriesRef.current = savedAudioEntries;
  }, [savedAudioEntries]);

  const refreshSavedAudioEntries = useCallback(async ({ hydrateLocal = false } = {}) => {
    let existingEntries = savedAudioEntriesRef.current;

    if (hydrateLocal) {
      existingEntries = await loadSavedReaderAudio();
      setSavedAudioEntries(existingEntries);
    }

    const syncedEntries = await syncSavedReaderAudioFromBackend(existingEntries);
    setSavedAudioEntries(syncedEntries);
  }, []);

  useEffect(() => {
    refreshSavedAudioEntries({ hydrateLocal: true }).catch((error) => {
      console.error('Error loading saved reader audio:', error);
    });

    const refreshIntervalId = setInterval(() => {
      refreshSavedAudioEntries().catch((error) => {
        console.error('Error refreshing saved reader audio:', error);
      });
    }, SAVED_READER_AUDIO_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(refreshIntervalId);
      speechCancelledRef.current = true;
      const unloadReadAloudFallbackAudio = async () => {
        if (readAloudFallbackSoundRef.current) {
          try {
            await readAloudFallbackSoundRef.current.unloadAsync();
          } catch {
            // Ignore cleanup failures during unmount.
          } finally {
            readAloudFallbackSoundRef.current = null;
          }
        }

        if (readAloudFallbackUriRef.current) {
          try {
            await FileSystem.deleteAsync(readAloudFallbackUriRef.current, { idempotent: true });
          } catch {
            // Ignore cleanup failures during unmount.
          } finally {
            readAloudFallbackUriRef.current = null;
          }
        }
      };

      const unloadSavedAudio = async () => {
        if (!savedAudioSoundRef.current) {
          return;
        }

        try {
          await savedAudioSoundRef.current.unloadAsync();
        } catch {
          // Ignore cleanup failures during unmount.
        } finally {
          savedAudioSoundRef.current = null;
        }
      };

      Speech.stop().catch(() => {
        // Ignore cleanup failures during unmount.
      });
      if (speechStartTimeoutRef.current) {
        clearTimeout(speechStartTimeoutRef.current);
        speechStartTimeoutRef.current = null;
      }
      unloadReadAloudFallbackAudio().catch(() => {
        // Ignore cleanup failures during unmount.
      });
      unloadSavedAudio().catch(() => {
        // Ignore cleanup failures during unmount.
      });
      onAppHeaderScroll?.(0);
    };
  }, [onAppHeaderScroll]);

  const handleScroll = (event) => {
    const nextOffsetY = Math.max(0, event.nativeEvent.contentOffset.y || 0);
    onAppHeaderScroll?.(nextOffsetY);
  };

  const stopReading = useCallback(async () => {
    logReaderTts('stopReading:start', {
      isSpeaking,
      queuedChunks: speechChunksRef.current.length,
      currentChunkIndex: speechIndexRef.current
    });
    speechCancelledRef.current = true;
    speechChunksRef.current = [];
    speechIndexRef.current = 0;
    if (speechStartTimeoutRef.current) {
      clearTimeout(speechStartTimeoutRef.current);
      speechStartTimeoutRef.current = null;
    }
    setIsPreparingReadAloudFallback(false);
    setIsSpeaking(false);

    try {
      await Speech.stop();
      logReaderTts('stopReading:completed');
    } catch {
      logReaderTts('stopReading:stopError');
      // Some Android TTS engines throw when stop is called before the engine binds.
    }

    if (readAloudFallbackSoundRef.current) {
      try {
        await readAloudFallbackSoundRef.current.stopAsync();
      } catch {
        // Ignore best-effort stop failures.
      }

      try {
        await readAloudFallbackSoundRef.current.unloadAsync();
      } catch {
        // Ignore best-effort unload failures.
      }

      readAloudFallbackSoundRef.current = null;
    }

    if (readAloudFallbackUriRef.current) {
      try {
        await FileSystem.deleteAsync(readAloudFallbackUriRef.current, { idempotent: true });
      } catch {
        // Ignore best-effort cleanup failures.
      }

      readAloudFallbackUriRef.current = null;
    }
  }, [isSpeaking]);

  const stopSavedAudioPlayback = useCallback(async () => {
    const activeSound = savedAudioSoundRef.current;

    if (!activeSound) {
      setLoadedSavedAudioId(null);
      setPlayingSavedAudioId(null);
      setSavedAudioPlaybackState({
        entryId: null,
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 0
      });
      return;
    }

    try {
      await activeSound.stopAsync();
    } catch {
      // Ignore best-effort stop failures.
    }

    try {
      await activeSound.unloadAsync();
    } catch {
      // Ignore best-effort unload failures.
    }

    savedAudioSoundRef.current = null;
    setLoadedSavedAudioId(null);
    setPlayingSavedAudioId(null);
    setSavedAudioPlaybackState({
      entryId: null,
      isPlaying: false,
      positionMillis: 0,
      durationMillis: 0
    });
  }, []);

  const playReadAloudFallbackAudio = useCallback(async ({ text, title, provider = 'resemble', voiceProfile = null, languagePreference, speechRate }) => {
    setIsPreparingReadAloudFallback(true);
    logReaderTts('fallbackAudio:start', {
      languagePreference,
      speechRate,
      textLength: String(text || '').trim().length
    });

    const response = await generateReaderAudio({
      text,
      title,
      provider,
      voiceProfile,
      languagePreference,
      speechRate
    });

    if (!response.success || !response.audioBase64) {
      logReaderTts('fallbackAudio:requestFailed', {
        error: response.error || 'Unable to create reader audio'
      });
      setIsPreparingReadAloudFallback(false);
      setIsSpeaking(false);
      Alert.alert(
        'Reader error',
        response.error || 'Read aloud could not start on this device, and the audio fallback is not available right now.'
      );
      return;
    }

    if (speechCancelledRef.current) {
      logReaderTts('fallbackAudio:cancelledBeforePlayback');
      setIsPreparingReadAloudFallback(false);
      setIsSpeaking(false);
      return;
    }

    await ensureReaderAudioDirectory();

    if (readAloudFallbackUriRef.current) {
      try {
        await FileSystem.deleteAsync(readAloudFallbackUriRef.current, { idempotent: true });
      } catch {
        // Ignore best-effort cleanup failures.
      }
    }

    const fileName = sanitizeAudioFileName((title || response.fileName || 'reader-preview').replace(/\.mp3$/i, ''));
    const targetUri = `${READER_AUDIO_DIRECTORY}/preview-${Date.now()}-${fileName}.mp3`;

    await FileSystem.writeAsStringAsync(targetUri, response.audioBase64, {
      encoding: FileSystem.EncodingType.Base64
    });
    readAloudFallbackUriRef.current = targetUri;

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: targetUri },
      { shouldPlay: true },
      (status) => {
        if (!status.isLoaded) {
          if (status.error) {
            logReaderTts('fallbackAudio:playbackError', {
              error: status.error
            });
            setIsPreparingReadAloudFallback(false);
            setIsSpeaking(false);
            readAloudFallbackSoundRef.current = null;
          }

          return;
        }

        if (status.didJustFinish) {
          logReaderTts('fallbackAudio:finished');
          setIsSpeaking(false);
          sound.unloadAsync().catch(() => {
            // Ignore cleanup failures after playback completes.
          });
          readAloudFallbackSoundRef.current = null;

          if (readAloudFallbackUriRef.current) {
            FileSystem.deleteAsync(readAloudFallbackUriRef.current, { idempotent: true }).catch(() => {
              // Ignore best-effort cleanup failures.
            });
            readAloudFallbackUriRef.current = null;
          }
        }
      }
    );

    readAloudFallbackSoundRef.current = sound;
    setIsPreparingReadAloudFallback(false);
    logReaderTts('fallbackAudio:playing');
  }, []);

  const speakNextChunk = useCallback(async (language, rate, fallbackConfig) => {
    if (speechCancelledRef.current) {
      logReaderTts('speakNextChunk:cancelledBeforeStart');
      return;
    }

    const nextChunk = speechChunksRef.current[speechIndexRef.current];

    if (!nextChunk) {
      logReaderTts('speakNextChunk:noChunkRemaining');
      setIsSpeaking(false);
      return;
    }

    logReaderTts('speakNextChunk:start', {
      chunkIndex: speechIndexRef.current,
      totalChunks: speechChunksRef.current.length,
      chunkLength: nextChunk.length,
      language,
      rate
    });

    if (speechStartTimeoutRef.current) {
      clearTimeout(speechStartTimeoutRef.current);
    }

    speechStartTimeoutRef.current = setTimeout(() => {
      speechStartTimeoutRef.current = null;

      if (speechCancelledRef.current) {
        return;
      }

      logReaderTts('speakNextChunk:startTimeout', {
        chunkIndex: speechIndexRef.current
      });

      if (!fallbackConfig) {
        setIsSpeaking(false);
        return;
      }

      Speech.stop().catch(() => {
        // Ignore best-effort stop failures when the engine never bound.
      });
      playReadAloudFallbackAudio(fallbackConfig).catch((error) => {
        logReaderTts('fallbackAudio:unexpectedError', {
          error: error?.message || String(error)
        });
        setIsSpeaking(false);
        Alert.alert(
          'Reader error',
          'Read aloud could not start on this device, and the audio fallback failed too.'
        );
      });
    }, READER_TTS_START_TIMEOUT_MS);

    Speech.speak(nextChunk, {
      language,
      rate,
      onStart: () => {
        if (speechStartTimeoutRef.current) {
          clearTimeout(speechStartTimeoutRef.current);
          speechStartTimeoutRef.current = null;
        }
        logReaderTts('speakNextChunk:onStart', {
          chunkIndex: speechIndexRef.current
        });
      },
      onDone: () => {
        if (speechStartTimeoutRef.current) {
          clearTimeout(speechStartTimeoutRef.current);
          speechStartTimeoutRef.current = null;
        }
        logReaderTts('speakNextChunk:onDone', {
          chunkIndex: speechIndexRef.current
        });
        speechIndexRef.current += 1;

        if (speechIndexRef.current >= speechChunksRef.current.length) {
          logReaderTts('speakNextChunk:finishedAllChunks');
          setIsSpeaking(false);
          return;
        }

        speakNextChunk(language, rate, fallbackConfig);
      },
      onStopped: () => {
        if (speechStartTimeoutRef.current) {
          clearTimeout(speechStartTimeoutRef.current);
          speechStartTimeoutRef.current = null;
        }
        logReaderTts('speakNextChunk:onStopped', {
          chunkIndex: speechIndexRef.current
        });
        setIsSpeaking(false);
      },
      onError: (error) => {
        if (speechStartTimeoutRef.current) {
          clearTimeout(speechStartTimeoutRef.current);
          speechStartTimeoutRef.current = null;
        }
        logReaderTts('speakNextChunk:onError', {
          chunkIndex: speechIndexRef.current,
          error: error ? String(error) : null
        });
        setIsSpeaking(false);
        Alert.alert('Reader error', 'The device could not read this text aloud.');
      }
    });
  }, [playReadAloudFallbackAudio]);

  const handleReadAloud = useCallback(async () => {
    const normalizedText = String(readerText || '').trim();

    logReaderTts('handleReadAloud:pressed', {
      hasText: Boolean(normalizedText),
      textLength: normalizedText.length
    });

    if (!normalizedText) {
      Alert.alert('Nothing to read', 'Paste text or import a document first.');
      return;
    }

    await stopReading();

    const voiceOption = READER_AUDIO_VOICE_OPTIONS.find((o) => o.id === selectedReaderVoiceId);
    const isBasicVoice = voiceOption?.provider === 'device';

    const [languagePreference, savedSpeechRate] = await Promise.all([
      getCallLanguagePreference(),
      getSpeechRatePreference()
    ]);
    const speechRate = Math.max(0.75, Math.min(1.1, Number(savedSpeechRate) || 1));

    // Basic voice uses device TTS — no backend call, no credits.
    if (isBasicVoice) {
      const language = resolveSpeechLanguage(languagePreference);
      const chunks = splitTextIntoSpeechChunks(normalizedText);
      speechChunksRef.current = chunks;
      speechIndexRef.current = 0;
      speechCancelledRef.current = false;
      setIsSpeaking(true);
      logReaderTts('handleReadAloud:basicVoice', { chunks: chunks.length, language });
      speakNextChunk(language, speechRate, null);
      return;
    }

    const fallbackConfig = {
      text: normalizedText,
      title: documentTitle,
      provider: 'resemble',
      voiceProfile: selectedReaderVoiceId,
      languagePreference,
      speechRate
    };

    logReaderTts('handleReadAloud:prepared', {
      languagePreference,
      speechRate,
      provider: fallbackConfig.provider,
      voiceProfile: fallbackConfig.voiceProfile
    });

    speechCancelledRef.current = false;
    setIsSpeaking(true);
    playReadAloudFallbackAudio(fallbackConfig).catch((error) => {
      logReaderTts('handleReadAloud:resembleFailed', {
        error: error?.message || String(error)
      });
      setIsSpeaking(false);
      Alert.alert('Reader error', error?.message || 'Unable to play the selected voice right now.');
    });
  }, [documentTitle, playReadAloudFallbackAudio, readerText, selectedReaderVoiceId, stopReading]);

  const handleImportDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false
      });

      if (result.canceled) {
        return;
      }

      const selectedFile = result.assets?.[0];

      if (!selectedFile) {
        Alert.alert('Import error', 'No document was selected.');
        return;
      }

      setIsImporting(true);
      const response = await importReaderDocument(selectedFile);

      if (!response.success) {
        throw new Error(response.error || 'Unable to import document');
      }

      await stopReading();
      setDocumentTitle(response.title || selectedFile.name || 'Imported document');
      setReaderText(response.text || '');
      setImportMetadata(response.metadata || null);
    } catch (error) {
      Alert.alert('Import failed', error.message || 'Unable to import this document right now.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerateAudio = useCallback(async () => {
    const normalizedText = String(readerText || '').trim();

    if (!normalizedText) {
      Alert.alert('Nothing to save', 'Paste text or import a document first.');
      return;
    }

    try {
      setIsGeneratingAudio(true);
      await stopSavedAudioPlayback();

      const [languagePreference, savedSpeechRate] = await Promise.all([
        getCallLanguagePreference(),
        getSpeechRatePreference()
      ]);
      const speechRate = Math.max(0.75, Math.min(1.1, Number(savedSpeechRate) || 1));
      const response = await saveReaderAudio({
        text: normalizedText,
        title: documentTitle,
        provider: 'resemble',
        voiceProfile: selectedReaderVoiceId,
        languagePreference,
        speechRate
      });

      if (!response.success) {
        throw new Error(response.error || 'Unable to create reader audio');
      }

      await ensureReaderAudioDirectory();

      const fileName = sanitizeAudioFileName((response.fileName || documentTitle || 'reader-audio').replace(/\.mp3$/i, ''));
      const targetUri = `${READER_AUDIO_DIRECTORY}/${Date.now()}-${fileName}.mp3`;

      await FileSystem.writeAsStringAsync(targetUri, response.audioBase64, {
        encoding: FileSystem.EncodingType.Base64
      });

      const nextSavedAudioEntry = {
        id: response.savedAudioId || String(Date.now()),
        savedAudioId: response.savedAudioId || null,
        title: documentTitle || 'Reader audio',
        uri: targetUri,
        fileName: `${fileName}.mp3`,
        createdAt: response.createdAt || new Date().toISOString(),
        textSignature: buildReaderTextSignature(documentTitle, readerText),
        characterCount: response.metadata?.characterCount || normalizedText.length,
        languageCode: response.metadata?.languageCode || resolveSpeechLanguage(languagePreference),
        provider: response.metadata?.provider || 'resemble',
        voiceProfile: response.metadata?.voiceProfile || selectedReaderVoiceId
      };

      const nextSavedAudioEntries = normalizeSavedReaderAudioEntries([nextSavedAudioEntry, ...savedAudioEntries]);
      await persistSavedReaderAudio(nextSavedAudioEntries);
      setSavedAudioEntries(nextSavedAudioEntries);
      setActiveSavedAudioId(nextSavedAudioEntry.id);
    } catch (error) {
      Alert.alert('Audio save failed', error.message || 'Unable to save this audio file right now.');
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [documentTitle, readerText, savedAudioEntries, selectedReaderVoiceId, stopSavedAudioPlayback]);

  const handleToggleSavedAudioPlayback = useCallback(async (entry) => {
    if (!entry?.uri) {
      return;
    }

    try {
      await stopReading();

      if (loadedSavedAudioId === entry.id && savedAudioSoundRef.current) {
        const status = await savedAudioSoundRef.current.getStatusAsync();

        if (status.isLoaded && status.isPlaying) {
          await savedAudioSoundRef.current.pauseAsync();
          setPlayingSavedAudioId(null);
          setSavedAudioPlaybackState({
            entryId: entry.id,
            isPlaying: false,
            positionMillis: Number(status.positionMillis || 0),
            durationMillis: Number(status.durationMillis || 0)
          });
          return;
        }

        if (status.isLoaded) {
          await savedAudioSoundRef.current.playAsync();
          setPlayingSavedAudioId(entry.id);
          setSavedAudioPlaybackState({
            entryId: entry.id,
            isPlaying: true,
            positionMillis: Number(status.positionMillis || 0),
            durationMillis: Number(status.durationMillis || 0)
          });
          return;
        }
      }

      await stopSavedAudioPlayback();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: entry.uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) {
            if (status.error) {
              setLoadedSavedAudioId(null);
              setPlayingSavedAudioId(null);
              savedAudioSoundRef.current = null;
              setSavedAudioPlaybackState({
                entryId: null,
                isPlaying: false,
                positionMillis: 0,
                durationMillis: 0
              });
            }

            return;
          }

          setSavedAudioPlaybackState({
            entryId: entry.id,
            isPlaying: Boolean(status.isPlaying),
            positionMillis: Number(status.positionMillis || 0),
            durationMillis: Number(status.durationMillis || 0)
          });

          if (status.didJustFinish) {
            setLoadedSavedAudioId(null);
            setPlayingSavedAudioId(null);
            setSavedAudioPlaybackState({
              entryId: null,
              isPlaying: false,
              positionMillis: 0,
              durationMillis: Number(status.durationMillis || 0)
            });

            sound.unloadAsync().catch(() => {
              // Ignore cleanup failures after playback completes.
            });
            savedAudioSoundRef.current = null;
          }
        }
      );

      savedAudioSoundRef.current = sound;
      setLoadedSavedAudioId(entry.id);
      setPlayingSavedAudioId(entry.id);
      setSavedAudioPlaybackState({
        entryId: entry.id,
        isPlaying: true,
        positionMillis: 0,
        durationMillis: 0
      });
    } catch (error) {
      setLoadedSavedAudioId(null);
      setPlayingSavedAudioId(null);
      setSavedAudioPlaybackState({
        entryId: null,
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 0
      });
      Alert.alert('Playback failed', error.message || 'Unable to play this saved audio file.');
    }
  }, [loadedSavedAudioId, stopReading, stopSavedAudioPlayback]);

  const handleSeekSavedAudio = useCallback(async (entry, locationX) => {
    if (!entry?.id || loadedSavedAudioId !== entry.id || !savedAudioSoundRef.current) {
      return;
    }

    const trackWidth = Number(savedAudioSeekTrackWidthsRef.current[entry.id] || 0);
    const durationMillis = Number(savedAudioPlaybackState.durationMillis || 0);

    if (!trackWidth || !durationMillis) {
      return;
    }

    const clampedRatio = Math.max(0, Math.min(1, Number(locationX || 0) / trackWidth));
    const nextPositionMillis = Math.round(durationMillis * clampedRatio);

    try {
      await savedAudioSoundRef.current.setPositionAsync(nextPositionMillis);
      setSavedAudioPlaybackState((currentState) => ({
        ...currentState,
        positionMillis: nextPositionMillis
      }));
    } catch {
      // Ignore best-effort seek failures.
    }
  }, [loadedSavedAudioId, savedAudioPlaybackState.durationMillis]);

  const handleJumpSavedAudio = useCallback(async (entry, deltaMillis) => {
    if (!entry?.id || loadedSavedAudioId !== entry.id || !savedAudioSoundRef.current) {
      return;
    }

    const durationMillis = Number(savedAudioPlaybackState.durationMillis || 0);
    const currentPositionMillis = Number(savedAudioPlaybackState.positionMillis || 0);
    const nextPositionMillis = Math.max(0, Math.min(durationMillis || currentPositionMillis + deltaMillis, currentPositionMillis + deltaMillis));

    try {
      await savedAudioSoundRef.current.setPositionAsync(nextPositionMillis);
      setSavedAudioPlaybackState((currentState) => ({
        ...currentState,
        positionMillis: nextPositionMillis
      }));
    } catch {
      // Ignore best-effort seek failures.
    }
  }, [loadedSavedAudioId, savedAudioPlaybackState.durationMillis, savedAudioPlaybackState.positionMillis]);

  const handleShareSavedAudio = useCallback(async (entry) => {
    if (!entry?.uri) {
      return;
    }

    try {
      const sharingAvailable = await Sharing.isAvailableAsync();

      if (!sharingAvailable) {
        Alert.alert('Sharing unavailable', 'This device cannot share audio files right now.');
        return;
      }

      await Sharing.shareAsync(entry.uri, {
        mimeType: 'audio/mpeg',
        dialogTitle: 'Download reader audio'
      });
    } catch (error) {
      Alert.alert('Download failed', error.message || 'Unable to download this audio file right now.');
    }
  }, []);

  const handleStartEditingSavedAudio = useCallback((entry) => {
    setActiveSavedAudioId(entry?.id || null);
    setEditingSavedAudioId(entry?.id || null);
    setEditingSavedAudioTitle(String(entry?.title || 'Reader audio'));
  }, []);

  const handleCancelEditingSavedAudio = useCallback(() => {
    setEditingSavedAudioId(null);
    setEditingSavedAudioTitle('');
  }, []);

  const handleUpdateSavedAudioTitle = useCallback(async (entry) => {
    if (!entry?.id) {
      return;
    }

    const nextTitle = String(editingSavedAudioTitle || '').trim();

    if (!nextTitle) {
      Alert.alert('Title required', 'Add a title before saving this audio name.');
      return;
    }

    try {
      setIsUpdatingSavedAudioId(entry.id);

      let nextFileName = buildSavedAudioFileName(nextTitle, entry.fileName);

      if (entry.savedAudioId) {
        const response = await updateSavedReaderAudio(entry.savedAudioId, nextTitle);

        if (!response.success) {
          throw new Error(response.error || 'Unable to rename this saved audio file right now.');
        }

        nextFileName = response.fileName || nextFileName;
      }

      if (playingSavedAudioId === entry.id) {
        await stopSavedAudioPlayback();
      }

      const renamedFile = await renameSavedAudioFileIfNeeded(entry, nextTitle, nextFileName);
      const nextSavedAudioEntries = normalizeSavedReaderAudioEntries(savedAudioEntries.map((savedEntry) => {
        if (savedEntry.id !== entry.id) {
          return savedEntry;
        }

        return {
          ...savedEntry,
          title: nextTitle,
          fileName: renamedFile.fileName,
          uri: renamedFile.uri
        };
      }));

      await persistSavedReaderAudio(nextSavedAudioEntries);
      setSavedAudioEntries(nextSavedAudioEntries);
      setEditingSavedAudioId(null);
      setEditingSavedAudioTitle('');
    } catch (error) {
      Alert.alert('Rename failed', error.message || 'Unable to rename this saved audio file right now.');
    } finally {
      setIsUpdatingSavedAudioId(null);
    }
  }, [editingSavedAudioTitle, playingSavedAudioId, savedAudioEntries, stopSavedAudioPlayback]);

  const handleDeleteSavedAudio = useCallback(async (entry) => {
    if (!entry?.id) {
      return;
    }

    try {
      if (entry.savedAudioId) {
        const response = await deleteSavedReaderAudio(entry.savedAudioId);

        if (!response.success) {
          throw new Error(response.error || 'Unable to delete this saved audio file right now.');
        }
      }

      if (playingSavedAudioId === entry.id) {
        await stopSavedAudioPlayback();
      }

      if (entry.uri) {
        await FileSystem.deleteAsync(entry.uri, { idempotent: true });
      }

      const nextSavedAudioEntries = savedAudioEntries.filter((savedEntry) => savedEntry.id !== entry.id);
      await persistSavedReaderAudio(nextSavedAudioEntries);
      setSavedAudioEntries(nextSavedAudioEntries);
      setActiveSavedAudioId((currentId) => (currentId === entry.id ? null : currentId));
    } catch (error) {
      Alert.alert('Delete failed', error.message || 'Unable to delete this saved audio file right now.');
    }
  }, [playingSavedAudioId, savedAudioEntries, stopSavedAudioPlayback]);

  const handleClear = () => {
    stopReading().catch(() => {
      // Best-effort clear.
    });
    setDocumentTitle('');
    setReaderText('');
    setImportMetadata(null);
  };

  const wordCount = String(readerText || '').trim() ? String(readerText || '').trim().split(/\s+/).filter(Boolean).length : 0;
  const bottomContentInset = Math.max(insets.bottom, BOTTOM_SAFE_ZONE);
  const primaryButtonBackground = isDarkMode ? colors.surfaceAlt : colors.text;
  const primaryButtonTextColor = isDarkMode ? colors.text : '#ffffff';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomContentInset + 120 }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Reader</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Read on the go</Text>
          <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>Paste text or import a plain-text file or PDF, then have your device read it aloud, save audio below, or download it for later.</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryButtonBackground, borderColor: colors.border }]}
              onPress={handleImportDocument}
              disabled={isImporting}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryButtonText, { color: primaryButtonTextColor }]}>{isImporting ? 'Importing...' : 'Import TXT or PDF'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={handleClear}
              activeOpacity={0.85}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          {isImporting ? (
            <View style={[styles.importCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.importingText, { color: colors.mutedText }]}>Extracting readable text from your document...</Text>
            </View>
          ) : null}

          {importMetadata ? (
            <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metaTitle, { color: colors.text }]}>{documentTitle || 'Imported document'}</Text>
              <Text style={[styles.metaText, { color: colors.mutedText }]}>Words: {importMetadata.wordCount || wordCount} · Characters: {importMetadata.characterCount || String(readerText || '').length}</Text>
              {importMetadata.pageCount ? (
                <Text style={[styles.metaText, { color: colors.mutedText }]}>Pages: {importMetadata.pageCount}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.editorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={documentTitle}
              onChangeText={setDocumentTitle}
              placeholder="Document title"
              placeholderTextColor={colors.mutedText}
              style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
            />
            <TextInput
              value={readerText}
              onChangeText={setReaderText}
              placeholder="Paste an article, study guide, memo, or document text here..."
              placeholderTextColor={colors.mutedText}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              onContentSizeChange={(event) => {
                const nextHeight = Math.max(MIN_BODY_INPUT_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height) + 24);
                setBodyInputHeight(nextHeight);
              }}
              style={[styles.bodyInput, { color: colors.text, minHeight: bodyInputHeight, height: bodyInputHeight }]}
            />
          </View>

          <View style={[styles.metaFooter, { borderColor: colors.border }]}> 
            <Text style={[styles.metaFooterText, { color: colors.mutedText }]}>{wordCount} words ready to read</Text>
            <Text style={[styles.metaFooterText, { color: colors.mutedText }]}>Voice: {READER_AUDIO_VOICE_OPTIONS.find((option) => option.id === selectedReaderVoiceId)?.label || 'Lucy'}</Text>
          </View>

          <View style={styles.voiceOptionRow}>
            {READER_AUDIO_VOICE_OPTIONS.map((option) => {
              const isSelected = option.id === selectedReaderVoiceId;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.voiceOptionButton,
                    {
                      borderColor: isSelected ? colors.text : colors.border,
                      backgroundColor: isSelected ? colors.surfaceAlt : colors.surface
                    }
                  ]}
                  onPress={() => setSelectedReaderVoiceId(option.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.voiceOptionText, { color: colors.text }]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryButtonBackground, borderColor: colors.border, opacity: isSpeaking ? 0.82 : 1 }]}
              onPress={handleReadAloud}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryButtonText, { color: primaryButtonTextColor }]}>
                {isPreparingReadAloudFallback ? 'Preparing audio...' : isSpeaking ? 'Reading...' : 'Read aloud'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: isSpeaking ? 1 : 0.55 }]}
              onPress={() => {
                stopReading().catch(() => {
                  // Best-effort stop.
                });
              }}
              disabled={!isSpeaking}
              activeOpacity={0.85}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Stop</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, styles.fullWidthButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: isGeneratingAudio ? 0.72 : 1 }]}
            onPress={handleGenerateAudio}
            disabled={isGeneratingAudio}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{isGeneratingAudio ? 'Saving audio...' : 'Save audio below'}</Text>
          </TouchableOpacity>

          {savedAudioEntries.length > 0 ? (
            <View style={styles.savedAudioSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Saved audio</Text>
              <View style={styles.savedAudioList}>
                {savedAudioEntries.map((entry) => {
                  const isCurrentDraft = entry.textSignature === currentTextSignature;
                  const isLoadedEntry = loadedSavedAudioId === entry.id;
                  const isPlayingEntry = playingSavedAudioId === entry.id;
                  const isMenuOpen = activeSavedAudioId === entry.id;
                  const isEditingEntry = editingSavedAudioId === entry.id;
                  const isUpdatingEntry = isUpdatingSavedAudioId === entry.id;
                  const progressRatio = isLoadedEntry && savedAudioPlaybackState.durationMillis
                    ? Math.max(0, Math.min(1, savedAudioPlaybackState.positionMillis / savedAudioPlaybackState.durationMillis))
                    : 0;

                  return (
                    <View key={entry.id} style={[styles.savedAudioRowCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <View style={styles.savedAudioRowTop}>
                        <TouchableOpacity
                          style={[
                            styles.savedAudioPlayButton,
                            {
                              backgroundColor: primaryButtonBackground,
                              borderColor: colors.border,
                              opacity: isGeneratingAudio ? 0.7 : 1
                            }
                          ]}
                          onPress={() => handleToggleSavedAudioPlayback(entry)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.primaryButtonText, { color: primaryButtonTextColor }]}>{isPlayingEntry ? 'Stop' : 'Play'}</Text>
                        </TouchableOpacity>

                        <View style={styles.savedAudioInfo}>
                          {isEditingEntry ? (
                            <TextInput
                              value={editingSavedAudioTitle}
                              onChangeText={setEditingSavedAudioTitle}
                              placeholder="Audio title"
                              placeholderTextColor={colors.mutedText}
                              style={[styles.savedAudioTitleInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                            />
                          ) : (
                            <View>
                              <Text style={[styles.savedAudioTitle, { color: colors.text }]} numberOfLines={1}>{entry.title || 'Reader audio'}</Text>
                              {entry.voiceProfile ? (
                                <Text style={[styles.savedAudioVoiceMeta, { color: colors.mutedText }]}>
                                  Voice: {READER_AUDIO_VOICE_OPTIONS.find((option) => option.id === entry.voiceProfile)?.label || entry.voiceProfile}
                                </Text>
                              ) : null}
                            </View>
                          )}
                          <Text style={[styles.savedAudioMeta, { color: colors.mutedText }]} numberOfLines={2}>
                            {isCurrentDraft ? 'Matches current text' : 'Saved from earlier text'}
                            {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleString()}` : ''}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[styles.savedAudioMenuButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                          onPress={() => {
                            setActiveSavedAudioId((currentId) => (currentId === entry.id ? null : entry.id));
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.savedAudioMenuButtonText, { color: colors.text }]}>⋮</Text>
                        </TouchableOpacity>
                      </View>

                      {isLoadedEntry ? (
                        <View style={styles.savedAudioPlaybackSection}>
                          <TouchableOpacity
                            style={[styles.savedAudioProgressTrack, { backgroundColor: colors.surface }]}
                            activeOpacity={0.9}
                            onLayout={(event) => {
                              savedAudioSeekTrackWidthsRef.current[entry.id] = event.nativeEvent.layout.width;
                            }}
                            onPress={(event) => handleSeekSavedAudio(entry, event.nativeEvent.locationX)}
                          >
                            <View
                              style={[
                                styles.savedAudioProgressFill,
                                {
                                  backgroundColor: primaryButtonBackground,
                                  width: `${progressRatio * 100}%`
                                }
                              ]}
                            />
                          </TouchableOpacity>

                          <View style={styles.savedAudioPlaybackMetaRow}>
                            <Text style={[styles.savedAudioPlaybackMetaText, { color: colors.mutedText }]}>
                              {formatAudioTime(savedAudioPlaybackState.positionMillis)}
                            </Text>
                            <Text style={[styles.savedAudioPlaybackMetaText, { color: colors.mutedText }]}>
                              {formatAudioTime(savedAudioPlaybackState.durationMillis)}
                            </Text>
                          </View>

                          <View style={styles.savedAudioPlaybackControlsRow}>
                            <TouchableOpacity
                              style={[styles.savedAudioPlaybackControlButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                              onPress={() => handleJumpSavedAudio(entry, -15000)}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.savedAudioPlaybackControlText, { color: colors.text }]}>-15s</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.savedAudioPlaybackControlButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                              onPress={() => handleJumpSavedAudio(entry, -Number(savedAudioPlaybackState.positionMillis || 0))}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.savedAudioPlaybackControlText, { color: colors.text }]}>Restart</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.savedAudioPlaybackControlButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                              onPress={() => handleJumpSavedAudio(entry, 15000)}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.savedAudioPlaybackControlText, { color: colors.text }]}>+15s</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}

                      {isMenuOpen ? (
                        <View style={styles.savedAudioActionsRow}>
                          {isEditingEntry ? (
                            <>
                              <TouchableOpacity
                                style={[styles.savedAudioActionButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: isUpdatingEntry ? 0.7 : 1 }]}
                                onPress={() => handleUpdateSavedAudioTitle(entry)}
                                disabled={isUpdatingEntry}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{isUpdatingEntry ? 'Saving...' : 'Save name'}</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.savedAudioActionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                                onPress={handleCancelEditingSavedAudio}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity
                              style={[styles.savedAudioActionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                              onPress={() => handleStartEditingSavedAudio(entry)}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Rename</Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={[styles.savedAudioActionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                            onPress={() => handleShareSavedAudio(entry)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Download</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.savedAudioDeleteButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                            onPress={() => handleDeleteSavedAudio(entry)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.savedAudioDeleteButtonText, { color: colors.text }]}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Text style={[styles.helpText, { color: colors.mutedText }]}>
            {isPreparingReadAloudFallback
              ? 'Preparing the selected voice audio. Keep the app open for a few seconds.'
              : 'Read aloud now uses the selected voice. Save audio below to keep an MP3 on this screen, then download it whenever you want.'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  contentContainer: {
    paddingBottom: 24
  },
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '700'
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 14
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  fullWidthButton: {
    width: '100%'
  },
  importCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10
  },
  importingText: {
    fontSize: 14,
    textAlign: 'center'
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 4
  },
  metaTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  voiceOptionRow: {
    flexDirection: 'row',
    gap: 10
  },
  voiceOptionButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  voiceOptionText: {
    fontSize: 14,
    fontWeight: '600'
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18
  },
  savedAudioVoiceMeta: {
    fontSize: 12,
    marginTop: 2
  },
  savedAudioSection: {
    gap: 10
  },
  savedAudioList: {
    gap: 10
  },
  savedAudioRowCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 10
  },
  savedAudioRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  savedAudioPlayButton: {
    minHeight: 44,
    minWidth: 92,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  savedAudioInfo: {
    flex: 1,
    gap: 2
  },
  savedAudioTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  savedAudioTitleInput: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600'
  },
  savedAudioMeta: {
    fontSize: 12,
    lineHeight: 17
  },
  savedAudioMenuButton: {
    minHeight: 44,
    width: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  savedAudioMenuButtonText: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700'
  },
  savedAudioActionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  savedAudioPlaybackSection: {
    gap: 8
  },
  savedAudioProgressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden'
  },
  savedAudioProgressFill: {
    height: '100%',
    borderRadius: 999
  },
  savedAudioPlaybackMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  savedAudioPlaybackMetaText: {
    fontSize: 12,
    lineHeight: 16
  },
  savedAudioPlaybackControlsRow: {
    flexDirection: 'row',
    gap: 8
  },
  savedAudioPlaybackControlButton: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flex: 1
  },
  savedAudioPlaybackControlText: {
    fontSize: 13,
    fontWeight: '600'
  },
  savedAudioActionButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flex: 1
  },
  savedAudioDeleteButton: {
    minHeight: 42,
    width: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  savedAudioDeleteButtonText: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700'
  },
  editorCard: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden'
  },
  titleInput: {
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    borderBottomWidth: 1
  },
  bodyInput: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    lineHeight: 24
  },
  metaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 12
  },
  metaFooterText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18
  },
  helpText: {
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: 8
  }
});

export default ReaderScreen;