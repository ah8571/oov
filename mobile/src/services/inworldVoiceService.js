import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import InCallManager from 'react-native-incall-manager';
import { startPcmCapture } from './pcmCapture.js';
import { createInworldVoiceSession } from './api.js';

const INWORLD_PROVIDER = 'inworld-voice';
const INWORLD_AUDIO_FILE = `${FileSystem.cacheDirectory}inworld-response.pcm`;
const INWORLD_SAMPLE_RATE = 24000;
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
let responseActiveOnServer = false;
let ignoreNextTimeoutResponse = false;

const muteListeners = new Set();
const transcriptListeners = new Set();

const DEFAULT_INWORLD_VOICE = 'Clive';
const DEFAULT_INWORLD_LANGUAGE = 'en-US';

const emitMuteState = () => {
  muteListeners.forEach((l) => l(isMuted));
};

const emitTranscript = (text) => {
  transcriptListeners.forEach((l) => l(text));
};

const normalizeInworldLanguage = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.startsWith('es')) return 'es-MX';
  if (normalized.startsWith('pt')) return 'pt-BR';
  if (normalized.startsWith('ar')) return 'ar-EG';
  if (normalized.startsWith('zh')) return 'zh-CN';
  if (normalized.startsWith('fr')) return 'fr-FR';
  if (normalized.startsWith('de')) return 'de-DE';
  if (normalized.startsWith('it')) return 'it-IT';
  if (normalized.startsWith('ja')) return 'ja-JP';
  if (normalized.startsWith('hi')) return 'hi-IN';

  return DEFAULT_INWORLD_LANGUAGE;
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

const interruptAssistantPlayback = async ({ cancelResponse = false, reason = 'interrupt' } = {}) => {
  const hadPlayback = playbackActive || playbackQueue.length > 0 || audioBuffers.length > 0 || responseInProgress;

  if (!hadPlayback) return;

  console.log('[InworldVoice] Interrupting assistant playback:', {
    reason,
    cancelResponse,
    queuedSegments: playbackQueue.length,
    bufferedChunks: audioBuffers.length
  });

  if (cancelResponse && responseActiveOnServer && activeSocket?.readyState === WebSocket.OPEN) {
    try {
      activeSocket.send(JSON.stringify({ type: 'response.cancel' }));
      responseActiveOnServer = false;
    } catch {}
  }

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
    const wavPath = INWORLD_AUDIO_FILE.replace('.pcm', `-${playbackSegmentIndex++}.wav`);
    const wavBuffer = createWavBuffer(pcmBuffer, INWORLD_SAMPLE_RATE);
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

    console.log('[InworldVoice] Playing audio segment:', { pcmBytes: nextSegment.pcmBytes, queuedSegments: playbackQueue.length });

    playbackSound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        playbackSound.setOnPlaybackStatusUpdate(null);
        playbackActive = false;
        playNextBufferedSegment().catch((err) => {
          console.error('[InworldVoice] Playback queue error:', err.message);
        });
      }
    });
  } catch (error) {
    playbackActive = false;
    console.error('[InworldVoice] Playback error:', error.message);
    await playNextBufferedSegment();
  }
};

