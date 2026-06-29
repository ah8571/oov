import { AppState } from 'react-native';
import { Audio } from 'expo-av';

let activeRecording = null;
let recordingStartedAt = null;

const buildRecordingAsset = (uri, durationMs) => {
  const extensionMatch = String(uri || '').match(/\.([a-z0-9]+)(?:\?|$)/i);
  const extension = extensionMatch?.[1]?.toLowerCase() || 'm4a';
  const mimeType = extension === 'caf'
    ? 'audio/x-caf'
    : extension === 'wav'
      ? 'audio/wav'
      : 'audio/mp4';

  return {
    uri,
    name: `listen-mode-${Date.now()}.${extension}`,
    mimeType,
    durationMs,
    startedAt: recordingStartedAt,
    endedAt: new Date().toISOString()
  };
};

export const ensureListenModePermission = async () => {
  try {
    const permission = await Audio.requestPermissionsAsync();

    if (!permission.granted) {
      return {
        success: false,
        error: 'Microphone permission denied'
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to request microphone permission'
    };
  }
};

export const startListenModeRecording = async () => {
  if (activeRecording) {
    return {
      success: false,
      error: 'A Listen Mode recording is already active.'
    };
  }

  const permissionResponse = await ensureListenModePermission();

  if (!permissionResponse.success) {
    return permissionResponse;
  }

  if (AppState.currentState !== 'active') {
    return {
      success: false,
      error: 'Listen Mode is only available while the app is open in the foreground.'
    };
  }

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();

    activeRecording = recording;
    recordingStartedAt = new Date().toISOString();

    return {
      success: true,
      startedAt: recordingStartedAt
    };
  } catch (error) {
    activeRecording = null;
    recordingStartedAt = null;
    return {
      success: false,
      error: error?.message || 'Unable to start Listen Mode recording'
    };
  }
};

export const stopListenModeRecording = async () => {
  if (!activeRecording) {
    return {
      success: false,
      error: 'No Listen Mode recording is active.'
    };
  }

  const recording = activeRecording;

  try {
    await recording.stopAndUnloadAsync();
    const status = await recording.getStatusAsync();
    const uri = recording.getURI();

    activeRecording = null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false
    });

    if (!uri) {
      throw new Error('Recording file URI was unavailable');
    }

    const recordingAsset = buildRecordingAsset(uri, Number(status.durationMillis || 0));
    recordingStartedAt = null;

    return {
      success: true,
      recording: recordingAsset
    };
  } catch (error) {
    activeRecording = null;
    recordingStartedAt = null;
    return {
      success: false,
      error: error?.message || 'Unable to stop Listen Mode recording'
    };
  }
};

export const isListenModeRecordingActive = () => Boolean(activeRecording);

export default {
  ensureListenModePermission,
  startListenModeRecording,
  stopListenModeRecording,
  isListenModeRecordingActive
};