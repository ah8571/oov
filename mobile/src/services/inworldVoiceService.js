import { Audio } from 'expo-av';
import InCallManager from 'react-native-incall-manager';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription
} from 'react-native-webrtc';
import { API_BASE_URL, createNote, getNote, getNotes, updateNote } from './api.js';

const INWORLD_PROVIDER = 'inworld-voice';
const DEFAULT_INWORLD_VOICE = 'Sarah';
const DEFAULT_INWORLD_LANGUAGE = 'en-US';

// Sarah & Jason: en, es, ar, de, it, ja, ko, pt, ru, zh (10 languages)
// Roy Mustang: en, it (2 languages)

const NOTE_TOOLS = [
  {
    type: 'function',
    name: 'list_notes',
    description: "List the user's saved notes so you can answer questions about what notes exist.",
    parameters: { type: 'object', additionalProperties: false, properties: {} }
  },
  {
    type: 'function',
    name: 'read_note',
    description: 'Read a saved note by note ID or by an exact title match when the user asks about a specific note.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        noteId: { type: 'string', description: 'The exact note ID if it is already known.' },
        title: { type: 'string', description: 'The exact note title to look up when the note ID is not known.' }
      }
    }
  },
  {
    type: 'function',
    name: 'save_note',
    description: "Create a new note or update an existing note when the user explicitly asks to save something to notes.",
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'content'],
      properties: {
        noteId: { type: 'string', description: 'The existing note ID to update, if known.' },
        title: { type: 'string', description: 'A concise title for the note.' },
        content: { type: 'string', description: 'The note body. For checklist items, write each on its own line as "[ ] item" or "[x] item" without any dash or bullet prefix.' }
      }
    }
  }
];

const speakerRoute = { uuid: 'speaker', type: 'speaker', name: 'Speaker' };
const earpieceRoute = { uuid: 'earpiece', type: 'earpiece', name: 'Phone' };
const bluetoothRoute = { uuid: 'bluetooth', type: 'bluetooth', name: 'Bluetooth' };
const audioRoutes = [speakerRoute, earpieceRoute, bluetoothRoute];
let selectedAudioRoute = speakerRoute;

const audioDeviceListeners = new Set();

const emitAudioDevices = () => {
  audioDeviceListeners.forEach((l) => l({ audioDevices: audioRoutes, selectedDevice: selectedAudioRoute }));
};

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

  // Map to Sarah's 8 supported languages (plus English)
  if (normalized.startsWith('ar')) return 'ar';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('it')) return 'it';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('zh')) return 'zh';

  return DEFAULT_INWORLD_LANGUAGE;
};

// Voice-language mapping (used for validation)
const INWORLD_VOICES = ['Sarah', 'community-b72meov8bd46'];

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
      const isEnglish = languageHint === 'en' || languageHint === 'en-US';

      // Always use TTS-2 for cross-lingual switching (core feature: bilingual tutor)
      const ttsModel = 'inworld-tts-2';
      const instructions = isEnglish
        ? 'You can use your note tools only when the user explicitly asks. Keep responses brief and natural. If the user switches to another language, match that language with its correct native accent.'
        : `You are a bilingual language tutor. Always use the correct native accent for each language — never speak ${languageHint} with an English accent. Switch naturally between English (your native accent) and ${languageHint} (native ${languageHint} accent) as appropriate for teaching. Explain grammar and vocabulary in English, demonstrate pronunciation in ${languageHint}. You can use your note tools only when the user explicitly asks.`;

      dataChannel.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: llmModel,
          instructions,
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
              model: ttsModel
            }
          },
          tools: NOTE_TOOLS,
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
              segmenter_strategy: 'sentence'
              // Don't lock TTS to a single language — let the model switch naturally
            }
          }
        }
      }));

      console.log('[InworldVoice] WebRTC session configured:', { voice: inworldVoice, model: llmModel, tts: ttsModel, language: languageHint });
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

    // Set up audio mode with Bluetooth support from the start
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldRouteToBluetooth: false,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false
    });

    try {
      InCallManager.start({ media: 'audio' });
      InCallManager.setSpeakerphoneOn(true);
    } catch {}

    activeCall = true;
    callStartedAtMs = Date.now();
    selectedAudioRoute = speakerRoute;
    emitAudioDevices();
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

    case 'response.function_call_arguments.done':
      executeToolCall(msg).catch(err => console.error('[InworldVoice] Tool call error:', err.message));
      break;

    case 'error':
      console.error('[InworldVoice] Server error:', msg);
      break;
  }
};