export const startInworldVoiceCall = async ({
  voice = DEFAULT_INWORLD_VOICE,
  language = DEFAULT_INWORLD_LANGUAGE,
  modelId,
  onStatusChange: statusCb,
  onTrace: traceCb
} = {}) => {
  if (activeCall) {
    return { success: false, error: 'An Inworld voice call is already active.' };
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
    responseActiveOnServer = false;
    ignoreNextTimeoutResponse = false;
    const languageHint = normalizeInworldLanguage(language);

    onTrace?.('inworld_session_request_started');

    const sessionResponse = await createInworldVoiceSession({
      model: modelId || null,
      voice,
      language: languageHint
    });

    if (!sessionResponse.success) {
      throw new Error(sessionResponse.error || 'Unable to start Inworld voice session.');
    }

    onTrace?.('inworld_session_request_finished');

    const { wsUrl, jwt } = sessionResponse;

    // React Native's WebSocket doesn't support custom headers.
    // Pass JWT as a query parameter instead.
    const authWsUrl = `${wsUrl}&token=${encodeURIComponent(jwt)}`;

    onTrace?.('inworld_websocket_connecting');

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(authWsUrl);
      activeSocket = ws;
      ws.binaryType = 'arraybuffer';

      const connectionTimeout = setTimeout(() => {
        reject(new Error('Inworld WebSocket connection timed out'));
      }, 15000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        onTrace?.('inworld_websocket_connected');
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        reject(new Error('Inworld WebSocket connection failed. Check API key and network.'));
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          audioBuffers.push(Buffer.from(event.data));
          return;
        }

        try {
          const msg = JSON.parse(event.data);
          handleInworldMessage(msg);
        } catch {
          audioBuffers.push(Buffer.from(event.data, 'base64'));
        }
      };

      ws.onclose = (event) => {
        console.log('[InworldVoice] WebSocket closed:', event.code, event.reason);
        if (activeCall) {
          onStatusChange?.('ended');
          cleanupInworldCall();
        }
      };
    });

    // Configure session — Inworld uses OpenAI-compatible protocol
    const llmModel = modelId || 'openai/gpt-4o-mini';
    activeSocket.send(JSON.stringify({
      type: 'session.update',
      session: {
        type: 'realtime',
        model: llmModel,
        instructions: '',
        output_modalities: ['audio', 'text'],
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: INWORLD_SAMPLE_RATE },
            turn_detection: {
              type: 'semantic_vad',
              eagerness: 'medium',
              create_response: true,
              interrupt_response: true
            }
          },
          output: {
            voice,
            model: 'inworld-tts-2',
            format: { type: 'audio/pcm', rate: INWORLD_SAMPLE_RATE }
          }
        },
        providerData: {
          stt: {
            voice_profile: false,
            language_hints: [languageHint],
            end_of_turn_confidence_threshold: 0.7,
            min_end_of_turn_silence: 200,
            max_turn_silence: 5000,
            vad_threshold: 0.5
          },
          tts: {
            segmenter_strategy: 'sentence',
            language: languageHint
          }
        }
      }
    }));
    console.log('[InworldVoice] Session configured:', { voice, model: llmModel, language: languageHint });

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

    await startInworldMicCapture();

    activeCall = true;
    callStartedAtMs = Date.now();
    onStatusChange?.('live');

    return { success: true, provider: INWORLD_PROVIDER };
  } catch (error) {
    await cleanupInworldCall();
    onStatusChange?.('failed');
    return { success: false, error: error?.message || 'Unable to start Inworld voice mode.' };
  }
};

const handleInworldMessage = (msg) => {
  switch (msg.type) {
    case 'session.created':
      console.log('[InworldVoice] ← session.created');
      break;

    case 'session.updated':
      console.log('[InworldVoice] ← session.updated');
      break;

    case 'response.created':
      if (ignoreNextTimeoutResponse && activeSocket?.readyState === WebSocket.OPEN) {
        console.log('[InworldVoice] Cancelling timeout-triggered response');
        ignoreNextTimeoutResponse = false;
        responseActiveOnServer = true;
        try {
          activeSocket.send(JSON.stringify({ type: 'response.cancel' }));
        } catch {}
        responseActiveOnServer = false;
        break;
      }
      responseActiveOnServer = true;
      break;

    case 'response.output_audio.delta':
      if (msg.delta) {
        onTrace?.('response.output_audio.delta');
        audioBuffers.push(Buffer.from(msg.delta, 'base64'));
        responseInProgress = true;
        queueBufferedAudioSegment().catch((error) => {
          console.error('[InworldVoice] Segment queue error:', error.message);
        });
      }
      break;

    case 'response.output_audio.done':
      responseActiveOnServer = false;
      if (audioBuffers.length > 0) {
        queueBufferedAudioSegment({ force: true }).catch((error) => {
          console.error('[InworldVoice] Final segment queue error:', error.message);
        });
      }
      break;

    case 'response.done':
      if (audioBuffers.length > 0 && !responseInProgress) {
        queueBufferedAudioSegment({ force: true }).catch((error) => {
          console.error('[InworldVoice] Response-done queue error:', error.message);
        });
      }
      responseActiveOnServer = false;
      responseInProgress = false;
      break;

    case 'response.output_audio_transcript.done':
    case 'response.audio_transcript.done':
      if (msg.transcript) {
        emitTranscript(msg.transcript);
      }
      break;

    case 'input_audio_buffer.speech_started':
      ignoreNextTimeoutResponse = false;
      onTrace?.('input_audio_buffer.speech_started');
      interruptAssistantPlayback({ cancelResponse: true, reason: 'user_speech_started' }).catch((error) => {
        console.error('[InworldVoice] Interrupt error:', error.message);
      });
      break;

    case 'input_audio_buffer.timeout_triggered':
      ignoreNextTimeoutResponse = true;
      onTrace?.('input_audio_buffer.timeout_triggered');
      break;

    case 'input_audio_buffer.speech_stopped':
      onTrace?.('input_audio_buffer.speech_stopped');
      break;

    case 'conversation.item.input_audio_transcription.completed': {
      const transcript = String(msg.transcript || '').trim();
      if (transcript) {
        console.log('[InworldVoice] Heard user:', transcript);
      }
      break;
    }

    case 'conversation.item.input_audio_transcription.delta': {
      const transcript = String(msg.delta || '').trim();
      if (transcript) {
        console.log('[InworldVoice] Hearing user:', transcript);
      }
      break;
    }

    case 'error':
      ignoreNextTimeoutResponse = false;
      responseActiveOnServer = false;
      console.error('[InworldVoice] Server error:', msg);
      break;
  }
};

