import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { createNote, createVoiceCallConnection, getNote, getNotes, submitVoiceCallCompletion, updateNote } from './api.js';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription
} from 'react-native-webrtc';

const OPENAI_REALTIME_PROVIDER = 'openai-realtime';
const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2.1';
const DEFAULT_REALTIME_VOICE = 'marin';
const DEFAULT_REALTIME_INSTRUCTIONS = 'You can use your note tools only when the user explicitly asks. Keep responses brief and natural.';
const LANGUAGE_LABELS = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  zh: 'Mandarin Chinese',
  hi: 'Hindi',
  ar: 'Arabic',
  ja: 'Japanese'
};
const NOTE_TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'list_notes',
    description: 'List the user\'s saved notes so you can answer questions about what notes exist.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'read_note',
    description: 'Read a saved note by note ID or by an exact title match when the user asks about a specific note.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        noteId: {
          type: 'string',
          description: 'The exact note ID if it is already known.'
        },
        title: {
          type: 'string',
          description: 'The exact note title to look up when the note ID is not known.'
        }
      }
    }
  },
  {
    type: 'function',
    name: 'save_note',
    description: 'Create a new note or update an existing note when the user explicitly asks to save something to notes.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'content'],
      properties: {
        noteId: {
          type: 'string',
          description: 'The existing note ID to update, if known.'
        },
        title: {
          type: 'string',
          description: 'A concise title for the note.'
        },
        content: {
          type: 'string',
          description: 'The note body. For checklist items, write each on its own line as "[ ] item" or "[x] item" without any dash or bullet prefix.'
        }
      }
    }
  }
];

let activePeerConnection = null;
let activeDataChannel = null;
let localAudioStream = null;
let activeCall = false;
let isMuted = false;
let isHandlingToolCall = false;
let onNotesChangedListener = null;
let callStartedAtMs = null;
let callVoice = null;
let callModel = null;
let selectedAudioRoute = null;

export const setOnNotesChanged = (callback) => {
  onNotesChangedListener = callback;
};

const audioRoutes = [
  { uuid: 'speaker', type: 'speaker', name: 'Speaker' },
  { uuid: 'earpiece', type: 'earpiece', name: 'Phone' },
  { uuid: 'bluetooth', type: 'bluetooth', name: 'Bluetooth' }
];

const muteListeners = new Set();
const audioDeviceListeners = new Set();

const emitMuteState = () => {
  muteListeners.forEach((listener) => {
    listener(isMuted);
  });
};

const emitAudioDevices = () => {
  const payload = {
    audioDevices: audioRoutes,
    selectedDevice: selectedAudioRoute
  };

  audioDeviceListeners.forEach((listener) => {
    listener(payload);
  });
};

const normalizePrimaryLanguage = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('it')) return 'it';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('hi')) return 'hi';
  if (normalized.startsWith('ar')) return 'ar';
  if (normalized.startsWith('ja')) return 'ja';
  return 'en';
};

const findNoteByTitle = async (title) => {
  const response = await getNotes(null, 100, 0);

  if (!response.success) {
    throw new Error(response.error || 'Unable to load notes.');
  }

  const normalizedTitle = String(title || '').trim().toLowerCase();
  const note = (response.notes || []).find((entry) => String(entry?.title || '').trim().toLowerCase() === normalizedTitle) || null;

  return {
    note,
    notes: response.notes || []
  };
};

