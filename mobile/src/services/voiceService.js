import { Voice, Call } from '@twilio/voice-react-native-sdk';
import { Audio } from 'expo-av';
import { PermissionsAndroid, Platform } from 'react-native';

const CALL_CONNECT_TIMEOUT_MS = 20000;

let voiceInstance = null;
let activeCall = null;
let audioDeviceState = {
  audioDevices: [],
  selectedDevice: null
};
const audioDeviceListeners = new Set();
let audioDeviceEventsBound = false;
let muteState = false;
const muteStateListeners = new Set();

const getVoiceInstance = () => {
  if (!voiceInstance) {
    voiceInstance = new Voice();
  }

  return voiceInstance;
};

const notifyAudioDeviceListeners = () => {
  audioDeviceListeners.forEach((listener) => {
    try {
      listener(audioDeviceState);
    } catch (error) {
      // Ignore listener failures so audio routing remains usable.
    }
  });
};

const updateAudioDeviceState = ({ audioDevices = [], selectedDevice = null } = {}) => {
  audioDeviceState = {
    audioDevices,
    selectedDevice
  };
  notifyAudioDeviceListeners();
};

const notifyMuteStateListeners = () => {
  muteStateListeners.forEach((listener) => {
    try {
      listener(muteState);
    } catch (error) {
      // Ignore listener failures so mute remains usable.
    }
  });
};

const updateMuteState = (value) => {
  muteState = Boolean(value);
  notifyMuteStateListeners();
};

const handleAudioDevicesUpdated = (audioDevices = [], selectedDevice = null) => {
  updateAudioDeviceState({ audioDevices, selectedDevice });
};

const ensureAudioDeviceEventsBound = () => {
  if (audioDeviceEventsBound) {
    return;
  }

  const voice = getVoiceInstance();
  voice.addListener(Voice.Event.AudioDevicesUpdated, handleAudioDevicesUpdated);
  audioDeviceEventsBound = true;
};

