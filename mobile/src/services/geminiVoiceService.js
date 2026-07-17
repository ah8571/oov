import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import InCallManager from 'react-native-incall-manager';
import { startPcmCapture } from './pcmCapture.js';
import { createGeminiVoiceSession } from './api.js';

const GEMINI_PROVIDER = 'gemini-voice';
const GEMINI_AUDIO_FILE = `${FileSystem.cacheDirectory}gemini-response.pcm`;
const GEMINI_INPUT_SAMPLE_RATE = 16000;
const GEMINI_OUTPUT_SAMPLE_RATE = 24000;
const MIC_CHUNK_MS = 500;
const STREAMING_PLAYBACK_SEGMENT_BYTES = 24000;

let activeSocket = null;
let activeCall = false;
let isMuted = false;
let onStatusChange = null;
let onTrace = null;
let callStartedAtMs = null;
let audioBuffers = [];
let playbackSound = null;
let responseInProgress = false;
let micActive = false;
let activePcmSession = null;
let playbackQueue = [];
let playbackActive = false;
let playbackSegmentIndex = 0;
let playbackSegmentFlushInProgress = false;

const muteListeners = new Set();
const transcriptListeners = new Set();

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-live-preview';
const DEFAULT_GEMINI_LANGUAGE_HINT = 'en';

const emitMuteState = () => {
  muteListeners.forEach((l) => l(isMuted));
};

const emitTranscript = (text) => {
  transcriptListeners.forEach((l) => l(text));
};

const normalizeGeminiLanguageHint = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('ar')) return 'ar';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('it')) return 'it';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('hi')) return 'hi';

  return DEFAULT_GEMINI_LANGUAGE_HINT;
};

const toArrayBuffer = (buffer) => {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

const getBufferedAudioBytes = () => {
  return audioBuffers.reduce((total, chunk) => total + chunk.length, 0);
};

const createWavBuffer = (pcmBuffer, sampleRate) => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(totalSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  pcmBuffer.copy(buffer, offset);

  return buffer;
};

const interruptAssistantPlayback = async ({ reason = 'interrupt' } = {}) => {
  const hadPlayback = playbackActive || playbackQueue.length > 0 || audioBuffers.length > 0 || responseInProgress;

  if (!hadPlayback) return;

  console.log('[GeminiVoice] Interrupting assistant playback:', {
    reason,
    queuedSegments: playbackQueue.length,
    bufferedChunks: audioBuffers.length
  });

  if (playbackSound) {
    try {
      playbackSound.setOnPlaybackStatusUpdate(null);
      await playbackSound.unloadAsync();
    } catch {}
    playbackSound = null;
  }

  audioBuffers = [];
  playbackQueue = [];
  playbackActive = false;
  playbackSegmentFlushInProgress = false;
  responseInProgress = false;
};

const queueBufferedAudioSegment = async ({ force = false } = {}) => {
  if (playbackSegmentFlushInProgress) return;

  const pcmBytes = getBufferedAudioBytes();

  if (pcmBytes < 100) return;
  if (!force && (pcmBytes < STREAMING_PLAYBACK_SEGMENT_BYTES || playbackQueue.length > 0)) return;

  playbackSegmentFlushInProgress = true;

  const pcmBuffer = Buffer.concat(audioBuffers);
  audioBuffers = [];

  try {
    const wavPath = GEMINI_AUDIO_FILE.replace('.pcm', `-${playbackSegmentIndex++}.wav`);
    const wavBuffer = createWavBuffer(pcmBuffer, GEMINI_OUTPUT_SAMPLE_RATE);
    await FileSystem.writeAsStringAsync(wavPath, wavBuffer.toString('base64'), {
      encoding: FileSystem.EncodingType.Base64
    });

    playbackQueue.push({ uri: wavPath, pcmBytes: pcmBuffer.length });
    await playNextBufferedSegment();
  } finally {
    playbackSegmentFlushInProgress = false;
  }
};

const playNextBufferedSegment = async () => {
  if (playbackActive || playbackQueue.length === 0) return;
  playbackActive = true;

  const nextSegment = playbackQueue.shift();

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: nextSegment.uri },
      { shouldPlay: false }
    );

    if (playbackSound) {
      await playbackSound.unloadAsync().catch(() => {});
    }
    playbackSound = sound;
    await playbackSound.playAsync();

    console.log('[GeminiVoice] Playing audio segment:', { pcmBytes: nextSegment.pcmBytes, queuedSegments: playbackQueue.length });

    playbackSound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        playbackSound.setOnPlaybackStatusUpdate(null);
        playbackActive = false;
        playNextBufferedSegment().catch((err) => {
          console.error('[GeminiVoice] Playback queue error:', err.message);
        });
      }
    });
  } catch (error) {
    playbackActive = false;
    console.error('[GeminiVoice] Playback error:', error.message);
    await playNextBufferedSegment();
  }
};