const executeRealtimeTool = async (name, rawArguments) => {
  const args = typeof rawArguments === 'string' && rawArguments.trim()
    ? JSON.parse(rawArguments)
    : {};

  if (name === 'list_notes') {
    const response = await getNotes(null, 100, 0);

    if (!response.success) {
      throw new Error(response.error || 'Unable to list notes.');
    }

    return {
      success: true,
      count: Array.isArray(response.notes) ? response.notes.length : 0,
      notes: (response.notes || []).map((note) => ({
        id: note.id,
        title: note.title,
        updatedAt: note.updatedAt || note.updated_at || null
      }))
    };
  }

  if (name === 'read_note') {
    const noteId = String(args.noteId || '').trim();
    const title = String(args.title || '').trim();

    if (noteId) {
      const response = await getNote(noteId);

      if (!response.success || !response.note) {
        throw new Error(response.error || 'Unable to read that note.');
      }

      return {
        success: true,
        note: response.note
      };
    }

    if (!title) {
      throw new Error('A note title or note ID is required to read a note.');
    }

    const lookup = await findNoteByTitle(title);

    if (!lookup.note) {
      return {
        success: false,
        error: `No saved note matched the title "${title}".`
      };
    }

    const response = await getNote(lookup.note.id);

    if (!response.success || !response.note) {
      throw new Error(response.error || 'Unable to read that note.');
    }

    return {
      success: true,
      note: response.note
    };
  }

  if (name === 'save_note') {
    const noteId = String(args.noteId || '').trim();
    const title = String(args.title || '').trim();
    const content = String(args.content || '').trim();

    if (!title || !content) {
      throw new Error('A note title and content are required to save a note.');
    }

    if (noteId) {
      const response = await updateNote(noteId, title, content, null);

      if (!response.success || !response.note) {
        throw new Error(response.error || 'Unable to update that note.');
      }

      onNotesChangedListener?.();

      return {
        success: true,
        operation: 'updated',
        note: response.note
      };
    }

    const lookup = await findNoteByTitle(title);

    if (lookup.note) {
      const response = await updateNote(lookup.note.id, title, content, lookup.note.topicId || lookup.note.topic_id || null);

      if (!response.success || !response.note) {
        throw new Error(response.error || 'Unable to update that note.');
      }

      onNotesChangedListener?.();

      return {
        success: true,
        operation: 'updated',
        note: response.note
      };
    }

    const response = await createNote(title, content, null);

    if (!response.success || !response.note) {
      throw new Error(response.error || 'Unable to create that note.');
    }

    onNotesChangedListener?.();

    return {
      success: true,
      operation: 'created',
      note: response.note
    };
  }

  throw new Error(`Unsupported Voice Mode tool: ${name}`);
};

const handleRealtimeResponseDone = async (payload, onError, onTrace) => {
  const outputItems = Array.isArray(payload?.response?.output) ? payload.response.output : [];
  const functionCalls = outputItems.filter((item) => item?.type === 'function_call' && item?.call_id && item?.name);

  if (functionCalls.length === 0 || !activeDataChannel || isHandlingToolCall) {
    return;
  }

  isHandlingToolCall = true;

  try {
    for (const functionCall of functionCalls) {
      onTrace?.('native_webrtc_tool_call_started', {
        name: functionCall.name
      });

      const result = await executeRealtimeTool(functionCall.name, functionCall.arguments);

      activeDataChannel.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: functionCall.call_id,
          output: JSON.stringify(result)
        }
      }));
    }

    activeDataChannel.send(JSON.stringify({ type: 'response.create' }));
    onTrace?.('native_webrtc_tool_call_finished');
  } catch (error) {
    onError?.(error?.message || 'Voice Mode could not complete that note action.');
    onTrace?.('native_webrtc_tool_call_failed', {
      message: error?.message || 'unknown'
    });
  } finally {
    isHandlingToolCall = false;
  }
};

const mapConnectionState = (state) => {
  if (state === 'connected') {
    return 'live';
  }

  if (state === 'connecting' || state === 'new') {
    return 'connecting';
  }

  if (state === 'disconnected') {
    return 'reconnecting';
  }

  if (state === 'failed') {
    return 'failed';
  }

  if (state === 'closed') {
    return 'ended';
  }

  return 'connecting';
};

const stopLocalTracks = () => {
  if (!localAudioStream) {
    return;
  }

  localAudioStream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore track shutdown failures during call teardown.
    }
  });

  localAudioStream = null;
};

const cleanupCallResources = async () => {
  const durationMs = callStartedAtMs ? Date.now() - callStartedAtMs : 0;
  const durationSeconds = Math.round(durationMs / 1000);

  if (durationSeconds > 2 && callVoice) {
    submitVoiceCallCompletion({
      durationSeconds,
      voice: callVoice,
      model: callModel || DEFAULT_REALTIME_MODEL
    }).catch(() => {
      // Best-effort call cost tracking.
    });
  }

  callStartedAtMs = null;
  callVoice = null;
  callModel = null;

  if (activeDataChannel) {
    try {
      activeDataChannel.close();
    } catch {
      // Ignore data channel cleanup errors.
    }
    activeDataChannel = null;
  }

  if (activePeerConnection) {
    try {
      activePeerConnection.close();
    } catch {
      // Ignore peer-connection cleanup errors.
    }
    activePeerConnection = null;
  }

  stopLocalTracks();

  activeCall = false;
  isHandlingToolCall = false;
  isMuted = false;
  emitMuteState();

  // Clean up iOS speakerphone
  if (Platform.OS === 'ios') {
    try {
      InCallManager.stop();
    } catch {
      // InCallManager cleanup is best-effort
    }
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: selectedAudioRoute?.type === 'earpiece',
    staysActiveInBackground: false
  }).catch(() => {
    // Ignore audio mode cleanup failures.
  });
};

