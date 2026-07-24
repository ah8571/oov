import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  Animated
} from 'react-native';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';

/**
 * FloatingCallButton
 * Floating action button for initiating phone calls
 * Appears in the corner of the screen across all tabs
 */
const FloatingCallButton = ({
  onPress,
  statusLabel = null,
  isActiveCall = false,
  showCallControls = false,
  isMuted = false,
  audioRoutes = [],
  selectedAudioRoute = null,
  onSelectAudioRoute,
  onToggleMute,
  bottomInset = 0,
  topInset = 0,
  callActivityState = 'idle',
  voiceProvider = 'openai',
  grokTextInput = '',
  onGrokTextChange,
  onGrokSendText,
  geminiTextInput = '',
  onGeminiTextChange,
  onGeminiSendText,
  inworldTextInput = '',
  onInworldTextChange,
  onInworldSendText
}) => {
  const [scaleAnim] = React.useState(new Animated.Value(1));
  const [orbScaleAnim] = React.useState(new Animated.Value(1));
  const [orbGlowAnim] = React.useState(new Animated.Value(0.18));
  const [spinAnim] = React.useState(new Animated.Value(0));
  const [coreSwirlAnim] = React.useState(new Animated.Value(0));
  const [breathingAnim] = React.useState(new Animated.Value(1));
  const [innerSwirlAnim] = React.useState(new Animated.Value(0));
  const [isExpanded, setIsExpanded] = React.useState(true);
  const { colors, isDarkMode } = useAppTheme();
  const floatingBottom = Math.max(bottomInset, 12) + 16;
  const statusBottom = floatingBottom + 116;
  const circleIconColor = isDarkMode ? '#ffffff' : '#111111';
  const controlBackgroundColor = isDarkMode ? colors.surface : colors.surface;
  const controlSize = designTokens.chrome.menuButtonSize;
  const callIconSize = Math.round(controlSize * 0.47);
  const closeIconSize = Math.round(controlSize * 0.56);
  const overlayTop = Math.max(topInset, 14) + 6;
  const overlayBottom = floatingBottom + 24;
  const orbCoreColor = isDarkMode ? '#3b82f6' : '#3b82f6';
  const orbInnerColor = isDarkMode ? 'rgba(59, 130, 246, 0.45)' : 'rgba(59, 130, 246, 0.32)';
  const orbMidColor = isDarkMode ? 'rgba(59, 130, 246, 0.20)' : 'rgba(59, 130, 246, 0.12)';
  const orbOuterColor = isDarkMode ? 'rgba(59, 130, 246, 0.06)' : 'rgba(59, 130, 246, 0.04)';

  // Gradient colors for ethereal atmosphere effect
  const coreGradientColors = [
    'rgba(96, 165, 250, 0.9)',  // Bright blue center
    'rgba(59, 130, 246, 0.7)',   // Medium blue
    'rgba(37, 99, 235, 0.5)',   // Deep blue
    'rgba(30, 64, 175, 0.3)',   // Dark blue
    'rgba(30, 64, 175, 0)'      // Transparent edge
  ];

  const ringGradientColors = [
    'rgba(59, 130, 246, 0.4)',   // Blue with opacity
    'rgba(37, 99, 235, 0.2)',   // Fading blue
    'rgba(30, 64, 175, 0.1)',   // Subtle blue
    'rgba(30, 64, 175, 0)'      // Transparent
  ];

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg']
  });

  const coreSwirlInterpolation = coreSwirlAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg']
  });

  const innerSwirlInterpolation = innerSwirlAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['360deg', '0deg']
  });

  const breathingInterpolation = breathingAnim.interpolate({
    inputRange: [0.9, 1, 1.1],
    outputRange: [0.8, 1, 1.2]
  });

  React.useEffect(() => {
    if (showCallControls) {
      setIsExpanded(true);
    }
  }, [showCallControls]);

  React.useEffect(() => {
    if (!showCallControls || !isExpanded) {
      orbScaleAnim.stopAnimation();
      orbGlowAnim.stopAnimation();
      orbScaleAnim.setValue(1);
      orbGlowAnim.setValue(0.18);
      coreSwirlAnim.setValue(0);
      innerSwirlAnim.setValue(0);
      breathingAnim.setValue(1);
      return undefined;
    }

    const pulseTarget = callActivityState === 'speaking'
      ? 1.2
      : callActivityState === 'listening'
        ? 1.14
        : callActivityState === 'thinking'
          ? 1.1
          : 1.06;
    const glowTarget = callActivityState === 'speaking'
      ? 0.34
      : callActivityState === 'listening'
        ? 0.28
        : callActivityState === 'thinking'
          ? 0.24
          : 0.2;
    const duration = callActivityState === 'speaking' ? 620 : callActivityState === 'connecting' ? 960 : 760;

    // Breathing effect with irregular timing
    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathingAnim, { 
          toValue: 1.1, 
          duration: callActivityState === 'speaking' ? 800 : 1200, 
          useNativeDriver: true 
        }),
        Animated.timing(breathingAnim, { 
          toValue: 0.9, 
          duration: callActivityState === 'speaking' ? 600 : 1000, 
          useNativeDriver: true 
        }),
        Animated.timing(breathingAnim, { 
          toValue: 1, 
          duration: callActivityState === 'speaking' ? 400 : 800, 
          useNativeDriver: true 
        })
      ])
    );

    const orbLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScaleAnim, { toValue: pulseTarget, duration, useNativeDriver: true }),
          Animated.timing(orbGlowAnim, { toValue: glowTarget, duration, useNativeDriver: true })
        ]),
        Animated.parallel([
          Animated.timing(orbScaleAnim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(orbGlowAnim, { toValue: 0.18, duration, useNativeDriver: true })
        ])
      ])
    );

    breathingLoop.start();
    orbLoop.start();

    return () => {
      breathingLoop.stop();
      orbLoop.stop();
      orbScaleAnim.stopAnimation();
      orbGlowAnim.stopAnimation();
      breathingAnim.stopAnimation();
    };
  }, [callActivityState, isExpanded, orbGlowAnim, orbScaleAnim, showCallControls, breathingAnim]);

  React.useEffect(() => {
    if (!showCallControls || !isExpanded) {
      return undefined;
    }

    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 360,
        duration: callActivityState === 'speaking' ? 12000 : callActivityState === 'listening' ? 18000 : 28000,
        useNativeDriver: true
      })
    );

    // Core swirl animation - faster when AI is speaking
    const coreSwirlLoop = Animated.loop(
      Animated.timing(coreSwirlAnim, {
        toValue: 360,
        duration: callActivityState === 'speaking' ? 3000 : callActivityState === 'listening' ? 6000 : 8000,
        useNativeDriver: true
      })
    );

    // Inner counter-swirl for depth effect
    const innerSwirlLoop = Animated.loop(
      Animated.timing(innerSwirlAnim, {
        toValue: 360,
        duration: callActivityState === 'speaking' ? 2000 : callActivityState === 'listening' ? 4000 : 5000,
        useNativeDriver: true
      })
    );

    spinLoop.start();
    coreSwirlLoop.start();
    innerSwirlLoop.start();

    return () => {
      spinLoop.stop();
      coreSwirlLoop.stop();
      innerSwirlLoop.stop();
    };
  }, [callActivityState, isExpanded, showCallControls, spinAnim, coreSwirlAnim, innerSwirlAnim]);

  const liveCallPrompt = React.useMemo(() => {
    if (!showCallControls) {
      return null;
    }

    if (callActivityState === 'connecting') {
      return 'Initiating';
    }

    if (callActivityState === 'thinking') {
      return 'Thinking';
    }

    if (callActivityState === 'listening') {
      return 'Listening';
    }

    if (callActivityState === 'speaking') {
      return 'Speaking';
    }

    return 'Ready';
  }, [callActivityState, showCallControls]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true
    }).start();
  };

  const handlePress = () => {
    handlePressOut();
    onPress();
  };

  return (
    <>
      {showCallControls && isExpanded ? (
        <View style={[styles.liveCallOverlay, { backgroundColor: colors.backdrop }]} pointerEvents="box-none">
          <View
            style={[
              styles.liveCallCard,
              {
                top: overlayTop,
                bottom: overlayBottom,
                backgroundColor: 'transparent'
              }
            ]}
            pointerEvents="auto"
          >
            <View style={styles.liveCallCenter}>
              <Animated.View
                style={[
                  styles.orbOuterRing,
                  {
                    backgroundColor: orbOuterColor,
                    opacity: orbGlowAnim,
                    transform: [{ scale: orbScaleAnim }]
                  }
                ]}
              />
              <Animated.View
                style={[
                  styles.orbMidRing,
                  {
                    backgroundColor: orbMidColor,
                    opacity: orbGlowAnim,
                    transform: [
                      { scale: orbScaleAnim },
                      { rotate: spinInterpolation }
                    ]
                  }
                ]}
              />
              <Animated.View
                style={[
                  styles.orbInnerRing,
                  {
                    backgroundColor: orbInnerColor,
                    opacity: orbGlowAnim,
                    transform: [{ scale: Animated.add(1, Animated.divide(Animated.subtract(orbScaleAnim, 1), 2)) }]
                  }
                ]}
              />
              <Animated.View
                style={[
                  styles.orbCore,
                  {
                    backgroundColor: orbCoreColor,
                    transform: [
                      { scale: Animated.multiply(breathingInterpolation, Animated.add(1, Animated.divide(Animated.subtract(orbScaleAnim, 1), 4))) },
                      { rotate: coreSwirlInterpolation }
                    ],
                    shadowColor: '#60a5fa',
                    shadowOpacity: 0.6,
                    shadowRadius: 15,
                    shadowOffset: { width: 0, height: 0 }
                  }
                ]}
              >
                {/* Inner swirl layer for "blue air" effect */}
                <Animated.View
                  style={[
                    styles.innerSwirl,
                    {
                      transform: [{ rotate: innerSwirlInterpolation }],
                      opacity: 0.6
                    }
                  ]}
                />
                {/* Core gradient overlay */}
                <View style={[
                  styles.coreGradient,
                  {
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(96, 165, 250, 0.3)',
                    borderWidth: 1
                  }
                ]} />
              </Animated.View>

              {liveCallPrompt ? (
                <View style={styles.liveCallPromptWrap} pointerEvents="none">
                  <Text style={[styles.liveCallPromptTitle, { color: colors.text }]}>{liveCallPrompt}</Text>
                </View>
              ) : null}
            </View>

            {voiceProvider === 'grok' ? (
              <View style={styles.grokInputRow}>
                <TextInput
                  style={[styles.grokTextInput, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.mutedText}
                  value={grokTextInput}
                  onChangeText={onGrokTextChange}
                  onSubmitEditing={onGrokSendText}
                  returnKeyType="send"
                  autoCorrect
                />
                <TouchableOpacity
                  style={[styles.grokSendButton, { backgroundColor: colors.accent }]}
                  onPress={onGrokSendText}
                  activeOpacity={0.85}
                >
                  <Ionicons name="send" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : null}

            {voiceProvider === 'gemini' ? (
              <View style={styles.grokInputRow}>
                <TextInput
                  style={[styles.grokTextInput, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.mutedText}
                  value={geminiTextInput}
                  onChangeText={onGeminiTextChange}
                  onSubmitEditing={onGeminiSendText}
                  returnKeyType="send"
                  autoCorrect
                />
                <TouchableOpacity
                  style={[styles.grokSendButton, { backgroundColor: colors.accent }]}
                  onPress={onGeminiSendText}
                  activeOpacity={0.85}
                >
                  <Ionicons name="send" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : null}

            {voiceProvider === 'inworld' ? (
              <View style={styles.grokInputRow}>
                <TextInput
                  style={[styles.grokTextInput, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.mutedText}
                  value={inworldTextInput}
                  onChangeText={onInworldTextChange}
                  onSubmitEditing={onInworldSendText}
                  returnKeyType="send"
                  autoCorrect
                />
                <TouchableOpacity
                  style={[styles.grokSendButton, { backgroundColor: colors.accent }]}
                  onPress={onInworldSendText}
                  activeOpacity={0.85}
                >
                  <Ionicons name="send" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.liveCallFooter}>
              <View style={styles.muteButtonWrap}>
                <TouchableOpacity
                  style={[
                    styles.liveCallPrimaryAction,
                    { backgroundColor: isMuted ? (isDarkMode ? '#402128' : '#ffe3e3') : colors.surfaceAlt, borderColor: isMuted ? 'transparent' : colors.border }
                  ]}
                  onPress={() => onToggleMute?.()}
                  activeOpacity={0.85}
                >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={16} color={isMuted ? '#c92a2a' : colors.text} />
                </TouchableOpacity>
                {isMuted && (
                  <Text style={[styles.muteLabel, { color: '#c92a2a' }]}>Muted</Text>
                )}
              </View>

              {audioRoutes.length > 0 ? (
                <View style={styles.liveCallRouteRow}>
                  {audioRoutes.map((route) => {
                    const selected = selectedAudioRoute === route.uuid;

                    return (
                      <TouchableOpacity
                        key={route.uuid}
                        style={[
                          styles.audioRouteChip,
                          { backgroundColor: colors.surfaceAlt },
                          selected && [styles.audioRouteChipSelected, { backgroundColor: colors.chipSelectedBg }]
                        ]}
                        onPress={() => onSelectAudioRoute?.(route.uuid)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.audioRouteChipText, { color: colors.mutedText }, selected && { color: colors.chipSelectedText }]}>
                          {route.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.liveCallMinimizeButton, { top: overlayBottom + 12, backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setIsExpanded(false)}
            activeOpacity={0.82}
          >
            <Ionicons name="chevron-down" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.floatingContainer,
          { top: overlayTop },
          {
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: isActiveCall ? colors.surfaceAlt : controlBackgroundColor,
              borderColor: colors.border,
              width: controlSize,
              height: controlSize
            },
            isActiveCall && styles.buttonActive
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
        >
          {isActiveCall ? (
            <Ionicons name="close" size={closeIconSize} color={circleIconColor} style={styles.endCallIcon} />
          ) : (
            <Ionicons name="radio-outline" size={callIconSize} color={circleIconColor} style={styles.phoneIcon} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {showCallControls && !isExpanded ? (
        <TouchableOpacity
          style={[styles.expandButton, { top: overlayTop + controlSize + 16, backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setIsExpanded(true)}
          activeOpacity={0.84}
        >
          <Ionicons name="chevron-up" size={18} color={colors.text} />
          <Text style={[styles.expandButtonText, { color: colors.text }]}>{statusLabel || 'Voice Mode'}</Text>
        </TouchableOpacity>
      ) : null}

      {statusLabel && !showCallControls ? (
        <View style={[styles.statusIndicator, { top: overlayTop + controlSize + 8, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statusText, { color: colors.text }]}>{statusLabel}</Text>
        </View>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 999
  },
  button: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8
  },
  buttonActive: {
    transform: [{ scale: 1 }]
  },
  phoneIcon: {
    transform: [{ rotate: '12deg' }]
  },
  endCallIcon: {
    transform: [{ translateY: 0 }]
  },
  statusIndicator: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#007AFF',
    borderWidth: 1,
    borderColor: '#dee2e6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  liveCallOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 950,
    justifyContent: 'center'
  },
  liveCallCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22
  },
  grokInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  grokTextInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15
  },
  grokSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  liveCallMinimizeButton: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 6
  },
  liveCallCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  liveCallPromptWrap: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: [{ translateY: 102 }],
    alignItems: 'center',
    paddingHorizontal: 28
  },
  liveCallPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  orbOuterRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999
  },
  orbMidRing: {
    position: 'absolute',
    width: 178,
    height: 178,
    borderRadius: 999
  },
  orbInnerRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 999
  },
  orbCore: {
    width: 120,
    height: 120,
    borderRadius: 999,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 32,
    elevation: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  innerSwirl: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(147, 197, 253, 0.4)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent'
  },
  coreGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'transparent'
  },
  liveCallFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  liveCallPrimaryAction: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  liveCallPrimaryActionActive: {
    backgroundColor: '#ffe3e3'
  },
  liveCallPrimaryActionText: {
    fontSize: 14,
    fontWeight: '700'
  },
  muteButtonWrap: {
    alignItems: 'center',
    gap: 4,
  },
  muteLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  liveCallRouteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  expandButton: {
    position: 'absolute',
    right: 20,
    zIndex: 998,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 130
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  audioRouteCard: {
    position: 'absolute',
    right: 20,
    width: 220,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8
  },
  audioRouteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 10
  },
  callActionRow: {
    flexDirection: 'row',
    marginBottom: 12
  },
  callActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f3f5'
  },
  callActionButtonActive: {
    backgroundColor: '#ffe3e3'
  },
  callActionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057'
  },
  callActionButtonTextActive: {
    color: '#c92a2a'
  },
  audioRouteList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  audioRouteChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f3f5'
  },
  audioRouteChipSelected: {
    backgroundColor: '#d9ecff'
  },
  audioRouteChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057'
  }
});

export default FloatingCallButton;