const executeToolCall = async (msg) => {
  if (!dataChannel || dataChannel.readyState !== 'open') return;

  const callId = msg.call_id || msg.response_id;
  const name = msg.name;
  let args = {};

  try {
    args = typeof msg.arguments === 'string' ? JSON.parse(msg.arguments) : (msg.arguments || {});
  } catch {}

  console.log('[InworldVoice] Tool call:', name, args);

  let result = '{}';

  try {
    switch (name) {
      case 'list_notes': {
        const response = await getNotes(null, 50, 0);
        result = JSON.stringify(response?.notes || []);
        break;
      }
      case 'read_note': {
        if (args.noteId) {
          const response = await getNote(args.noteId);
          result = JSON.stringify(response?.note || {});
        } else if (args.title) {
          const notesResponse = await getNotes(null, 50, 0);
          const notes = notesResponse?.notes || [];
          const found = notes.find(n => (n.title || '').toLowerCase() === String(args.title).toLowerCase());
          if (found) {
            const noteResponse = await getNote(found.id);
            result = JSON.stringify(noteResponse?.note || found);
          } else {
            result = JSON.stringify({ error: 'No note found with that title.' });
          }
        }
        break;
      }
      case 'save_note': {
        if (args.noteId) {
          const response = await updateNote(args.noteId, { title: args.title, content: args.content });
          result = JSON.stringify(response?.note || { success: true });
        } else {
          const response = await createNote({ title: args.title, content: args.content });
          result = JSON.stringify(response?.note || { success: true });
        }
        break;
      }
    }
  } catch (err) {
    result = JSON.stringify({ error: err.message });
  }

  dataChannel.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: callId,
      output: result
    }
  }));

  dataChannel.send(JSON.stringify({ type: 'response.create' }));
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

  selectedAudioRoute = speakerRoute;
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

export const getInworldAudioDeviceState = () => ({
  audioDevices: audioRoutes,
  selectedDevice: selectedAudioRoute
});

export const selectInworldAudioDevice = async (deviceUuid) => {
  const device = audioRoutes.find(r => r.uuid === deviceUuid);
  if (!device) return { success: false, error: 'Unknown audio device.' };

  selectedAudioRoute = device;

  try {
    if (deviceUuid === 'speaker') {
      await Audio.setAudioModeAsync({ shouldRouteToBluetooth: false, playThroughEarpieceAndroid: false });
      InCallManager.setSpeakerphoneOn(true);
    } else if (deviceUuid === 'bluetooth') {
      await Audio.setAudioModeAsync({ shouldRouteToBluetooth: true, playThroughEarpieceAndroid: false });
      InCallManager.setSpeakerphoneOn(false);
    } else {
      await Audio.setAudioModeAsync({ shouldRouteToBluetooth: false, playThroughEarpieceAndroid: true });
      InCallManager.setSpeakerphoneOn(false);
    }
  } catch {}

  emitAudioDevices();
  return { success: true };
};

export const subscribeToInworldAudioDevices = (listener) => {
  audioDeviceListeners.add(listener);
  listener({ audioDevices: audioRoutes, selectedDevice: selectedAudioRoute });
  return () => { audioDeviceListeners.delete(listener); };
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
  getInworldAudioDeviceState,
  selectInworldAudioDevice,
  subscribeToInworldAudioDevices,
  ensureInworldMicrophonePermission
};