export const ensureMicrophonePermission = async () => {
  try {
    const permission = await Audio.requestPermissionsAsync();

    if (permission.granted) {
      return { success: true };
    }

    return {
      success: false,
      error: 'Microphone permission denied'
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to request microphone permission'
    };
  }
};

export const startVoiceCall = async ({ session = null, params = {}, onStatusChange, onError, onTrace }) => {
  if (activeCall) {
    return {
      success: false,
      error: 'A voice call is already active.'
    };
  }

  try {
    onTrace?.('native_webrtc_audio_mode_configuring');

    // On iOS, start InCallManager to control speakerphone for WebRTC
    if (Platform.OS === 'ios') {
      try {
        InCallManager.start({ media: 'audio' });
        // Delay speakerphone activation so WebRTC's native audio session is ready
        setTimeout(() => {
          InCallManager.setSpeakerphoneOn(true);
        }, 500);
        selectedAudioRoute = { uuid: 'speaker', type: 'speaker', name: 'Speaker' };
        emitAudioDevices();
      } catch {
        // InCallManager setup is best-effort
      }
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: Platform.OS === 'android' && selectedAudioRoute?.type === 'earpiece',
      staysActiveInBackground: false
    });

    onTrace?.('native_webrtc_get_user_media_started');
    localAudioStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false
    });
    onTrace?.('native_webrtc_get_user_media_finished');

    const peerConnection = new RTCPeerConnection();
    activePeerConnection = peerConnection;

    localAudioStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localAudioStream);
    });

    peerConnection.addEventListener('connectionstatechange', () => {
      const nextStatus = mapConnectionState(peerConnection.connectionState);
      onTrace?.('native_webrtc_connection_state', { state: peerConnection.connectionState });
      onStatusChange?.(nextStatus);

      if (nextStatus === 'failed' || nextStatus === 'ended') {
        cleanupCallResources().catch(() => {
          // Ignore cleanup failures after terminal connection state changes.
        });
      }
    });

    peerConnection.addEventListener('iceconnectionstatechange', () => {
      onTrace?.('native_webrtc_ice_state', { state: peerConnection.iceConnectionState });
    });

    peerConnection.addEventListener('track', (event) => {
      onTrace?.('native_webrtc_remote_track', {
        streamCount: Array.isArray(event.streams) ? event.streams.length : 0,
        kind: event.track?.kind || 'unknown'
      });
    });

    const dataChannel = peerConnection.createDataChannel('oai-events');
    activeDataChannel = dataChannel;

    dataChannel.addEventListener('open', () => {
      onTrace?.('native_webrtc_data_channel_open');

      const primaryLanguage = normalizePrimaryLanguage(params.language);
      const selectedVoice = String(params.voice || session?.voice || DEFAULT_REALTIME_VOICE).trim() || DEFAULT_REALTIME_VOICE;

      const sessionUpdatePayload = {
        type: 'session.update',
        session: {
          type: 'realtime',
          model: session?.model || DEFAULT_REALTIME_MODEL,
          instructions: DEFAULT_REALTIME_INSTRUCTIONS,
          tool_choice: 'auto',
          tools: NOTE_TOOL_DEFINITIONS,
          audio: {
            input: {
              transcription: {
                model: 'gpt-realtime-whisper',
                language: primaryLanguage
              }
            },
            output: {
              voice: selectedVoice
            }
          }
        }
      };
      console.log('[VoiceMode] Sending session.update with tools:', NOTE_TOOL_DEFINITIONS.map(t => t.name));
      dataChannel.send(JSON.stringify(sessionUpdatePayload));

      onTrace?.('native_webrtc_session_updated', {
        language: primaryLanguage,
        voice: selectedVoice
      });
    });

    dataChannel.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload?.type) {
          onTrace?.(`native_webrtc_event_${payload.type}`);
        }

        if (payload?.type === 'session.created' || payload?.type === 'session.updated') {
          const tools = payload?.session?.tools;
          console.log('[VoiceMode] Session state received. Tools:', Array.isArray(tools) ? tools.map(t => t.name || t.type) : 'none');
          onTrace?.('native_webrtc_session_state', {
            voice: payload?.session?.audio?.output?.voice || null,
            model: payload?.session?.model || null
          });
        }

        if (payload?.type === 'response.done') {
          handleRealtimeResponseDone(payload, onError, onTrace).catch(() => {
            // Tool-call failures are surfaced through onError and do not need to crash the session.
          });
        }

        if (payload?.type === 'error' || payload?.error) {
          const errorMessage = payload?.error?.message || payload?.message || 'Voice Mode reported an error.';
          onError?.(errorMessage);
        }
      } catch {
        // Ignore non-JSON data-channel messages.
      }
    });

    onStatusChange?.('connecting');
    onTrace?.('native_webrtc_offer_creating');
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });
    await peerConnection.setLocalDescription(offer);

    onTrace?.('native_webrtc_sdp_exchange_started');
    const response = await createVoiceCallConnection(offer.sdp, {
      voice: params.voice
    });

    if (!response.success || !response.answerSdp) {
      throw new Error(response.error || 'Voice call setup failed.');
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: response.answerSdp
    }));
    onTrace?.('native_webrtc_sdp_exchange_finished');

    activeCall = true;
    callStartedAtMs = Date.now();
    callVoice = String(params.voice || session?.voice || DEFAULT_REALTIME_VOICE).trim() || DEFAULT_REALTIME_VOICE;
    callModel = session?.model || DEFAULT_REALTIME_MODEL;
    emitAudioDevices();

    return {
      success: true,
      provider: OPENAI_REALTIME_PROVIDER
    };
  } catch (error) {
    await cleanupCallResources();
    onStatusChange?.('failed');
    return {
      success: false,
      error: error?.message || 'Unable to start Voice Mode.'
    };
  }
};