export const startGeminiVoiceCall = async ({
  model = DEFAULT_GEMINI_MODEL,
  language = DEFAULT_GEMINI_LANGUAGE_HINT,
  voiceConfig = {},
  onStatusChange: statusCb,
  onTrace: traceCb
} = {}) => {
  if (activeCall) {
    return { success: false, error: 'A Gemini voice call is already active.' };
  }

  try {
    onStatusChange = statusCb;
    onTrace = traceCb;
    audioBuffers = [];
    playbackQueue = [];
    playbackActive = false;
    playbackSegmentIndex = 0;
    playbackSegmentFlushInProgress = false;
    responseInProgress = false;
    const languageHint = normalizeGeminiLanguageHint(language);

    onTrace?.('gemini_session_request_started');

    const sessionResponse = await createGeminiVoiceSession({ model });

    if (!sessionResponse.success) {
      throw new Error(sessionResponse.error || 'Unable to start Gemini voice session.');
    }

    onTrace?.('gemini_session_request_finished');

    const { wsUrl } = sessionResponse;

    onTrace?.('gemini_websocket_connecting');

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      activeSocket = ws;
      ws.binaryType = 'arraybuffer';

      const connectionTimeout = setTimeout(() => {
        reject(new Error('Gemini WebSocket connection timed out'));
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        onTrace?.('gemini_websocket_connected');

        // Send Gemini Live setup message
        ws.send(JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: String(voiceConfig?.voiceName || voiceConfig?.voice || 'Puck').trim() || 'Puck'
                  }
                }
              }
            }
          }
        }));
        console.log('[GeminiVoice] Setup sent, model:', model);

        resolve();
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        reject(new Error('Gemini WebSocket connection failed. Check API key and network.'));
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            handleGeminiMessage(msg);
          } catch {
            console.warn('[GeminiVoice] Unparseable message:', String(event.data).slice(0, 200));
          }
        } else {
          // Binary data — might be inline PCM from Gemini
          audioBuffers.push(Buffer.from(event.data));
          responseInProgress = true;
          queueBufferedAudioSegment().catch((error) => {
            console.error('[GeminiVoice] Segment queue error:', error.message);
          });
        }
      };

      ws.onclose = (event) => {
        console.log('[GeminiVoice] WebSocket closed:', event.code, event.reason);
        if (activeCall) {
          onStatusChange?.('ended');
          cleanupGeminiCall();
        }
      };
    });

    // Set up audio for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false
    });

    if (Platform.OS === 'ios') {
      try {
        InCallManager.start({ media: 'audio' });
        setTimeout(() => InCallManager.setSpeakerphoneOn(true), 500);
      } catch {}
    } else {
      try {
        InCallManager.start({ media: 'audio' });
        InCallManager.setSpeakerphoneOn(true);
      } catch {}
    }

    await startGeminiMicCapture();

    activeCall = true;
    callStartedAtMs = Date.now();
    onStatusChange?.('live');

    return { success: true, provider: GEMINI_PROVIDER };
  } catch (error) {
    await cleanupGeminiCall();
    onStatusChange?.('failed');
    return { success: false, error: error?.message || 'Unable to start Gemini voice mode.' };
  }
};

const handleGeminiMessage = (msg) => {
  // Gemini Live uses BidiGenerateContentServerMessage
  // serverContent contains the model's response

  const serverContent = msg?.serverContent;
  if (!serverContent) {
    // Could be setupComplete or other lifecycle messages
    if (msg?.setupComplete) {
      console.log('[GeminiVoice] ← setupComplete');
      onTrace?.('gemini_setup_complete');
    }
    return;
  }

  // Check for model turn (audio/text response)
  const modelTurn = serverContent.modelTurn;
  if (!modelTurn) return;

  const parts = modelTurn.parts || [];

  for (const part of parts) {
    // Audio output
    if (part?.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || '';
      if (mimeType.includes('audio') || mimeType.includes('pcm')) {
        onTrace?.('gemini_audio_chunk');
        audioBuffers.push(Buffer.from(part.inlineData.data, 'base64'));
        responseInProgress = true;
        queueBufferedAudioSegment().catch((error) => {
          console.error('[GeminiVoice] Segment queue error:', error.message);
        });
      }
    }

    // Text/transcript output
    if (part?.text) {
      const text = String(part.text).trim();
      if (text) {
        console.log('[GeminiVoice] Model says:', text);
        emitTranscript(text);
      }
    }
  }

  // Check for turn completion
  if (serverContent.turnComplete === true) {
    console.log('[GeminiVoice] ← turnComplete');
    if (audioBuffers.length > 0) {
      queueBufferedAudioSegment({ force: true }).catch((error) => {
        console.error('[GeminiVoice] Final segment queue error:', error.message);
      });
    }
    responseInProgress = false;
  }
};

