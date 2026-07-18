import { Platform } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription
} from 'react-native-webrtc';
import { API_BASE_URL } from './api.js';

const INWORLD_PROVIDER = 'inworld-voice';
const DEFAULT_INWORLD_VOICE = 'Clive';
const DEFAULT_INWORLD_LANGUAGE = 'en-US';

let peerConnection = null;
let dataChannel = null;
let localStream = null;
let activeCall = false;
let isMuted = false;
let onStatusChange = null;
let onTrace = null;
let callStartedAtMs = null;

const muteListeners = new Set();
const transcriptListeners = new Set();

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

const INWORLD_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Clive', 'Liam', 'Sarah'];

const normalizeInworldVoice = (openAiVoice) => {
  // Inworld voices are different from OpenAI. Map common choices or default to Clive.
  const name = String(openAiVoice || '').trim();
  if (INWORLD_VOICES.includes(name)) return name;
  return DEFAULT_INWORLD_VOICE;
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
    const languageHint = normalizeInworldLanguage(language);
    const inworldVoice = normalizeInworldVoice(voice);

    onTrace?.('inworld_rtc_config_fetching');

    // Fetch ICE servers + API credentials from our backend
    const configUrl = __DEV__
      ? 'http://127.0.0.1:3000/api/voice/inworld/rtc-config'
      : `${API_BASE_URL}/voice/inworld/rtc-config`;

    const configRes = await fetch(configUrl);
    const configData = await configRes.json();

    if (!configData.success || !configData.config) {
      throw new Error(configData.error || 'Unable to fetch Inworld RTC config.');
    }

    const { apiKey, iceServers, callUrl } = configData.config;

    onTrace?.('inworld_rtc_config_fetched');

    // Get microphone stream
    const stream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 24000,
        channelCount: 1
      }
    });
    localStream = stream;

    // Create peer connection with ICE servers
    peerConnection = new RTCPeerConnection({
      iceServers: iceServers?.length ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Create data channel for JSON events (same schema as WebSocket)
    dataChannel = peerConnection.createDataChannel('oai-events', { ordered: true });

    // Add microphone track
    stream.getAudioTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });

    // Handle remote audio track (delivered via RTP, handled natively by WebRTC)
    peerConnection.ontrack = (_event) => {
      onTrace?.('inworld_remote_track_received');
    };

    dataChannel.onopen = () => {
      onTrace?.('inworld_datachannel_open');

      const llmModel = modelId || 'openai/gpt-4o-mini';

      dataChannel.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: llmModel,
          instructions: '',
          output_modalities: ['audio', 'text'],
          audio: {
            input: {
              turn_detection: {
                type: 'semantic_vad',
                eagerness: 'medium',
                create_response: true,
                interrupt_response: true
              }
            },
            output: {
              voice: inworldVoice,
              model: 'inworld-tts-2'
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

      console.log('[InworldVoice] WebRTC session configured:', { voice: inworldVoice, model: llmModel, language: languageHint });
    };

    dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleInworldMessage(msg);
      } catch {}
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection?.iceConnectionState;
      console.log('[InworldVoice] ICE state:', state);
      if (state === 'failed' || state === 'disconnected') {
        if (activeCall) {
          onStatusChange?.('ended');
          cleanupInworldCall();
        }
      }
    };

    // Create and exchange SDP
    const offer = await peerConnection.createOffer({ offerToReceiveAudio: true });
    await peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await new Promise((resolve) => {
      if (peerConnection.iceGatheringState === 'complete') { resolve(); return; }
      let timeout;
      peerConnection.onicegatheringstatechange = () => {
        if (peerConnection.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
      peerConnection.onicecandidate = () => {
        clearTimeout(timeout);
        timeout = setTimeout(resolve, 1000);
      };
      timeout = setTimeout(resolve, 3000);
    });

    onTrace?.('inworld_sdp_exchange_started');

    const sdpRes = await fetch(callUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': `Bearer ${apiKey}`
      },
      body: peerConnection.localDescription.sdp
    });

    if (!sdpRes.ok) {
      const errText = await sdpRes.text();
      throw new Error(`Inworld SDP exchange failed (${sdpRes.status}): ${errText}`);
    }

    const answerSdp = await sdpRes.text();
    await peerConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: answerSdp
    }));

    onTrace?.('inworld_sdp_exchange_finished');

    // Set up audio routing
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

    case 'response.output_audio.delta':
      // Audio flows via RTP, not data channel — ignore
      break;

    case 'response.output_audio.done':
      break;

    case 'response.output_audio_transcript.done':
    case 'response.audio_transcript.done':
      if (msg.transcript) {
        emitTranscript(msg.transcript);
      }
      break;

    case 'conversation.item.input_audio_transcription.completed': {
      const transcript = String(msg.transcript || '').trim();
      if (transcript) {
        console.log('[InworldVoice] Heard user:', transcript);
      }
      break;
    }

    case 'input_audio_buffer.speech_started':
      onTrace?.('input_audio_buffer.speech_started');
      break;

    case 'input_audio_buffer.speech_stopped':
      onTrace?.('input_audio_buffer.speech_stopped');
      break;

    case 'response.done':
      break;

    case 'error':
      console.error('[InworldVoice] Server error:', msg);
      break;
  }
};

const cleanupInworldCall = async () => {
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
      track.release?.();
    });
    localStream = null;
  }

  if (dataChannel) {
    try { dataChannel.close(); } catch {}
    dataChannel = null;
  }

  if (peerConnection) {
    try { peerConnection.close(); } catch {}
    peerConnection = null;
  }

  try { InCallManager.stop(); } catch {}

  activeCall = false;
  isMuted = false;
  callStartedAtMs = null;
  onStatusChange = null;
  onTrace = null;
};

export const sendInworldText = (text) => {
  if (!dataChannel || dataChannel.readyState !== 'open') return;

  dataChannel.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text }]
    }
  }));

  dataChannel.send(JSON.stringify({ type: 'response.create' }));
};

export const endInworldVoiceCall = async () => {
  await cleanupInworldCall();
  return { success: true };
};

export const getInworldCallActive = () => activeCall;
export const getInworldMuteState = () => isMuted;

export const setInworldMuted = (muted) => {
  isMuted = muted;
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  }
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
  const { ensureMicrophonePermission } = require('./voiceService.js');
  return ensureMicrophonePermission();
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
