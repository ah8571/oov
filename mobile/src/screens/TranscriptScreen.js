import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SectionList
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCalls } from '../services/api.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';

/**
 * TranscriptScreen
 * View all call transcripts organized chronologically
 */
const BOTTOM_SAFE_ZONE = 44;

const getTranscriptModeLabel = (callRecord) => {
  const rawMode = callRecord?.callType || callRecord?.transcriptType || callRecord?.mode || callRecord?.sourceType || '';

  if (typeof rawMode === 'string' && /listen/i.test(rawMode)) {
    return 'Listen Mode';
  }

  return 'Live Call';
};

const TranscriptScreen = ({ navigation, onAppHeaderScroll }) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTranscripts = useCallback(async (options = {}) => {
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const response = await getCalls();

      if (!response.success) {
        throw new Error(response.error || 'Unable to load transcripts');
      }

      setTranscripts(response.calls || []);
    } catch (error) {
      console.error('Error loading transcripts:', error);
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadTranscripts({ silent: true });
    });

    const pollId = setInterval(() => {
      loadTranscripts({ silent: true });
    }, 4000);

    return () => {
      clearInterval(pollId);
      unsubscribeFocus();
    };
  }, [loadTranscripts, navigation]);

  useEffect(() => {
    return () => {
      onAppHeaderScroll?.(0);
    };
  }, [onAppHeaderScroll]);

  const handleListScroll = (event) => {
    const nextOffsetY = Math.max(0, event.nativeEvent.contentOffset.y || 0);
    onAppHeaderScroll?.(nextOffsetY);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  const groupedTranscripts = transcripts.reduce((groups, transcript) => {
    const dateKey = formatDate(transcript.startedAt);
    const existingGroup = groups.find(g => g.title === dateKey);

    if (existingGroup) {
      existingGroup.data.push(transcript);
    } else {
      groups.push({
        title: dateKey,
        data: [transcript]
      });
    }

    return groups;
  }, []);

  const renderTranscript = ({ item }) => (
    <TouchableOpacity
      style={[styles.transcriptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => navigation.navigate('CallDetail', { callId: item.id })}
    >
      <View style={styles.transcriptHeader}>
        <View style={styles.transcriptMetaColumn}>
          <Text style={[styles.time, { color: colors.text }]}>
            {new Date(item.startedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
          <Text style={[styles.modeLabel, { color: colors.mutedText }]}>{getTranscriptModeLabel(item)}</Text>
        </View>
        <Text style={[styles.duration, { color: colors.mutedText }]}>{item.callDurationSeconds}s</Text>
      </View>
      <Text style={[styles.preview, { color: colors.mutedText }]} numberOfLines={2}>
        {item.summary || item.fullTranscript?.substring(0, 100) || 'No transcript'}
      </Text>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: 'transparent' }]}>
      <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>{title}</Text>
    </View>
  );

  const renderListHeader = () => (
    <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Transcripts</Text>
    </View>
  );

  const bottomContentInset = Math.max(insets.bottom, BOTTOM_SAFE_ZONE);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      ) : transcripts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.text }]}>No transcripts yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.mutedText }]}>
            Make a call to see your conversation history
          </Text>
        </View>
      ) : (
        <SectionList
          sections={groupedTranscripts}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderTranscript}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomContentInset + 24 }]}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  headerBar: {
    backgroundColor: '#fff',
    paddingHorizontal: designTokens.chrome.listHeaderHorizontalPadding,
    paddingTop: designTokens.chrome.listHeaderVerticalPadding,
    paddingBottom: designTokens.chrome.listHeaderVerticalPadding,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  pageTitle: {
    fontSize: designTokens.typography.pageTitle,
    fontWeight: '700',
    color: '#212529'
  },
  loader: {
    marginTop: 50
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 0
  },
  sectionHeader: {
    paddingHorizontal: designTokens.spacing.md,
    paddingVertical: designTokens.spacing.sm,
    backgroundColor: '#f8f9fa'
  },
  sectionTitle: {
    fontSize: designTokens.typography.sectionLabel,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase'
  },
  transcriptCard: {
    backgroundColor: '#fff',
    borderRadius: designTokens.radius.sm,
    padding: designTokens.spacing.md,
    marginHorizontal: designTokens.spacing.md,
    marginBottom: designTokens.spacing.sm,
    borderWidth: 1,
    borderColor: '#dee2e6'
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  transcriptMetaColumn: {
    flexShrink: 1,
    gap: 2
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529'
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  duration: {
    fontSize: 12,
    color: '#6c757d'
  },
  preview: {
    fontSize: designTokens.typography.bodySmall,
    color: '#495057',
    lineHeight: 18
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: designTokens.spacing.xxxl
  },
  emptyText: {
    fontSize: designTokens.typography.title,
    fontWeight: '600',
    color: '#212529',
    marginBottom: designTokens.spacing.sm
  },
  emptySubtext: {
    fontSize: designTokens.typography.body,
    color: '#6c757d',
    textAlign: 'center'
  }
});

export default TranscriptScreen;
