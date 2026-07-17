import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Alert, View, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import AppNavigator from './navigation/AppNavigator';
import FloatingCallButton from './components/FloatingCallButton';
import { getVoiceSession, uploadListenModeRecording } from './services/api.js';
import { initializeAttribution } from './services/attributionService.js';
import { syncRevenueCatAttribution } from './services/revenueCatService.js';
import {
  isListenModeRecordingActive,
  startListenModeRecording,
  stopListenModeRecording
} from './services/listenModeService.js';
import {
  endVoiceCall,
  ensureMicrophonePermission,
  getAudioDeviceState,
  getMuteState,
  getVoiceCallActive,
  selectAudioDevice,
  startVoiceCall,
  subscribeToAudioDevices,
  subscribeToMuteState,
  toggleMute
} from './services/voiceService.js';
import {
  endGrokVoiceCall,
  getGrokCallActive,
  getGrokMuteState,
  sendGrokText,
  setGrokMuted,
  startGrokVoiceCall,
  subscribeToGrokMute,
  subscribeToGrokTranscript
} from './services/grokVoiceService.js';
import {
  endGeminiVoiceCall,
  getGeminiCallActive,
  getGeminiMuteState,
  sendGeminiText,
  setGeminiMuted,
  startGeminiVoiceCall,
  subscribeToGeminiMute,
  subscribeToGeminiTranscript
} from './services/geminiVoiceService.js';
import {
  getCallLanguagePreference,
  getCallVoicePreference,
  getVoiceProviderPreference,
  saveVoiceProviderPreference,
  getThemeModePreference,
  saveThemeModePreference
} from './utils/secureStorage.js';
import { AppThemeProvider, darkColors, lightColors } from './theme/appTheme.js';

const APP_BOTTOM_RAIL_HEIGHT = 5;
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const appConfigExtra =
  Constants.expoConfig?.extra ||
  Constants.manifest2?.extra?.expoClient?.extra ||
  Constants.manifest?.extra ||
  {};

const normalizeOptionalConfigValue = (value) => {
  if (value === null || value === undefined || typeof value === 'object') {
    return '';
  }

  const normalizedValue = String(value).trim();

  if (!normalizedValue || normalizedValue.toLowerCase() === 'null' || normalizedValue.toLowerCase() === 'undefined' || normalizedValue === '[object Object]') {
    return '';
  }

  return normalizedValue;
};

const appsFlyerDevKey = normalizeOptionalConfigValue(appConfigExtra.appsflyerDevKey);
const appsFlyerIosAppId = normalizeOptionalConfigValue(appConfigExtra.appsflyerIosAppId);
const appVariant = normalizeOptionalConfigValue(appConfigExtra.appVariant);
const isDevelopmentVariant = appVariant === 'development';

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  sendDefaultPii: false,
  enableNativeFramesTracking: true,
  attachStacktrace: true
});

const VOICE_MODE_ENABLED = true;

