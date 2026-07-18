import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const FeatureTooltip = ({ visible, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      // Pulsing arrow
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true })
        ])
      ).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
      <Animated.View style={[styles.content, { opacity }]}>
        {/* Arrow pointing down-right to the FAB */}
        <Animated.View style={[styles.arrowWrap, { transform: [{ scale: pulse }] }]}>
          <Ionicons name="arrow-down" size={48} color="#ffffff" style={styles.arrow} />
        </Animated.View>

        <View style={styles.card}>
          <Text style={styles.title}>Start here</Text>
          <Text style={styles.body}>
            Tap the microphone button to start a live voice conversation or record your thoughts. Ali listens and responds in real time.
          </Text>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 90,
    paddingRight: 20,
    zIndex: 1000
  },
  content: {
    alignItems: 'flex-end'
  },
  arrowWrap: {
    marginRight: 28,
    marginBottom: -4
  },
  arrow: {
    transform: [{ rotate: '315deg' }]
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  body: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16
  },
  dismissButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  dismissText: {
    color: '#0a0a0a',
    fontSize: 14,
    fontWeight: '600'
  }
});

export default FeatureTooltip;
