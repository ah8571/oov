import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Notes & Reader',
    description: 'Free features — create and organize notes anytime. Tap the ☰ menu to find your notes, then listen to them read back with natural voice.',
  },
  {
    title: 'Transcriptions & Natural Voice Reader',
    description: 'Tap the 🔊, then Listen mode to generate transcriptions of your audio. Use the Reader option from the ☰ menu to listen to text with natural voices.',
  },
  {
    title: 'Voice Mode',
    description: 'Have real-time conversations with oov in 8 languages. Switch your speaking language anytime in ☰ → Settings.',
  },
];

const Squiggle = () => (
  <View style={styles.squiggleWrap}>
    <Text style={styles.squiggleChar}>~</Text>
    <Text style={[styles.squiggleChar, styles.squiggleShift]}>~</Text>
    <Text style={styles.squiggleChar}>~</Text>
    <View style={styles.squiggleArrow} />
  </View>
);

const OnboardingScreen = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const onNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      onComplete?.();
    }
  };

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        {/* Persistent header bar with menu + speaker callouts */}
        <View style={styles.headerBar}>
          <View style={styles.headerIconSlot}>
            <Ionicons name="menu" size={28} color="#ffffff" />
            <Squiggle />
          </View>
          <Text style={styles.headerTitle}>oov</Text>
          <View style={styles.headerIconSlot}>
            <Ionicons name="volume-high" size={28} color="#ffffff" />
            <Squiggle />
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          keyExtractor={(_, i) => String(i)}
        />

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>

        {/* Bottom */}
        <View style={styles.bottom}>
          {currentIndex < SLIDES.length - 1 ? (
            <TouchableOpacity onPress={() => onComplete?.()} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
          <TouchableOpacity onPress={onNext} style={styles.nextButton}>
            <Text style={styles.nextText}>
              {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a',
    zIndex: 9999,
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // ── Persistent header bar ──
  headerBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 0,
  },
  headerIconSlot: {
    alignItems: 'center',
    width: 60,
  },
  headerTitle: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 4,
  },
  // ── Squiggle annotation line ──
  squiggleWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  squiggleChar: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 14,
    lineHeight: 12,
    fontFamily: 'monospace',
  },
  squiggleShift: {
    marginLeft: 6,
  },
  squiggleArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.25)',
    marginTop: 2,
  },
  // ── Slides ──
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 120,
  },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 24,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  nextButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  nextText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingScreen;
