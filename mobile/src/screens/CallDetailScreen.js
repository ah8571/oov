import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { getCallDetail } from '../services/api.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/appTheme.js';
import FloatingBackButton from '../components/FloatingBackButton';

const getTranscriptModeLabel = (callRecord) => {
  const rawMode = callRecord?.callType || callRecord?.transcriptType || callRecord?.mode || callRecord?.sourceType || '';

  if (typeof rawMode === 'string' && /listen/i.test(rawMode)) {
    return 'Listen Mode';
  }

  return 'Live Call';
};

const CallDetailScreen = ({ route, navigation, onAppHeaderScroll, transcriptResetToken = 0 }) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { callId } = route.params;
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastTranscriptResetTokenRef = useRef(transcriptResetToken);

  async function loadCallDetail() {
    setLoading(true);
    try {
      const response = await getCallDetail(callId);

      if (!response.success) {
        throw new Error(response.error || 'Unable to load call details');
      }

      setCall(response.call);
    } catch (error) {
      console.error('Error loading call:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCallDetail();
  }, [callId]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadCallDetail();
    });

    const pollId = setInterval(() => {
      loadCallDetail();
    }, 4000);

    return () => {
      clearInterval(pollId);
      unsubscribeFocus();
    };
  }, [callId, navigation]);

  useEffect(() => {
    return () => {
      onAppHeaderScroll?.(0);
    };
  }, [onAppHeaderScroll]);

  useEffect(() => {
    if (lastTranscriptResetTokenRef.current === transcriptResetToken) {
      return;
    }

    lastTranscriptResetTokenRef.current = transcriptResetToken;

    if (navigation.canGoBack()) {
      navigation.popToTop?.();
    }
  }, [navigation, transcriptResetToken]);

  if (loading) {
    return <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />;
  }

  if (!call) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }] }>
        <Text style={[styles.errorText, { color: colors.danger }]}>Call not found</Text>
      </View>
    );
  }

  const formatUsd = (value) => {
    return `$${Number(value || 0).toFixed(4)}`;
  };

  const formatCallDateTime = (value) => {
    if (!value) {
      return 'Unavailable';
    }

    return new Date(value).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const floatingBackInset = Math.max(insets.top - 12, 0) + 30;
  const transcriptModeLabel = getTranscriptModeLabel(call);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <FloatingBackButton onPress={() => navigation.goBack()} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.contentContainer, { paddingTop: floatingBackInset }]}
        onScroll={(event) => onAppHeaderScroll?.(Math.max(0, event.nativeEvent.contentOffset.y || 0))}
        scrollEventThrottle={16}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionEyebrow, { color: colors.mutedText }]}>{transcriptModeLabel}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Date</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaValue, { color: colors.text }]}>{formatCallDateTime(call.startedAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>
          <Text style={[styles.summaryText, { color: colors.mutedText }]}>{call.summary}</Text>
        </View>

        {call.keyPoints && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Points</Text>
            {call.keyPoints.map((point, idx) => (
              <Text key={idx} style={[styles.bulletPoint, { color: colors.mutedText }]}>• {point}</Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Transcript</Text>
          {Array.isArray(call.messages) && call.messages.length > 0 ? (
            call.messages.map((message) => (
              <View key={message.id || `${message.sequenceNumber}-${message.speaker}`} style={styles.messageRow}>
                <Text style={[styles.messageSpeaker, { color: colors.text }]}>
                  {message.speaker === 'assistant' ? 'Emmaline' : message.speaker === 'system' ? 'System' : 'You'}
                </Text>
                <Text style={[styles.transcriptText, { color: colors.mutedText }]}>{message.text}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.transcriptText, { color: colors.mutedText }]}>{call.fullTranscript}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 32
  },
  loader: {
    flex: 1,
    justifyContent: 'center'
  },
  section: {
    marginBottom: 28
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12
  },
  summaryText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20
  },
  bulletPoint: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 8
  },
  metaRow: {
    marginBottom: 2
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529'
  },
  messageRow: {
    marginBottom: 14
  },
  messageSpeaker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  transcriptText: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 22,
    fontStyle: 'normal'
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 24
  }
});

export default CallDetailScreen;
