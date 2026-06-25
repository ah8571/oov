import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
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
  isMuted = false,
  audioRoutes = [],
  selectedAudioRoute = null,
  onSelectAudioRoute,
  onToggleMute,
  bottomInset = 0
}) => {
  const [scaleAnim] = React.useState(new Animated.Value(1));
  const { colors, isDarkMode } = useAppTheme();
  const floatingBottom = Math.max(bottomInset, 12) + 16;
  const statusBottom = floatingBottom + 116;
  const audioCardBottom = floatingBottom + 80;
  const circleIconColor = isDarkMode ? '#ffffff' : '#111111';
  const controlBackgroundColor = isDarkMode ? colors.surface : colors.surface;
  const controlSize = designTokens.chrome.menuButtonSize;
  const callIconSize = Math.round(controlSize * 0.47);
  const closeIconSize = Math.round(controlSize * 0.56);

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

  const showAudioRoutes = isActiveCall && (audioRoutes.length > 0 || Boolean(onToggleMute));

  return (
    <>
      {showAudioRoutes ? (
        <View style={[styles.audioRouteCard, { bottom: audioCardBottom, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.callActionRow}>
            <TouchableOpacity
              style={[
                styles.callActionButton,
                { backgroundColor: colors.surfaceAlt },
                isMuted && [styles.callActionButtonActive, { backgroundColor: isDarkMode ? '#402128' : '#ffe3e3' }]
              ]}
              onPress={() => onToggleMute?.()}
              activeOpacity={0.85}
            >
              <Text style={[styles.callActionButtonText, { color: colors.text }, isMuted && styles.callActionButtonTextActive]}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.audioRouteTitle, { color: colors.text }]}>Audio</Text>
          <View style={styles.audioRouteList}>
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
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.floatingContainer,
          { bottom: floatingBottom },
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
            <Ionicons name="call" size={callIconSize} color={circleIconColor} style={styles.phoneIcon} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {statusLabel ? (
        <View style={[styles.statusIndicator, { bottom: statusBottom, backgroundColor: colors.surface, borderColor: colors.border }]}>
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
