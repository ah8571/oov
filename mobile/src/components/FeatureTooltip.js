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
        <View style={styles.card}>
          <Text style={styles.body}>
            Start a live voice conversation or record and transcribe. oov listens and responds in real time.
          </Text>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Got it</Text>
          </TouchableOpacity>
        </View>

        {/* Chevron trail pointing diagonally down-right to the speaker button */}
        <Animated.View style={[styles.arrowWrap, { transform: [{ scale: pulse }] }]}>
          <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.25)" style={styles.arr1} />
          <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.35)" style={styles.arr2} />
          <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.45)" style={styles.arr3} />
          <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.55)" style={styles.arr4} />
          <Ionicons name="chevron-down" size={26} color="rgba(255,255,255,0.65)" style={styles.arr5} />
          <Ionicons name="caret-down" size={32} color="#ffffff" style={styles.arr6} />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    paddingBottom: 80,
  },
  arrowWrap: {
    alignItems: 'center',
    marginTop: -8,
    marginLeft: 60,
  },
  arr1: { transform: [{ rotate: '315deg' }], marginLeft: 8, marginBottom: -10 },
  arr2: { transform: [{ rotate: '315deg' }], marginLeft: 16, marginBottom: -10 },
  arr3: { transform: [{ rotate: '315deg' }], marginLeft: 24, marginBottom: -10 },
  arr4: { transform: [{ rotate: '315deg' }], marginLeft: 32, marginBottom: -10 },
  arr5: { transform: [{ rotate: '315deg' }], marginLeft: 40, marginBottom: -10 },
  arr6: { transform: [{ rotate: '315deg' }], marginLeft: 48 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    maxWidth: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  body: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  dismissButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    minWidth: 160,
  },
  dismissText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '600',
  }
});

export default FeatureTooltip;
