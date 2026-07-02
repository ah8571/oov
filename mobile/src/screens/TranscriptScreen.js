import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SectionList
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteCall, getCalls } from '../services/api.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';

/**
 * TranscriptScreen
 * View all call transcripts organized chronologically
 */
const BOTTOM_SAFE_ZONE = 44;

const getTranscriptModeLabel = (callRecord) => {
  const rawMode = callRecord?.callMode || callRecord?.callType || callRecord?.transcriptType || callRecord?.mode || callRecord?.sourceType || '';

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
  const [selectedTranscriptIds, setSelectedTranscriptIds] = useState([]);

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

  useEffect(() => {
    setSelectedTranscriptIds((currentSelection) => currentSelection.filter((callId) => transcripts.some((transcript) => transcript.id === callId)));
  }, [transcripts]);

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

  const handleSelectTranscript = (callId) => {
    setSelectedTranscriptIds((currentSelection) => {
      if (currentSelection.includes(callId)) {
        return currentSelection.filter((currentCallId) => currentCallId !== callId);
      }

      return [...currentSelection, callId];
    });
  };

  const handleTranscriptPress = (transcript) => {
    if (selectedTranscriptIds.length > 0) {
      handleSelectTranscript(transcript.id);
      return;
    }

    navigation.navigate('CallDetail', { callId: transcript.id });
  };

  const handleDeleteSelectedTranscripts = () => {
    if (selectedTranscriptIds.length === 0) {
      return;
    }

    Alert.alert(
      'Delete transcripts',
      `Delete ${selectedTranscriptIds.length} selected ${selectedTranscriptIds.length === 1 ? 'transcript' : 'transcripts'}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const deletionResults = await Promise.all(selectedTranscriptIds.map((callId) => deleteCall(callId)));
            const hasFailure = deletionResults.some((result) => !result.success);

            if (hasFailure) {
              Alert.alert('Delete failed', 'One or more selected transcripts could not be deleted.');
            }

            setSelectedTranscriptIds([]);
            loadTranscripts({ silent: true });
          }
        }
      ]
    );
  };

  const renderTranscript = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.transcriptCard,
        {
          backgroundColor: selectedTranscriptIds.includes(item.id) ? colors.chipSelectedBg : colors.surface,
          borderColor: selectedTranscriptIds.includes(item.id) ? colors.accent : colors.border
        }
      ]}
      onPress={() => handleTranscriptPress(item)}
      onLongPress={() => handleSelectTranscript(item.id)}
      delayLongPress={220}
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
      {selectedTranscriptIds.length > 0 ? (
        <Text style={[styles.selectionLabel, { color: selectedTranscriptIds.includes(item.id) ? colors.text : colors.mutedText }]}>
          {selectedTranscriptIds.includes(item.id) ? 'Selected' : 'Tap to select'}
        </Text>
      ) : null}
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
      <Text style={[styles.pageTitle, { color: colors.text }]}>{selectedTranscriptIds.length > 0 ? `${selectedTranscriptIds.length} selected` : 'Transcripts'}</Text>
      <View style={styles.headerActions}>
        {selectedTranscriptIds.length > 0 ? (
          <TouchableOpacity style={styles.iconButton} onPress={handleDeleteSelectedTranscripts}>
            <Feather name="trash-2" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        {selectedTranscriptIds.length > 0 ? (
          <TouchableOpacity style={styles.doneButton} onPress={() => setSelectedTranscriptIds([])}>
            <Text style={[styles.doneButtonText, { color: colors.text }]}>Done</Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: designTokens.spacing.sm
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 6
  },
  doneButton: {
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600'
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
  selectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3
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
