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
          <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.2)" style={[styles.arr, styles.a1]} />
          <Ionicons name="arrow-forward" size={15} color="rgba(255,255,255,0.25)" style={[styles.arr, styles.a2]} />
          <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.3)" style={[styles.arr, styles.a3]} />
          <Ionicons name="arrow-forward" size={17} color="rgba(255,255,255,0.35)" style={[styles.arr, styles.a4]} />
          <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.4)" style={[styles.arr, styles.a5]} />
          <Ionicons name="arrow-forward" size={19} color="rgba(255,255,255,0.5)" style={[styles.arr, styles.a6]} />
          <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.55)" style={[styles.arr, styles.a7]} />
          <Ionicons name="arrow-forward" size={21} color="rgba(255,255,255,0.6)" style={[styles.arr, styles.a8]} />
          <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.65)" style={[styles.arr, styles.a9]} />
          <Ionicons name="arrow-forward" size={23} color="rgba(255,255,255,0.7)" style={[styles.arr, styles.a10]} />
          <Ionicons name="arrow-forward" size={24} color="rgba(255,255,255,0.75)" style={[styles.arr, styles.a11]} />
          <Ionicons name="caret-forward" size={28} color="#ffffff" style={styles.acaret} />
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
    paddingBottom: 120,
  },
  arrowWrap: {
    alignItems: 'center',
    marginTop: -4,
    marginLeft: 80,
  },
  arr: { transform: [{ rotate: '45deg' }], marginBottom: -12 },
  a1:  { marginLeft: 0 },
  a2:  { marginLeft: 10 },
  a3:  { marginLeft: 20 },
  a4:  { marginLeft: 30 },
  a5:  { marginLeft: 40 },
  a6:  { marginLeft: 50 },
  a7:  { marginLeft: 60 },
  a8:  { marginLeft: 70 },
  a9:  { marginLeft: 80 },
  a10: { marginLeft: 90 },
  a11: { marginLeft: 100 },
  acaret: { transform: [{ rotate: '45deg' }], marginLeft: 110 },
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
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    lineHeight: 26,
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
