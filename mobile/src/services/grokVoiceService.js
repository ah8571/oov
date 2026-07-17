import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
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
const MIC_CHUNK_MS = 500;

const muteListeners = new Set();
const transcriptListeners = new Set();

const DEFAULT_GROK_VOICE = 'eve';

const emitMuteState = () => {
  muteListeners.forEach((l) => l(isMuted));
};

const emitTranscript = (text) => {
  transcriptListeners.forEach((l) => l(text));
};

export const startGrokVoiceCall = async ({ voice = DEFAULT_GROK_VOICE, onStatusChange: statusCb, onTrace: traceCb } = {}) => {
  if (activeCall) {
    return { success: false, error: 'A Grok voice call is already active.' };
  }

  try {
    onStatusChange = statusCb;
    onTrace = traceCb;
    audioBuffers = [];
    responseInProgress = false;

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
        try {
          const msg = JSON.parse(event.data);
          handleGrokMessage(msg);
        } catch {
          // Binary frame — raw PCM audio
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
          silence_duration_ms: 900,
          prefix_padding_ms: 400
        },
        audio: {
          input: { format: { type: 'audio/pcm', rate: 24000 }, transport: 'json' },
          output: { format: { type: 'audio/pcm', rate: 24000 }, transport: 'json' }
        }
      }
    }));
    console.log('[GrokVoice] Session configured, waiting for audio');

    // Set up audio for playback
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
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

    // Start chunked microphone capture via expo-av
    startMicCapture().catch((err) => {
      console.log('[GrokVoice] Mic capture failed:', err.message);
    });

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
    case 'response.output_audio.delta':
      if (msg.delta) {
        audioBuffers.push(Buffer.from(msg.delta, 'base64'));
        responseInProgress = true;
      }
      break;

    case 'response.audio.done':
    case 'response.output_audio.done':
      if (audioBuffers.length > 0) {
        playBufferedAudio();
      }
      break;

    case 'response.done':
      if (audioBuffers.length > 0 && !responseInProgress) {
        playBufferedAudio();
      }
      responseInProgress = false;
      break;

    case 'response.output_audio_transcript.done':
    case 'response.audio_transcript.done':
      if (msg.transcript) {
        emitTranscript(msg.transcript);
      }
      break;

    case 'error':
      console.error('[GrokVoice] Server error:', msg);
      break;
  }
};

const playBufferedAudio = async () => {
  try {
    const pcmBuffer = Buffer.concat(audioBuffers);
    audioBuffers = [];

    if (pcmBuffer.length < 100) {
      console.log('[GrokVoice] Skipping empty audio buffer');
      return;
    }

    console.log('[GrokVoice] Playing audio:', { pcmBytes: pcmBuffer.length });

    // Write PCM to temp WAV file for playback
    const wavPath = GROK_AUDIO_FILE.replace('.pcm', '.wav');
    const wavBuffer = createWavBuffer(pcmBuffer, 24000);
    await FileSystem.writeAsStringAsync(wavPath, wavBuffer.toString('base64'), {
      encoding: FileSystem.EncodingType.Base64
    });

    // Unload previous sound
    if (playbackSound) {
      await playbackSound.unloadAsync().catch(() => {});
      playbackSound = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: wavPath },
      { shouldPlay: true }
    );
    playbackSound = sound;
  } catch (error) {
    console.error('[GrokVoice] Playback error:', error.message);
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
  responseInProgress = false;
  activeCall = false;
  isMuted = false;
  callStartedAtMs = null;
  onStatusChange = null;
  onTrace = null;
};

const startMicCapture = async () => {
  micActive = true;
  let pcmSession = null;

  // Android: use our custom PcmCapture native module (AudioRecord → real PCM)
  if (Platform.OS === 'android') {
    try {
      pcmSession = startPcmCapture({
        sampleRate: 24000,
        onData: (base64Data) => {
          if (!micActive || !activeSocket || activeSocket.readyState !== WebSocket.OPEN || isMuted) return;

          activeSocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Data
          }));

          if (!startMicCapture._chunkCount) startMicCapture._chunkCount = 0;
          startMicCapture._chunkCount++;
          const buf = Buffer.from(base64Data, 'base64');
          if (startMicCapture._chunkCount <= 3 || startMicCapture._chunkCount % 10 === 0) {
            console.log('[GrokVoice] PCM chunk sent:', startMicCapture._chunkCount, { pcmBytes: buf.length });
          }
        }
      });
      console.log('[GrokVoice] Native PCM capture started (AudioRecord)');
      return;
    } catch (err) {
      console.log('[GrokVoice] Native PCM init failed, falling back:', err.message);
    }
  }

  // iOS / fallback
  const RECORDING_CONFIG = {
    android: { extension: '.wav', outputFormat: 2, audioEncoder: 1, sampleRate: 24000, numberOfChannels: 1 },
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
