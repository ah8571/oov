import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/src/legacy';
import InCallManager from 'react-native-incall-manager';
import { startPcmCapture } from './pcmCapture.js';
import { createGrokVoiceSession } from './api.js';

const GROK_PROVIDER = 'grok-voice';
const GROK_AUDIO_FILE = `${FileSystem.cacheDirectory}grok-response.pcm`;

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
const MIC_CHUNK_MS = 500;
const GROK_SAMPLE_RATE = 24000;
const STREAMING_PLAYBACK_SEGMENT_BYTES = 24000;

const muteListeners = new Set();
const transcriptListeners = new Set();

const DEFAULT_GROK_VOICE = 'eve';
const DEFAULT_GROK_LANGUAGE_HINT = 'en';

const emitMuteState = () => {
  muteListeners.forEach((l) => l(isMuted));
};

const emitTranscript = (text) => {
  transcriptListeners.forEach((l) => l(text));
};

const normalizeGrokLanguageHint = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.startsWith('es')) return 'es-MX';
  if (normalized.startsWith('pt')) return 'pt-BR';
  if (normalized.startsWith('ar')) return 'ar-EG';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('it')) return 'it';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('hi')) return 'hi';

  return DEFAULT_GROK_LANGUAGE_HINT;
};

const toArrayBuffer = (buffer) => {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

const getBufferedAudioBytes = () => {
  return audioBuffers.reduce((total, chunk) => total + chunk.length, 0);
};

const interruptAssistantPlayback = async ({ cancelResponse = false, reason = 'interrupt' } = {}) => {
  const hadPlayback = playbackActive || playbackQueue.length > 0 || audioBuffers.length > 0 || responseInProgress;

  if (!hadPlayback) {
    return;
  }

  console.log('[GrokVoice] Interrupting assistant playback:', {
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
  if (playbackSegmentFlushInProgress) {
    return;
  }

  const pcmBytes = getBufferedAudioBytes();

  if (pcmBytes < 100) {
    return;
  }

  if (!force && (pcmBytes < STREAMING_PLAYBACK_SEGMENT_BYTES || playbackQueue.length > 0)) {
    return;
  }

  playbackSegmentFlushInProgress = true;

  const pcmBuffer = Buffer.concat(audioBuffers);
  audioBuffers = [];

  try {
    const wavPath = GROK_AUDIO_FILE.replace('.pcm', `-${playbackSegmentIndex++}.wav`);
    const wavBuffer = createWavBuffer(pcmBuffer, GROK_SAMPLE_RATE);
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
    // Create the new sound BEFORE unloading the old one
    const { sound } = await Audio.Sound.createAsync(
      { uri: nextSegment.uri },
      { shouldPlay: false }
    );

    // Unload previous and swap in the new one
    if (playbackSound) {
      await playbackSound.unloadAsync().catch(() => {});
    }
    playbackSound = sound;
    await playbackSound.playAsync();

    console.log('[GrokVoice] Playing audio segment:', { pcmBytes: nextSegment.pcmBytes, queuedSegments: playbackQueue.length });

    playbackSound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        playbackSound.setOnPlaybackStatusUpdate(null);
        playbackActive = false;
        playNextBufferedSegment().catch((err) => {
          console.error('[GrokVoice] Playback queue error:', err.message);
        });
      }
    });
  } catch (error) {
    playbackActive = false;
    console.error('[GrokVoice] Playback error:', error.message);
    await playNextBufferedSegment();
  }
};

export const startGrokVoiceCall = async ({ voice = DEFAULT_GROK_VOICE, language = DEFAULT_GROK_LANGUAGE_HINT, onStatusChange: statusCb, onTrace: traceCb } = {}) => {
  if (activeCall) {
    return { success: false, error: 'A Grok voice call is already active.' };
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
    const languageHint = normalizeGrokLanguageHint(language);

    onTrace?.('grok_session_request_started');

    const sessionResponse = await createGrokVoiceSession({ voice });

    if (!sessionResponse.success) {
      throw new Error(sessionResponse.error || 'Unable to start Grok voice session.');
    }

    onTrace?.('grok_session_request_finished');

    const { wsUrl, ephemeralToken } = sessionResponse;
    const wsProtocol = `xai-client-secret.${ephemeralToken}`;

    onTrace?.('grok_websocket_connecting');

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, [wsProtocol]);
      activeSocket = ws;
      ws.binaryType = 'arraybuffer';

      const connectionTimeout = setTimeout(() => {
        reject(new Error('Grok WebSocket connection timed out'));
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        onTrace?.('grok_websocket_connected');
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        reject(new Error('Grok WebSocket connection failed. Check API key and network.'));
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          audioBuffers.push(Buffer.from(event.data));
          return;
        }

        try {
          const msg = JSON.parse(event.data);
          handleGrokMessage(msg);
        } catch {
          // Some runtimes surface binary frames as strings; preserve the previous fallback.
          audioBuffers.push(Buffer.from(event.data, 'base64'));
        }
      };

      ws.onclose = (event) => {
        if (activeCall) {
          onStatusChange?.('ended');
          cleanupGrokCall();
        }
      };
    });

    // Configure session
    activeSocket.send(JSON.stringify({
      type: 'session.update',
      session: {
        voice,
        instructions: '',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.6,
          silence_duration_ms: 350,
          prefix_padding_ms: 700
        },
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: GROK_SAMPLE_RATE },
            transport: 'binary',
            transcription: { language_hint: languageHint }
          },
          output: { format: { type: 'audio/pcm', rate: 24000 }, transport: 'json' }
        }
      }
    }));
    console.log('[GrokVoice] Session configured, waiting for audio', { languageHint });

    // Set up audio for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false
    });

    // Force speaker output on both platforms
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

    await startMicCapture();

    activeCall = true;
    callStartedAtMs = Date.now();
    onStatusChange?.('live');

    return { success: true, provider: GROK_PROVIDER };
  } catch (error) {
    await cleanupGrokCall();
    onStatusChange?.('failed');
    return { success: false, error: error?.message || 'Unable to start Grok voice mode.' };
  }
};