const requestBluetoothAudioPermission = async () => {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) {
    return true;
  }

  const bluetoothPermission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;

  if (!bluetoothPermission) {
    return true;
  }

  const hasPermission = await PermissionsAndroid.check(bluetoothPermission);

  if (hasPermission) {
    return true;
  }

  const result = await PermissionsAndroid.request(bluetoothPermission, {
    title: 'Bluetooth access for call audio',
    message: 'Emmaline uses Bluetooth access so you can route VoIP calls to headphones or your car audio.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now'
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const ensureMicrophonePermission = async () => {
  try {
    if (Platform.OS === 'ios') {
      const permission = await Audio.requestPermissionsAsync();

      if (permission.granted) {
        return { success: true };
      }

      return {
        success: false,
        error: 'Microphone permission denied'
      };
    }

    if (Platform.OS !== 'android') {
      return { success: true };
    }

    const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

    if (hasPermission) {
      return { success: true };
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone permission required',
        message: 'Emmaline needs microphone access for in-app VoIP calls.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny'
      }
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
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

export const refreshAudioDevices = async () => {
  try {
    ensureAudioDeviceEventsBound();

    const voice = getVoiceInstance();
    const { audioDevices = [], selectedDevice = null } = await voice.getAudioDevices();

    updateAudioDeviceState({ audioDevices, selectedDevice });
    return {
      success: true,
      ...audioDeviceState
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to read audio devices',
      ...audioDeviceState
    };
  }
};

export const subscribeToAudioDevices = (listener) => {
  ensureAudioDeviceEventsBound();
  audioDeviceListeners.add(listener);
  listener(audioDeviceState);

  return () => {
    audioDeviceListeners.delete(listener);
  };
};

export const subscribeToMuteState = (listener) => {
  muteStateListeners.add(listener);
  listener(muteState);

  return () => {
    muteStateListeners.delete(listener);
  };
};

export const setCallMuted = async (nextMuted) => {
  if (!activeCall) {
    return {
      success: false,
      error: 'No active call to mute.'
    };
  }

  try {
    const isMuted = await activeCall.mute(Boolean(nextMuted));
    updateMuteState(isMuted);

    return {
      success: true,
      isMuted
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to change mute state.'
    };
  }
};

export const toggleMute = async () => {
  return setCallMuted(!muteState);
};

export const selectAudioDevice = async (deviceIdentifier) => {
  const currentState = audioDeviceState.audioDevices.length > 0
    ? { success: true, ...audioDeviceState }
    : await refreshAudioDevices();

  if (!currentState.success && currentState.audioDevices.length === 0) {
    return {
      success: false,
      error: currentState.error || 'No audio devices available'
    };
  }

  const audioDevice = currentState.audioDevices.find((device) => {
    return device.uuid === deviceIdentifier || device.type === deviceIdentifier;
  });

  if (!audioDevice) {
    return {
      success: false,
      error: 'That audio route is not available right now.'
    };
  }

  if (audioDevice.type === 'bluetooth') {
    const bluetoothPermissionGranted = await requestBluetoothAudioPermission();

    if (!bluetoothPermissionGranted) {
      return {
        success: false,
        error: 'Bluetooth permission is required only if you want to switch the call to a Bluetooth device.'
      };
    }
  }

  try {
    await audioDevice.select();
    await refreshAudioDevices();

    return {
      success: true,
      selectedDevice: audioDeviceState.selectedDevice
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to switch audio route'
    };
  }
};

export const startVoiceCall = async ({ token, params = {}, onStatusChange, onError, onTrace }) => {
  if (!token) {
    return {
      success: false,
      error: 'Voice token is required'
    };
  }

  try {
    if (activeCall) {
      return {
        success: false,
        error: 'A call is already active'
      };
    }

    const voice = getVoiceInstance();
    ensureAudioDeviceEventsBound();

    let hasResolvedConnection = false;
    let connectTimeoutId = null;

    const clearConnectTimeout = () => {
      if (connectTimeoutId) {
        clearTimeout(connectTimeoutId);
        connectTimeoutId = null;
      }
    };

    const markConnectionResolved = () => {
      hasResolvedConnection = true;
      clearConnectTimeout();
    };

    onTrace?.('voice_connect_started');
    onStatusChange?.('connecting');

    const call = await voice.connect(token, {
      contactHandle: 'Emmaline AI',
      notificationDisplayName: 'Emmaline AI',
      params
    });

    onTrace?.('voice_connect_returned');

    activeCall = call;
    updateMuteState(Boolean(call.isMuted?.() || false));
    refreshAudioDevices().catch(() => {
      // Best-effort sync for audio routes.
    });

    connectTimeoutId = setTimeout(async () => {
      if (hasResolvedConnection || activeCall !== call) {
        return;
      }

      activeCall = null;
      updateAudioDeviceState({ audioDevices: [], selectedDevice: null });
      updateMuteState(false);
      onTrace?.('voice_connect_timeout');
      onStatusChange?.('failed');

      try {
        await call.disconnect();
      } catch {
        // Ignore cleanup errors after timing out the connection attempt.
      }

      const timeoutMessage = Platform.OS === 'ios'
        ? 'The iPhone call stayed in connecting for too long. Twilio never confirmed a live connection.'
        : 'The call stayed in connecting for too long. Twilio never confirmed a live connection.';

      onError?.(timeoutMessage);
    }, CALL_CONNECT_TIMEOUT_MS);

    call.on(Call.Event.Ringing, () => {
      markConnectionResolved();
      onTrace?.('voice_event_ringing');
      onStatusChange?.('ringing');
    });

    call.on(Call.Event.Connected, () => {
      markConnectionResolved();
      onTrace?.('voice_event_connected');
      onStatusChange?.('live');
      refreshAudioDevices().catch(() => {
        // Best-effort sync for audio routes.
      });
    });

    call.on(Call.Event.Reconnecting, () => {
      onTrace?.('voice_event_reconnecting');
      onStatusChange?.('reconnecting');
    });

    call.on(Call.Event.Reconnected, () => {
      markConnectionResolved();
      onTrace?.('voice_event_reconnected');
      onStatusChange?.('live');
    });

    call.on(Call.Event.ConnectFailure, (error) => {
      markConnectionResolved();
      activeCall = null;
      updateAudioDeviceState({ audioDevices: [], selectedDevice: null });
      updateMuteState(false);
      onTrace?.('voice_event_connect_failure', {
        code: error?.code,
        message: error?.message
      });
      onStatusChange?.('failed');

      const failureMessage = [
        error?.message || 'Failed to connect call',
        error?.code ? `Code: ${error.code}` : null,
        Platform.OS === 'ios' ? 'iPhone call setup did not complete through Twilio.' : null
      ].filter(Boolean).join('\n');

      onError?.(failureMessage);
    });

    call.on(Call.Event.Disconnected, () => {
      markConnectionResolved();
      activeCall = null;
      updateAudioDeviceState({ audioDevices: [], selectedDevice: null });
      updateMuteState(false);
      onTrace?.('voice_event_disconnected');
      onStatusChange?.('ended');
    });

    return {
      success: true,
      call
    };
  } catch (error) {
    activeCall = null;
    updateAudioDeviceState({ audioDevices: [], selectedDevice: null });
    updateMuteState(false);
    onTrace?.('voice_connect_threw', {
      message: error?.message
    });
    onStatusChange?.('failed');

    return {
      success: false,
      error: error?.message || 'Unable to start in-app call'
    };
  }
};

export const endVoiceCall = async () => {
  if (!activeCall) {
    updateAudioDeviceState({ audioDevices: [], selectedDevice: null });
    updateMuteState(false);
    return {
      success: true
    };
  }

  try {
    await activeCall.disconnect();
    activeCall = null;
    updateAudioDeviceState({ audioDevices: [], selectedDevice: null });
    updateMuteState(false);

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to end call'
    };
  }
};

export const getVoiceCallActive = () => Boolean(activeCall);

export const getAudioDeviceState = () => audioDeviceState;

export const getMuteState = () => muteState;
