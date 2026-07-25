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

        {/* Long diagonal arrow from card corner to bottom-right */}
        <Animated.View style={[styles.arrowWrap, { transform: [{ scale: pulse }] }]}>
          <Ionicons name="chevron-forward" size={28} color="#ffffff" style={styles.arrow1} />
          <Ionicons name="chevron-forward" size={28} color="#ffffff" style={styles.arrow2} />
          <Ionicons name="chevron-forward" size={32} color="#ffffff" style={styles.arrow3} />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
    zIndex: 1000,
  },
  content: {
    alignItems: 'flex-end',
  },
  arrowWrap: {
    marginRight: -8,
    marginTop: -4,
    alignItems: 'flex-end',
  },
  arrow1: {
    transform: [{ rotate: '45deg' }],
    marginRight: 22,
    marginBottom: -10,
    opacity: 0.4,
  },
  arrow2: {
    transform: [{ rotate: '45deg' }],
    marginRight: 14,
    marginBottom: -8,
    opacity: 0.6,
  },
  arrow3: {
    transform: [{ rotate: '45deg' }],
    marginRight: 2,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
