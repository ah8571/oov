import React, { useEffect, useState } from 'react';
import { StyleSheet, Alert, View, Image, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import AppNavigator from './navigation/AppNavigator';
import FloatingCallButton from './components/FloatingCallButton';
import { getVoiceToken, uploadListenModeRecording } from './services/api.js';
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
  getCallResponseDelayPreference,
  getCallLanguagePreference,
  getSpeechRatePreference,
  getThemeModePreference,
  saveThemeModePreference
} from './utils/secureStorage.js';
import { AppThemeProvider, darkColors, lightColors } from './theme/appTheme.js';

const APP_BOTTOM_RAIL_HEIGHT = 5;
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  sendDefaultPii: false,
  enableNativeFramesTracking: true,
  attachStacktrace: true
});

const AppContent = () => {
  const insets = useSafeAreaInsets();
  const [isCalling, setIsCalling] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const [listenModeState, setListenModeState] = useState('idle');

  const colors = isDarkMode ? darkColors : lightColors;
  const appBottomRailHeight = Math.max(insets.bottom, 12) + APP_BOTTOM_RAIL_HEIGHT;

  useEffect(() => {
    const loadThemeMode = async () => {
      const savedThemeMode = await getThemeModePreference();
      setIsDarkMode(savedThemeMode === 'dark');
    };

    loadThemeMode();
  }, []);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowLaunchSplash(false);
    }, 900);

    return () => clearTimeout(splashTimer);
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
    setListenModeState('idle');

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

  const stopLiveCall = async () => {
    const endResponse = await endVoiceCall();

    if (!endResponse.success) {
      Alert.alert('End call failed', endResponse.error || 'Unable to end call.');
      return false;
    }

    setIsCalling(false);
    setCallStatus('ended');
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

    try {
      const permissionResponse = await ensureMicrophonePermission();

      if (!permissionResponse.success) {
        setIsCalling(false);
        setCallStatus('failed');
        Alert.alert(
          'Microphone permission required',
          permissionResponse.error || 'Please allow microphone access to start an in-app call.'
        );
        return;
      }

      const tokenResponse = await getVoiceToken();
      const [callLanguage, speechRate, callResponseDelayMs] = await Promise.all([
        getCallLanguagePreference(),
        getSpeechRatePreference(),
        getCallResponseDelayPreference()
      ]);

      if (!tokenResponse.success || !tokenResponse.token) {
        setIsCalling(false);
        setCallStatus('failed');

        let errorMessage = tokenResponse.error || 'Unable to get a voice token.';

        if (tokenResponse.code === 'VOICE_PAYWALL_REQUIRED' && tokenResponse.billing) {
          errorMessage = 'You have no credits available. Upgrade to continue';
        } else if (tokenResponse.code === 'VOICE_BILLING_NOT_INITIALIZED') {
          errorMessage = 'Voice billing is not initialized on the backend yet. Run the billing entitlements migration and try again.';
        } else if (tokenResponse.code === 'VOICE_TWILIO_NOT_CONFIGURED') {
          errorMessage = 'Twilio Voice token settings are missing on the backend.';
        } else if (tokenResponse.statusCode) {
          errorMessage = `${errorMessage} (status ${tokenResponse.statusCode})`;
        }

        Alert.alert(
          'In-app call unavailable',
          errorMessage
        );
        return;
      }

      const response = await startVoiceCall({
        token: tokenResponse.token,
        params: {
          identity: tokenResponse.identity || 'unknown',
          language: callLanguage || 'en',
          speechRate: String(speechRate || 1),
          responseDelayMs: String(callResponseDelayMs || 1600)
        },
        onStatusChange: (status) => {
          setCallStatus(status);

          if (status === 'ended' || status === 'failed') {
            setIsCalling(false);
          }
        },
        onError: (message) => {
          Sentry.captureMessage(message || 'Unexpected VoIP call error.', {
            level: 'error',
            tags: {
              area: 'voice_call'
            }
          });
          Alert.alert('Call error', message || 'Unexpected VoIP call error.');
        }
      });

      if (!response.success) {
        setIsCalling(false);
        setCallStatus('failed');

        Alert.alert(
          'In-app call failed',
          response.error || 'Unable to start in-app call.'
        );
        return;
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          area: 'voice_call_start'
        }
      });
      setIsCalling(false);
      setCallStatus('failed');
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

    Alert.alert(
      'Choose audio mode',
      'Start a live call or record in Listen Mode.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Listen Mode',
          onPress: () => {
            handleStartListenMode().catch(() => {
              // Errors are surfaced inside the handler.
            });
          }
        },
        {
          text: 'Live Call',
          onPress: () => {
            startLiveCall().catch(() => {
              // Errors are surfaced inside the handler.
            });
          }
        }
      ]
    );
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
    const response = await toggleMute();

    if (!response.success) {
      Alert.alert('Mute unavailable', response.error || 'Unable to change mute state.');
    }
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

  if (showLaunchSplash) {
    return (
      <AppThemeProvider value={{ isDarkMode, colors, toggleTheme: handleToggleTheme }}>
        <View style={styles.splashScreen}>
          <Image source={require('../assets/launch-splash-icon.png')} style={styles.splashIcon} resizeMode="contain" />
          <Text style={styles.splashLabel}>Emmaline</Text>
        </View>
      </AppThemeProvider>
    );
  }

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
            statusLabel={
              listenModeState === 'recording'
                ? 'Listening... tap to stop'
                : listenModeState === 'processing'
                  ? 'Processing recording...'
                  : listenModeState === 'saved'
                    ? 'Listen Mode saved'
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
            bottomInset={appBottomRailHeight}
          />
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
  splashScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 18,
    backgroundColor: '#000000'
  },
  splashIcon: {
    width: 136,
    height: 136,
    borderRadius: 28,
    marginBottom: 20
  },
  splashLabel: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#ffffff'
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
  modePickerOptionDescription: {
    fontSize: 13,
    lineHeight: 18
  },
});