const startInworldMicCapture = async () => {
  micActive = true;
  startInworldMicCapture._chunkCount = 0;

  if (Platform.OS === 'android') {
    activePcmSession = startPcmCapture({
      sampleRate: INWORLD_SAMPLE_RATE,
      onData: (base64Data) => {
        if (!micActive || !activeSocket || activeSocket.readyState !== WebSocket.OPEN || isMuted || responseActiveOnServer) return;

        // Inworld uses JSON base64, same as Grok
        activeSocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Data
        }));

        startInworldMicCapture._chunkCount++;
        if (startInworldMicCapture._chunkCount <= 3 || startInworldMicCapture._chunkCount % 50 === 0) {
          console.log('[InworldVoice] PCM chunk sent:', startInworldMicCapture._chunkCount);
        }
      }
    });
    console.log('[InworldVoice] Native PCM capture started (AudioRecord @ 24kHz)');
    return;
  }

  // iOS capture path
  const RECORDING_CONFIG = {
    ios: {
      extension: '.wav',
      outputFormat: 'lpcm',
      audioQuality: 127,
      sampleRate: INWORLD_SAMPLE_RATE,
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
          activeSocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: wavBuffer.slice(44).toString('base64')
          }));
        }
      }
    } catch (err) {}
    if (micActive) setTimeout(sendChunk, 1);
  };

  sendChunk();
};

const stopInworldMicCapture = () => {
  micActive = false;
  startInworldMicCapture._chunkCount = 0;

  if (activePcmSession) {
    try {
      activePcmSession.stop();
    } catch {}
    activePcmSession = null;
  }
};

const cleanupInworldCall = async () => {
  stopInworldMicCapture();

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
  responseActiveOnServer = false;
  ignoreNextTimeoutResponse = false;
  activeCall = false;
  isMuted = false;
  callStartedAtMs = null;
  onStatusChange = null;
  onTrace = null;
};

export const sendInworldText = (text) => {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return;

  activeSocket.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text }]
    }
  }));

  activeSocket.send(JSON.stringify({ type: 'response.create' }));
};

export const endInworldVoiceCall = async () => {
  await cleanupInworldCall();
  return { success: true };
};

export const getInworldCallActive = () => activeCall;
export const getInworldMuteState = () => isMuted;

export const setInworldMuted = (muted) => {
  isMuted = muted;
  emitMuteState();
};

export const subscribeToInworldMute = (listener) => {
  muteListeners.add(listener);
  listener(isMuted);
  return () => { muteListeners.delete(listener); };
};

export const subscribeToInworldTranscript = (listener) => {
  transcriptListeners.add(listener);
  return () => { transcriptListeners.delete(listener); };
};

export const ensureInworldMicrophonePermission = async () => {
  try {
    const permission = await Audio.requestPermissionsAsync();
    return { success: permission.granted, error: permission.granted ? null : 'Microphone permission denied' };
  } catch (error) {
    return { success: false, error: error?.message || 'Unable to request microphone permission' };
  }
};

export default {
  startInworldVoiceCall,
  endInworldVoiceCall,
  sendInworldText,
  getInworldCallActive,
  getInworldMuteState,
  setInworldMuted,
  subscribeToInworldMute,
  subscribeToInworldTranscript,
  ensureInworldMicrophonePermission
};