const startGeminiMicCapture = async () => {
  micActive = true;
  startGeminiMicCapture._chunkCount = 0;

  if (Platform.OS === 'android') {
    // Gemini uses 16kHz input, not 24kHz like Grok
    activePcmSession = startPcmCapture({
      sampleRate: GEMINI_INPUT_SAMPLE_RATE,
      onData: (base64Data) => {
        if (!micActive || !activeSocket || activeSocket.readyState !== WebSocket.OPEN || isMuted) return;

        const pcmBuffer = Buffer.from(base64Data, 'base64');

        // Send as realtimeInput with audio media chunk
        activeSocket.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: `audio/pcm;rate=${GEMINI_INPUT_SAMPLE_RATE}`,
              data: pcmBuffer.toString('base64')
            }]
          }
        }));

        startGeminiMicCapture._chunkCount++;
        if (startGeminiMicCapture._chunkCount <= 3 || startGeminiMicCapture._chunkCount % 50 === 0) {
          console.log('[GeminiVoice] PCM chunk sent:', startGeminiMicCapture._chunkCount, {
            pcmBytes: pcmBuffer.length,
            sampleRate: GEMINI_INPUT_SAMPLE_RATE
          });
        }
      }
    });
    console.log('[GeminiVoice] Native PCM capture started (AudioRecord @ 16kHz)');
    return;
  }

  // iOS capture path
  const RECORDING_CONFIG = {
    ios: {
      extension: '.wav',
      outputFormat: 'lpcm',
      audioQuality: 127,
      sampleRate: GEMINI_INPUT_SAMPLE_RATE,
      numberOfChannels: 1,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false
    }
  };

  const sendChunk = async () => {
    if (!micActive || !activeSocket || activeSocket.readyState !== WebSocket.OPEN) return;

    const recording = new Audio.Recording();
    try {
      await recording.prepareToRecordAsync(RECORDING_CONFIG);
      await recording.startAsync();
      await new Promise((r) => setTimeout(r, MIC_CHUNK_MS));
      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();
      if (uri && micActive && !isMuted && activeSocket?.readyState === WebSocket.OPEN) {
        const wavBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const wavBuffer = Buffer.from(wavBase64, 'base64');
        if (wavBuffer.length > 44) {
          const pcmData = wavBuffer.slice(44);
          activeSocket.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: `audio/pcm;rate=${GEMINI_INPUT_SAMPLE_RATE}`,
                data: pcmData.toString('base64')
              }]
            }
          }));
        }
      }
    } catch (err) {
      // chunk-level errors are expected occasionally
    }
    if (micActive) setTimeout(sendChunk, 1);
  };

  sendChunk();
};

const stopGeminiMicCapture = () => {
  micActive = false;
  startGeminiMicCapture._chunkCount = 0;

  if (activePcmSession) {
    try {
      activePcmSession.stop();
    } catch {}
    activePcmSession = null;
  }
};

const cleanupGeminiCall = async () => {
  stopGeminiMicCapture();

  if (playbackSound) {
    try { await playbackSound.unloadAsync(); } catch {}
    playbackSound = null;
  }

  if (activeSocket) {
    try { activeSocket.close(); } catch {}
    activeSocket = null;
  }

  try { InCallManager.stop(); } catch {}

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false
  }).catch(() => {});

  audioBuffers = [];
  playbackQueue = [];
  playbackActive = false;
  playbackSegmentIndex = 0;
  playbackSegmentFlushInProgress = false;
  responseInProgress = false;
  activeCall = false;
  isMuted = false;
  callStartedAtMs = null;
  onStatusChange = null;
  onTrace = null;
};

export const sendGeminiText = (text) => {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return;

  activeSocket.send(JSON.stringify({
    clientContent: {
      turns: [{
        role: 'user',
        parts: [{ text }]
      }],
      turnComplete: true
    }
  }));
};

export const endGeminiVoiceCall = async () => {
  await cleanupGeminiCall();
  return { success: true };
};

export const getGeminiCallActive = () => activeCall;
export const getGeminiMuteState = () => isMuted;

export const setGeminiMuted = (muted) => {
  isMuted = muted;
  emitMuteState();
};

export const subscribeToGeminiMute = (listener) => {
  muteListeners.add(listener);
  listener(isMuted);
  return () => { muteListeners.delete(listener); };
};

export const subscribeToGeminiTranscript = (listener) => {
  transcriptListeners.add(listener);
  return () => { transcriptListeners.delete(listener); };
};

export const ensureGeminiMicrophonePermission = async () => {
  try {
    const permission = await Audio.requestPermissionsAsync();
    return { success: permission.granted, error: permission.granted ? null : 'Microphone permission denied' };
  } catch (error) {
    return { success: false, error: error?.message || 'Unable to request microphone permission' };
  }
};

export default {
  startGeminiVoiceCall,
  endGeminiVoiceCall,
  sendGeminiText,
  getGeminiCallActive,
  getGeminiMuteState,
  setGeminiMuted,
  subscribeToGeminiMute,
  subscribeToGeminiTranscript,
  ensureGeminiMicrophonePermission
};