const handleGrokMessage = (msg) => {
  console.log('[GrokVoice] ←', msg.type);

  switch (msg.type) {
    case 'response.created':
      if (ignoreNextTimeoutResponse && activeSocket?.readyState === WebSocket.OPEN) {
        console.log('[GrokVoice] Cancelling timeout-triggered response');
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
          console.error('[GrokVoice] Segment queue error:', error.message);
        });
      }
      break;

    case 'response.audio.done':
    case 'response.output_audio.done':
      responseActiveOnServer = false;
      if (audioBuffers.length > 0) {
        queueBufferedAudioSegment({ force: true }).catch((error) => {
          console.error('[GrokVoice] Final segment queue error:', error.message);
        });
      }
      break;

    case 'response.done':
      if (audioBuffers.length > 0 && !responseInProgress) {
        queueBufferedAudioSegment({ force: true }).catch((error) => {
          console.error('[GrokVoice] Response-done queue error:', error.message);
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
        console.error('[GrokVoice] Interrupt error:', error.message);
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
        console.log('[GrokVoice] Heard user:', transcript);
      }
      break;
    }

    case 'conversation.item.input_audio_transcription.updated': {
      const transcript = String(msg.transcript || '').trim();
      if (transcript) {
        console.log('[GrokVoice] Hearing user:', transcript);
      }
      break;
    }

    case 'error':
      ignoreNextTimeoutResponse = false;
      responseActiveOnServer = false;
      console.error('[GrokVoice] Server error:', msg);
      break;
  }
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

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(totalSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  pcmBuffer.copy(buffer, offset);

  return buffer;
};

const cleanupGrokCall = async () => {
  stopMicCapture();

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

const startMicCapture = async () => {
  micActive = true;
  startMicCapture._chunkCount = 0;

  // Android must use the native PCM path. The expo-av fallback does not produce
  // the raw PCM16 stream Grok expects on Android.
  if (Platform.OS === 'android') {
    activePcmSession = startPcmCapture({
      sampleRate: GROK_SAMPLE_RATE,
      onData: (base64Data) => {
        if (!micActive || !activeSocket || activeSocket.readyState !== WebSocket.OPEN || isMuted || responseActiveOnServer) return;

        const pcmBuffer = Buffer.from(base64Data, 'base64');
        activeSocket.send(toArrayBuffer(pcmBuffer));

        startMicCapture._chunkCount++;
        if (startMicCapture._chunkCount <= 3 || startMicCapture._chunkCount % 50 === 0) {
          console.log('[GrokVoice] PCM chunk sent:', startMicCapture._chunkCount, { pcmBytes: pcmBuffer.length, transport: 'binary' });
        }
      }
    });
    console.log('[GrokVoice] Native PCM capture started (AudioRecord)');
    return;
  }

  // iOS capture path
  const RECORDING_CONFIG = {
    ios: { extension: '.wav', outputFormat: 'lpcm', audioQuality: 127, sampleRate: 24000, numberOfChannels: 1, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false }
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
          activeSocket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: wavBuffer.slice(44).toString('base64') }));
        }
      }
    } catch (err) {}
    if (micActive) setTimeout(sendChunk, 1);
  };

  sendChunk();
};

const stopMicCapture = () => {
  micActive = false;
  startMicCapture._chunkCount = 0;

  if (activePcmSession) {
    try {
      activePcmSession.stop();
    } catch {}

    activePcmSession = null;
  }
};

export const sendGrokText = (text) => {
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

export const endGrokVoiceCall = async () => {
  await cleanupGrokCall();
  return { success: true };
};

export const getGrokCallActive = () => activeCall;
export const getGrokMuteState = () => isMuted;

export const setGrokMuted = (muted) => {
  isMuted = muted;
  emitMuteState();
};

export const subscribeToGrokMute = (listener) => {
  muteListeners.add(listener);
  listener(isMuted);
  return () => { muteListeners.delete(listener); };
};

export const subscribeToGrokTranscript = (listener) => {
  transcriptListeners.add(listener);
  return () => { transcriptListeners.delete(listener); };
};

export const ensureMicrophonePermission = async () => {
  try {
    const permission = await Audio.requestPermissionsAsync();
    return { success: permission.granted, error: permission.granted ? null : 'Microphone permission denied' };
  } catch (error) {
    return { success: false, error: error?.message || 'Unable to request microphone permission' };
  }
};

export default {
  startGrokVoiceCall,
  endGrokVoiceCall,
  sendGrokText,
  getGrokCallActive,
  getGrokMuteState,
  setGrokMuted,
  subscribeToGrokMute,
  subscribeToGrokTranscript,
  ensureMicrophonePermission
};