const AppContent = () => {
  const isLiveCallAvailable = VOICE_MODE_ENABLED && (Platform.OS === 'ios' || Platform.OS === 'android');
  const insets = useSafeAreaInsets();
  const [isCalling, setIsCalling] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callActivityState, setCallActivityState] = useState('idle');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [voiceProvider, setVoiceProvider] = useState('openai');
  const [grokTextInput, setGrokTextInput] = useState('');
  const [geminiTextInput, setGeminiTextInput] = useState('');
  const [listenModeState, setListenModeState] = useState('idle');
  const [showModePicker, setShowModePicker] = useState(false);
  const [shouldPreferSpeaker, setShouldPreferSpeaker] = useState(false);
  const hasInitializedAppsFlyerRef = useRef(false);
  const liveCallTraceRef = useRef({
    attemptId: null,
    startedAtMs: null
  });

  const colors = isDarkMode ? darkColors : lightColors;
  const appBottomRailHeight = Math.max(insets.bottom, 12) + APP_BOTTOM_RAIL_HEIGHT;

  const resetLiveCallTrace = () => {
    liveCallTraceRef.current = {
      attemptId: null,
      startedAtMs: null
    };
  };

  const ensureLiveCallTrace = (stage) => {
    if (liveCallTraceRef.current.startedAtMs) {
      return liveCallTraceRef.current;
    }

    const startedAtMs = Date.now();
    const attemptId = String(startedAtMs);

    liveCallTraceRef.current = {
      attemptId,
      startedAtMs
    };

    console.log(`[VoiceCallTiming] attempt=${attemptId} stage=${stage} elapsedMs=0`);
    return liveCallTraceRef.current;
  };

  const traceLiveCallStage = (stage, details = {}) => {
    const trace = ensureLiveCallTrace(stage);
    const elapsedMs = Math.max(0, Date.now() - trace.startedAtMs);
    const payload = Object.entries(details).reduce((result, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result[key] = value;
      }

      return result;
    }, {});
    const suffix = Object.keys(payload).length > 0 ? ` details=${JSON.stringify(payload)}` : '';

    console.log(`[VoiceCallTiming] attempt=${trace.attemptId} stage=${stage} elapsedMs=${elapsedMs}${suffix}`);
  };

  const syncCallActivityFromStage = (stage) => {
    let nextActivityState = null;

    if (
      stage === 'start_live_call_entered'
      || stage === 'voice_session_request_started'
      || stage === 'voice_session_request_finished'
      || stage === 'voice_session_request_bypassed'
      || stage === 'native_webrtc_audio_mode_configuring'
      || stage === 'native_webrtc_get_user_media_started'
      || stage === 'native_webrtc_offer_creating'
      || stage === 'native_webrtc_sdp_exchange_started'
      || stage === 'voice_provider_status_connecting'
      || stage === 'voice_provider_status_reconnecting'
    ) {
      nextActivityState = 'connecting';
    } else if (stage.includes('input_audio_buffer.speech_started')) {
      nextActivityState = 'listening';
    } else if (
      stage.includes('input_audio_buffer.speech_stopped')
      || stage.includes('input_audio_transcription.completed')
    ) {
      nextActivityState = 'thinking';
    } else if (
      stage.includes('response.audio.delta')
      || stage.includes('output_audio')
    ) {
      nextActivityState = 'speaking';
    } else if (
      stage === 'voice_provider_status_live'
      || stage.includes('response.done')
      || stage.includes('response.audio.done')
      || stage.includes('output_audio_transcript.done')
    ) {
      nextActivityState = 'idle';
    } else if (
      stage.includes('failed')
      || stage.includes('ended')
      || stage.includes('exception')
      || stage === 'call_stopped'
    ) {
      nextActivityState = 'idle';
    }

    if (nextActivityState) {
      setCallActivityState((current) => (current === nextActivityState ? current : nextActivityState));
    }
  };

  useEffect(() => {
    const loadThemeMode = async () => {
      const savedThemeMode = await getThemeModePreference();
      setIsDarkMode(savedThemeMode === 'dark');
    };

    loadThemeMode();
  }, []);

  useEffect(() => {
    if (hasInitializedAppsFlyerRef.current || isDevelopmentVariant || !appsFlyerDevKey) {
      return;
    }

    hasInitializedAppsFlyerRef.current = true;

    initializeAttribution({
      appVariant,
      appsFlyerDevKey,
      appsFlyerIosAppId,
      isDebug: __DEV__,
      onReady: (result) => {
        syncRevenueCatAttribution().catch(() => {
          // RevenueCat attribution sync is best-effort; retry on the next RevenueCat setup call.
        });

        if (__DEV__) {
          console.log('[AppsFlyer] init success', result);
        }
      },
      onError: (error) => {
        console.error('[AppsFlyer] init failed', error);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAudioDevices(({ audioDevices: nextAudioDevices, selectedDevice }) => {
      setAudioDevices(nextAudioDevices || []);
      setSelectedAudioDevice(selectedDevice || null);
    });

    const currentAudioState = getAudioDeviceState();
    setAudioDevices(currentAudioState.audioDevices || []);
    setSelectedAudioDevice(currentAudioState.selectedDevice || null);

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMuteState(setIsMuted);
    setIsMuted(getMuteState());
    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      endVoiceCall().catch(() => {
        // Best-effort cleanup on unmount.
      });
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    setIsCalling(false);
    setCallStatus('idle');
    setAudioDevices([]);
    setSelectedAudioDevice(null);
    setIsMuted(false);
    setCallActivityState('idle');
    setListenModeState('idle');
    setShowModePicker(false);
    setShouldPreferSpeaker(false);

    endVoiceCall().catch(() => {
      // Best-effort cleanup when the user logs out.
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (callStatus !== 'ended' && callStatus !== 'failed') {
      return undefined;
    }

    const statusTimer = setTimeout(() => {
      setCallStatus('idle');
    }, 2200);

    return () => clearTimeout(statusTimer);
  }, [callStatus]);

  useEffect(() => {
    if (listenModeState !== 'saved' && listenModeState !== 'failed') {
      return undefined;
    }

    const statusTimer = setTimeout(() => {
      setListenModeState('idle');
    }, 2200);

    return () => clearTimeout(statusTimer);
  }, [listenModeState]);

  useEffect(() => {
    if (!shouldPreferSpeaker || !isCalling) {
      return;
    }

    if (!Array.isArray(audioDevices) || audioDevices.length === 0) {
      return;
    }

    if (selectedAudioDevice?.type === 'speaker') {
      setShouldPreferSpeaker(false);
      return;
    }

    const speakerDevice = audioDevices.find((device) => device?.type === 'speaker');

    if (!speakerDevice) {
      return;
    }

    selectAudioDevice(speakerDevice.uuid)
      .then((response) => {
        if (response?.success) {
          setShouldPreferSpeaker(false);
        }
      })
      .catch(() => {
        // Keep the preference flag set so the next audio-device refresh can retry speaker routing.
      });
  }, [audioDevices, isCalling, selectedAudioDevice, shouldPreferSpeaker]);

  const stopLiveCall = async () => {
    const endFn = voiceProvider === 'grok' ? endGrokVoiceCall : voiceProvider === 'gemini' ? endGeminiVoiceCall : endVoiceCall;
    const endResponse = await endFn();

    if (!endResponse.success) {
      Alert.alert('End call failed', endResponse.error || 'Unable to end call.');
      return false;
    }

    setIsCalling(false);
    setCallStatus('ended');
    setCallActivityState('idle');
    setShouldPreferSpeaker(false);
    traceLiveCallStage('call_stopped');
    resetLiveCallTrace();
    return true;
  };

  const startLiveCall = async () => {
    if (isCalling) {
      return;
    }

    if (getVoiceCallActive()) {
      await stopLiveCall();
      return;
    }

    setIsCalling(true);
    setCallStatus('connecting');
    setCallActivityState('connecting');
    setShouldPreferSpeaker(true);
    traceLiveCallStage('start_live_call_entered');

    try {
      traceLiveCallStage('microphone_permission_requested');
      const permissionResponse = await ensureMicrophonePermission();

      traceLiveCallStage('microphone_permission_resolved', {
        success: permissionResponse.success,
        error: permissionResponse.success ? null : permissionResponse.error
      });

      if (!permissionResponse.success) {
        setIsCalling(false);
        setCallStatus('failed');
        setCallActivityState('idle');
        setShouldPreferSpeaker(false);
        traceLiveCallStage('microphone_permission_failed');
        Alert.alert(
          'Microphone permission required',
          permissionResponse.error || 'Please allow microphone access to start an in-app call.'
        );
        return;
      }

      const [callLanguage, callVoice, storedProvider] = await Promise.all([
        getCallLanguagePreference(),
        getCallVoicePreference(),
        getVoiceProviderPreference()
      ]);

      setVoiceProvider(storedProvider);

      traceLiveCallStage('voice_preferences_loaded', {
        callLanguage: callLanguage || 'en',
        callVoice: callVoice || 'marin',
        voiceProvider: storedProvider
      });

      const isGrok = storedProvider === 'grok';
      const isGemini = storedProvider === 'gemini';
      let voiceSessionResponse = {
        success: true,
        session: null,
        provider: null,
        code: null,
        statusCode: null
      };

      if (isGrok) {
        traceLiveCallStage('voice_session_request_bypassed', {
          provider: 'grok'
        });
      } else if (isGemini) {
        traceLiveCallStage('voice_session_request_bypassed', {
          provider: 'gemini'
        });
      } else {
        traceLiveCallStage('voice_session_request_started');
        voiceSessionResponse = await getVoiceSession();
        traceLiveCallStage('voice_session_request_finished', {
          success: voiceSessionResponse.success,
          provider: voiceSessionResponse.provider,
          code: voiceSessionResponse.code,
          statusCode: voiceSessionResponse.statusCode
        });
      }

      const canProceedWithoutBootstrapSession = voiceSessionResponse.code === 'VOICE_OPENAI_SESSION_FAILED';

      if (!isGrok && !isGemini && (!voiceSessionResponse.success || !voiceSessionResponse.session) && !canProceedWithoutBootstrapSession) {
        setIsCalling(false);
        setCallStatus('failed');
        setCallActivityState('idle');
        setShouldPreferSpeaker(false);
        traceLiveCallStage('voice_session_request_failed', {
          code: voiceSessionResponse.code,
          statusCode: voiceSessionResponse.statusCode
        });

        let errorMessage = voiceSessionResponse.error || 'Unable to start voice mode.';

        if (voiceSessionResponse.code === 'VOICE_PAYWALL_REQUIRED' && voiceSessionResponse.billing) {
          errorMessage = 'You have no credits available. Upgrade to continue';
        } else if (voiceSessionResponse.code === 'VOICE_BILLING_NOT_INITIALIZED') {
          errorMessage = 'Voice billing is not initialized on the backend yet. Run the billing entitlements migration and try again.';
        } else if (voiceSessionResponse.code === 'VOICE_TWILIO_NOT_CONFIGURED' || voiceSessionResponse.code === 'VOICE_OPENAI_NOT_CONFIGURED') {
          errorMessage = 'Voice provider token settings are missing on the backend.';
        } else if (voiceSessionResponse.code === 'VOICE_OPENAI_SESSION_FAILED') {
          errorMessage = 'The backend could not open an OpenAI realtime voice session.';
        } else if (voiceSessionResponse.code === 'VOICE_OPENAI_CALL_FAILED') {
          errorMessage = voiceSessionResponse.error || 'The backend could not open an OpenAI realtime voice call.';
        } else if (voiceSessionResponse.statusCode) {
          errorMessage = `${errorMessage} (status ${voiceSessionResponse.statusCode})`;
        }

        Alert.alert(
          'In-app call unavailable',
          errorMessage
        );
        return;
      }

      if (!isGrok && !isGemini && canProceedWithoutBootstrapSession) {
        traceLiveCallStage('voice_session_request_bypassed', {
          code: voiceSessionResponse.code,
          statusCode: voiceSessionResponse.statusCode
        });
      }

      if (isGemini) {
        // Gemini Live WebSocket voice mode
        const geminiResponse = await startGeminiVoiceCall({
          voiceConfig: { voiceName: callVoice || 'Puck' },
          language: callLanguage || 'en',
          onStatusChange: (status) => {
            traceLiveCallStage(`gemini_provider_status_${status}`);
            syncCallActivityFromStage(`voice_provider_status_${status}`);
            setCallStatus(status);

            if (status === 'live') {
              setIsCalling(true);
              return;
            }

            if (status === 'ended' || status === 'failed') {
              setIsCalling(false);
              setCallActivityState('idle');
              setShouldPreferSpeaker(false);
              resetLiveCallTrace();
            }
          },
          onTrace: (stage, details) => {
            traceLiveCallStage(stage, details);
            syncCallActivityFromStage(stage);
          }
        });

        if (!geminiResponse.success) {
          setIsCalling(false);
          setCallStatus('failed');
          setCallActivityState('idle');
          setShouldPreferSpeaker(false);
          resetLiveCallTrace();
          Alert.alert('Gemini call failed', geminiResponse.error || 'Unable to start Gemini voice mode.');
        }
        return;
      }

      if (isGrok) {
        // Grok WebSocket voice mode
        const grokResponse = await startGrokVoiceCall({
          voice: callVoice || 'eve',
          language: callLanguage || 'en',
          onStatusChange: (status) => {
            traceLiveCallStage(`grok_provider_status_${status}`);
            syncCallActivityFromStage(`voice_provider_status_${status}`);
            setCallStatus(status);

            if (status === 'live') {
              setIsCalling(true);
              return;
            }

            if (status === 'ended' || status === 'failed') {
              setIsCalling(false);
              setCallActivityState('idle');
              setShouldPreferSpeaker(false);
              resetLiveCallTrace();
            }
          },
          onTrace: (stage, details) => {
            traceLiveCallStage(stage, details);
            syncCallActivityFromStage(stage);
          }
        });

        if (!grokResponse.success) {
          setIsCalling(false);
          setCallStatus('failed');
          setCallActivityState('idle');
          setShouldPreferSpeaker(false);
          resetLiveCallTrace();
          Alert.alert('Grok call failed', grokResponse.error || 'Unable to start Grok voice mode.');
        }
        return;
      }

      const response = await startVoiceCall({
        session: voiceSessionResponse.session || null,
        params: {
          identity: voiceSessionResponse.identity || 'unknown',
          language: callLanguage || 'en',
          voice: callVoice || 'marin'
        },
        onStatusChange: (status) => {
          traceLiveCallStage(`voice_provider_status_${status}`);
          syncCallActivityFromStage(`voice_provider_status_${status}`);
          setCallStatus(status);

          if (status === 'live') {
            setIsCalling(true);
            return;
          }

          if (status === 'ended' || status === 'failed') {
            setIsCalling(false);
            setCallActivityState('idle');
            setShouldPreferSpeaker(false);
            resetLiveCallTrace();
          }
        },
        onError: (message) => {
          traceLiveCallStage('voice_provider_error', {
            message
          });
          Sentry.captureMessage(message || 'Unexpected VoIP call error.', {
            level: 'error',
            tags: {
              area: 'voice_call'
            }
          });
          Alert.alert('Call error', message || 'Unexpected VoIP call error.');
        },
        onTrace: (stage, details) => {
          traceLiveCallStage(stage, details);
          syncCallActivityFromStage(stage);
        }
      });

      if (!response.success) {
        setIsCalling(false);
        setCallStatus('failed');
        setCallActivityState('idle');
        setShouldPreferSpeaker(false);
        traceLiveCallStage('start_voice_call_failed', {
          error: response.error
        });
        resetLiveCallTrace();

        Alert.alert(
          'In-app call failed',
          response.error || 'Unable to start in-app call.'
        );
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          area: 'voice_call_start'
        }
      });
      traceLiveCallStage('start_live_call_exception', {
        message: error.message
      });
      setIsCalling(false);
      setCallStatus('failed');
      setCallActivityState('idle');
      setShouldPreferSpeaker(false);
      resetLiveCallTrace();
      Alert.alert('Call error', error.message || 'Unexpected error while starting the call.');
    }
  };

  const handleInitiateCall = async () => {
    if (getVoiceCallActive() || isCalling || ['connecting', 'ringing', 'live', 'reconnecting'].includes(callStatus)) {
      await stopLiveCall();
      return;
    }

    if (isListenModeRecordingActive()) {
      await handleStopListenMode();
      return;
    }

    if (listenModeState === 'processing') {
      Alert.alert('Listen Mode', 'Your recording is still uploading and being summarized.');
      return;
    }

    setShowModePicker(true);
  };

  const handleDismissModePicker = () => {
    setShowModePicker(false);
  };

  const handleChooseListenMode = () => {
    setShowModePicker(false);
    handleStartListenMode().catch(() => {
      // Errors are surfaced inside the handler.
    });
  };

  const handleChooseLiveCall = () => {
    setShowModePicker(false);
    liveCallTraceRef.current = {
      attemptId: String(Date.now()),
      startedAtMs: Date.now()
    };
    traceLiveCallStage('live_call_option_tapped');
    startLiveCall().catch(() => {
      // Errors are surfaced inside the handler.
    });
  };

  const handleStartListenMode = async () => {
    setListenModeState('idle');
    const response = await startListenModeRecording();

    if (!response.success) {
      setListenModeState('failed');
      Alert.alert('Listen Mode unavailable', response.error || 'Unable to start Listen Mode recording.');
      return;
    }

    setListenModeState('recording');
  };

  const handleStopListenMode = async () => {
    setListenModeState('processing');

    try {
      const stopResponse = await stopListenModeRecording();

      if (!stopResponse.success || !stopResponse.recording) {
        throw new Error(stopResponse.error || 'Unable to stop Listen Mode recording.');
      }

      const languagePreference = await getCallLanguagePreference();
      const uploadResponse = await uploadListenModeRecording(stopResponse.recording, languagePreference || 'en');

      if (!uploadResponse.success) {
        throw new Error(uploadResponse.error || 'Unable to process Listen Mode recording.');
      }

      setListenModeState('saved');
      Alert.alert('Listen Mode saved', 'Your recording was transcribed and added to Transcripts.');
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          area: 'listen_mode_upload'
        }
      });
      setListenModeState('failed');
      Alert.alert('Listen Mode failed', error.message || 'Unable to finish Listen Mode right now.');
    }
  };

  const handleSelectAudioRoute = async (deviceUuid) => {
    const response = await selectAudioDevice(deviceUuid);

    if (!response.success) {
      Alert.alert('Audio route unavailable', response.error || 'Unable to switch the call audio route.');
    }
  };

  const handleToggleMute = async () => {
    if (voiceProvider === 'grok') {
      setGrokMuted(!getGrokMuteState());
      return;
    }

    if (voiceProvider === 'gemini') {
      setGeminiMuted(!getGeminiMuteState());
      return;
    }

    const response = await toggleMute();

    if (!response.success) {
      Alert.alert('Mute unavailable', response.error || 'Unable to change mute state.');
    }
  };

  const handleGrokSendText = () => {
    const text = grokTextInput.trim();
    if (!text || !getGrokCallActive()) return;

    sendGrokText(text);
    setGrokTextInput('');
  };

  const handleGeminiSendText = () => {
    const text = geminiTextInput.trim();
    if (!text || !getGeminiCallActive()) return;

    sendGeminiText(text);
    setGeminiTextInput('');
  };

  const handleEndCall = async () => {
    if (voiceProvider === 'grok') {
      await endGrokVoiceCall();
    } else if (voiceProvider === 'gemini') {
      await endGeminiVoiceCall();
    } else {
      await endVoiceCall();
    }

    setIsCalling(false);
    setCallStatus('idle');
    setCallActivityState('idle');
    setAudioDevices([]);
    setSelectedAudioDevice(null);
    setIsMuted(false);
    setShouldPreferSpeaker(false);
  };

  const handleToggleTheme = async () => {
    const nextIsDarkMode = !isDarkMode;
    setIsDarkMode(nextIsDarkMode);
    await saveThemeModePreference(nextIsDarkMode ? 'dark' : 'light');
  };

  const audioRouteOptions = audioDevices
    .map((device) => ({
      uuid: device.uuid,
      type: device.type,
      label:
        device.type === 'earpiece'
          ? 'Phone'
          : device.type === 'speaker'
            ? 'Speaker'
            : device.type === 'bluetooth'
              ? 'Bluetooth'
              : device.name
    }))
    .sort((left, right) => {
      const order = {
        earpiece: 0,
        speaker: 1,
        bluetooth: 2
      };

      return (order[left.type] ?? 99) - (order[right.type] ?? 99);
    });

  return (
    <AppThemeProvider value={{ isDarkMode, colors, toggleTheme: handleToggleTheme }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.navigatorContainer}>
          <AppNavigator onAuthStateChange={setIsAuthenticated} />
        </View>

        <View
          style={[
            styles.bottomRail,
            {
              height: appBottomRailHeight,
              backgroundColor: colors.surface,
              borderTopColor: colors.border
            }
          ]}
        />

        {isAuthenticated ? (
          <FloatingCallButton
            onPress={handleInitiateCall}
            isActiveCall={isCalling || listenModeState === 'recording' || listenModeState === 'processing'}
            showCallControls={isCalling}
            statusLabel={
              listenModeState === 'recording'
                ? 'Listening'
                : listenModeState === 'processing'
                  ? 'Processing recording...'
                  : listenModeState === 'saved'
                    ? 'Transcript complete'
                    : listenModeState === 'failed'
                      ? 'Listen Mode failed'
                      : callStatus === 'idle'
                        ? null
                        : callStatus === 'connecting'
                          ? 'Connecting...'
                          : callStatus === 'ringing'
                            ? 'Ringing...'
                            : callStatus === 'live'
                              ? 'Live'
                              : callStatus === 'reconnecting'
                                ? 'Reconnecting...'
                                : callStatus === 'ended'
                                  ? 'Call ended'
                                  : 'Call failed'
            }
            audioRoutes={audioRouteOptions}
            selectedAudioRoute={selectedAudioDevice?.uuid || null}
            onSelectAudioRoute={handleSelectAudioRoute}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            callActivityState={callActivityState}
            voiceProvider={voiceProvider}
            grokTextInput={grokTextInput}
            onGrokTextChange={setGrokTextInput}
            onGrokSendText={handleGrokSendText}
            geminiTextInput={geminiTextInput}
            onGeminiTextChange={setGeminiTextInput}
            onGeminiSendText={handleGeminiSendText}
            bottomInset={appBottomRailHeight}
            topInset={insets.top}
          />
        ) : null}

        {showModePicker ? (
          <View style={styles.modePickerOverlay} pointerEvents="box-none">
            <TouchableOpacity style={styles.modePickerBackdrop} activeOpacity={1} onPress={handleDismissModePicker} />
            <View
              style={[
                styles.modePickerCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[styles.modePickerTitle, { color: colors.text }]}>Choose audio mode</Text>
              <Text style={[styles.modePickerSubtitle, { color: colors.mutedText }]}>
                {isLiveCallAvailable
                  ? 'Start Voice Mode or record in Listen Mode.'
                  : 'Record in Listen Mode.'}
              </Text>

              {isLiveCallAvailable ? (
                <>
                  <TouchableOpacity
                    style={[styles.modePickerOption, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    onPress={handleChooseLiveCall}
                    activeOpacity={0.85}
                  >
                    <View style={styles.modePickerOptionHeader}>
                      <Text style={[styles.modePickerOptionTitle, { color: colors.text }]}>Voice Mode</Text>
                    </View>
                    <Text style={[styles.modePickerOptionDescription, { color: colors.mutedText }]}>Talk to Emmaline live in a full-screen voice conversation. Saved transcripts are currently available in Listen Mode.</Text>
                  </TouchableOpacity>

                  <View style={[styles.providerToggleRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.providerToggleLabel, { color: colors.mutedText }]}>AI Provider</Text>
                    <View style={styles.providerToggleButtons}>
                      <TouchableOpacity
                        style={[styles.providerChip, voiceProvider === 'openai' && { backgroundColor: colors.chipSelectedBg }]}
                        onPress={() => {
                          setVoiceProvider('openai');
                          saveVoiceProviderPreference('openai');
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.providerChipText, { color: voiceProvider === 'openai' ? colors.chipSelectedText : colors.mutedText }]}>OpenAI</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.providerChip, voiceProvider === 'grok' && { backgroundColor: colors.chipSelectedBg }]}
                        onPress={() => {
                          setVoiceProvider('grok');
                          saveVoiceProviderPreference('grok');
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.providerChipText, { color: voiceProvider === 'grok' ? colors.chipSelectedText : colors.mutedText }]}>Grok</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.providerChip, voiceProvider === 'gemini' && { backgroundColor: colors.chipSelectedBg }]}
                        onPress={() => {
                          setVoiceProvider('gemini');
                          saveVoiceProviderPreference('gemini');
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.providerChipText, { color: voiceProvider === 'gemini' ? colors.chipSelectedText : colors.mutedText }]}>Gemini</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : null}

              <TouchableOpacity
                style={[styles.modePickerOption, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                onPress={handleChooseListenMode}
                activeOpacity={0.85}
              >
                <View style={styles.modePickerOptionHeader}>
                  <Text style={[styles.modePickerOptionTitle, { color: colors.text }]}>Listen Mode</Text>
                </View>
                <Text style={[styles.modePickerOptionDescription, { color: colors.mutedText }]}>Record first, then upload the session for transcription and summary.</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modePickerCancelButton} onPress={handleDismissModePicker} activeOpacity={0.8}>
                <Text style={[styles.modePickerCancelText, { color: colors.mutedText }]}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

      </View>
    </AppThemeProvider>
  );
};

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  navigatorContainer: {
    flex: 1,
    overflow: 'hidden'
  },
  bottomRail: {
    borderTopWidth: 1
  },
  modePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1200
  },
  modePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)'
  },
  modePickerCard: {
    marginHorizontal: 16,
    marginBottom: 96,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12
  },
  modePickerTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  modePickerSubtitle: {
    fontSize: 13,
    lineHeight: 18
  },
  modePickerOption: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6
  },
  modePickerOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10
  },
  modePickerOptionTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  modePickerOptionHint: {
    fontSize: 12,
    fontWeight: '600'
  },
  modePickerOptionDescription: {
    fontSize: 13,
    lineHeight: 18
  },
  providerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4
  },
  providerToggleLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  providerToggleButtons: {
    flexDirection: 'row',
    gap: 8
  },
  providerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  providerChipText: {
    fontSize: 13,
    fontWeight: '600'
  },
  modePickerCancelButton: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2
  },
  modePickerCancelText: {
    fontSize: 13,
    fontWeight: '600'
  },
});