export const endVoiceCall = async () => {
  if (activeDataChannel) {
    try {
      activeDataChannel.send(JSON.stringify({ type: 'response.cancel' }));
      activeDataChannel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
    } catch {
      // Ignore best-effort shutdown signaling failures.
    }
  }

  await cleanupCallResources();
  return { success: true };
};

export const getVoiceCallActive = () => activeCall;

export const getAudioDeviceState = () => ({
  audioDevices: audioRoutes,
  selectedDevice: selectedAudioRoute
});

export const getMuteState = () => isMuted;

export const refreshAudioDevices = async () => ({
  success: true,
  audioDevices: audioRoutes,
  selectedDevice: selectedAudioRoute
});

export const selectAudioDevice = async (deviceUuid) => {
  const nextRoute = audioRoutes.find((device) => device.uuid === deviceUuid) || null;

  if (!nextRoute) {
    return {
      success: false,
      error: 'Audio route is not available on this device.'
    };
  }

  selectedAudioRoute = nextRoute;
  emitAudioDevices();

  try {
    InCallManager.setSpeakerphoneOn(nextRoute.type === 'speaker');
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to switch audio route.'
    };
  }
};

export const subscribeToAudioDevices = (listener) => {
  audioDeviceListeners.add(listener);
  listener({
    audioDevices: audioRoutes,
    selectedDevice: selectedAudioRoute
  });
  return () => {
    audioDeviceListeners.delete(listener);
  };
};

export const subscribeToMuteState = (listener) => {
  muteListeners.add(listener);
  listener(isMuted);
  return () => {
    muteListeners.delete(listener);
  };
};

export const toggleMute = async () => {
  if (!localAudioStream) {
    return {
      success: false,
      error: 'No active Voice Mode audio stream is available.'
    };
  }

  const [audioTrack] = localAudioStream.getAudioTracks();

  if (!audioTrack) {
    return {
      success: false,
      error: 'Voice Mode microphone track was unavailable.'
    };
  }

  audioTrack.enabled = !audioTrack.enabled;
  isMuted = !audioTrack.enabled;
  emitMuteState();

  return {
    success: true,
    isMuted
  };
};
