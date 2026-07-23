import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteCall, deleteNote, getCalls, getNotes, getTopics } from '../services/api.js';
import { loadLocalAudioRecordings } from '../utils/localAudioStorage.js';
import NoteCard from '../components/NoteCard';
import RecordingCard from '../components/RecordingCard';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';
import { getNoteTextScalePreference, getDashboardSections, saveDashboardSections } from '../utils/secureStorage.js';
import { setOnNotesChanged } from '../services/voiceService.js';

/**
 * NotesScreen
 * Dashboard with collapsible Notes and Transcripts sections.
 */
const BOTTOM_SAFE_ZONE = 44;

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getTranscriptModeLabel = (callRecord) => {
  const rawMode = callRecord?.callMode || callRecord?.callType || callRecord?.transcriptType || '';
  if (typeof rawMode === 'string' && /listen/i.test(rawMode)) return 'Listen Mode';
  return 'Live Call';
};

const NotesScreen = ({ navigation, onAppHeaderScroll }) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [transcriptsExpanded, setTranscriptsExpanded] = useState(false);
  const [recordingsExpanded, setRecordingsExpanded] = useState(false);

  // Load saved section preferences on mount
  useEffect(() => {
    getDashboardSections().then((saved) => {
      if (saved) {
        setNotesExpanded(Boolean(saved.notes));
        setTranscriptsExpanded(Boolean(saved.transcripts));
        setRecordingsExpanded(Boolean(saved.recordings));
      }
    });
  }, []);

  // Persist section state whenever it changes
  useEffect(() => {
    saveDashboardSections({
      notes: notesExpanded,
      transcripts: transcriptsExpanded,
      recordings: recordingsExpanded
    });
  }, [notesExpanded, transcriptsExpanded, recordingsExpanded]);
  const [notes, setNotes] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [noteTextScale, setNoteTextScale] = useState(1);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);

  // Transcript state
  const [transcripts, setTranscripts] = useState([]);
  const [transcriptsLoading, setTranscriptsLoading] = useState(false);
  const [selectedTranscriptIds, setSelectedTranscriptIds] = useState([]);

  // Recordings state
  const [recordings, setRecordings] = useState([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);

  const loadNotes = useCallback(async (topicOverride = selectedTopic, options = {}) => {
    if (!options.silent) {
      setLoading(true);
    }
    try {
      const response = await getNotes(topicOverride, 100, 0);

      if (!response.success) {
        throw new Error(response.error || 'Unable to load notes');
      }

      setNotes(response.notes || []);
      setErrorMessage('');
    } catch (error) {
      console.error('Error loading notes:', error);
      setErrorMessage(error.message || 'Unable to load notes');
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [selectedTopic]);

  const loadTopics = useCallback(async () => {
    try {
      const response = await getTopics();

      if (!response.success) {
        throw new Error(response.error || 'Unable to load topics');
      }

      setTopics(response.topics || []);
    } catch (error) {
      console.error('Error loading topics:', error);
      setTopics([]);
    }
  }, []);

  useEffect(() => {
    loadNotes(selectedTopic);
  }, [loadNotes, selectedTopic]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    setOnNotesChanged(() => {
      loadNotes(selectedTopic, { silent: true });
      loadTopics();
    });

    return () => {
      setOnNotesChanged(null);
    };
  }, [loadNotes, loadTopics, selectedTopic]);

  useEffect(() => {
    const loadNoteTextScale = async () => {
      const savedScale = await getNoteTextScalePreference();
      setNoteTextScale(savedScale || 1);
    };

    loadNoteTextScale();
  }, []);

  useEffect(() => {
    return () => {
      onAppHeaderScroll?.(0);
    };
  }, [onAppHeaderScroll]);

  const handleListScroll = (event) => {
    const nextOffsetY = Math.max(0, event.nativeEvent.contentOffset.y || 0);
    onAppHeaderScroll?.(nextOffsetY);
  };

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadNotes(selectedTopic, { silent: true });
      loadTopics();
      getNoteTextScalePreference().then((savedScale) => {
        setNoteTextScale(savedScale || 1);
      });
    });

    return () => {
      unsubscribeFocus();
    };
  }, [loadNotes, loadTopics, navigation, selectedTopic]);

  useEffect(() => {
    setSelectedNoteIds((currentSelection) => currentSelection.filter((noteId) => notes.some((note) => note.id === noteId)));
  }, [notes]);

  // ── Transcripts ──
  const loadTranscripts = useCallback(async (options = {}) => {
    if (!options.silent) setTranscriptsLoading(true);
    try {
      const response = await getCalls();
      if (!response.success) throw new Error(response.error || 'Unable to load transcripts');
      setTranscripts(response.calls || []);
    } catch (error) {
      console.error('Error loading transcripts:', error);
    } finally {
      if (!options.silent) setTranscriptsLoading(false);
    }
  }, []);

  useEffect(() => { loadTranscripts(); }, [loadTranscripts]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadTranscripts({ silent: true });
    });
    return () => unsubscribeFocus();
  }, [loadTranscripts, navigation]);

  useEffect(() => {
    setSelectedTranscriptIds((current) =>
      current.filter((id) => transcripts.some((t) => t.id === id))
    );
  }, [transcripts]);

  const groupedTranscripts = transcripts.reduce((groups, transcript) => {
    const dateKey = formatDate(transcript.startedAt);
    const existing = groups.find((g) => g.title === dateKey);
    if (existing) { existing.data.push(transcript); }
    else { groups.push({ title: dateKey, data: [transcript] }); }
    return groups;
  }, []);

  const handleTranscriptPress = (transcript) => {
    if (selectedTranscriptIds.length > 0) {
      setSelectedTranscriptIds((current) =>
        current.includes(transcript.id)
          ? current.filter((id) => id !== transcript.id)
          : [...current, transcript.id]
      );
      return;
    }
    navigation.navigate('CallDetail', { callId: transcript.id });
  };

  const handleSelectTranscript = (callId) => {
    setSelectedTranscriptIds((current) =>
      current.includes(callId)
        ? current.filter((id) => id !== callId)
        : [...current, callId]
    );
  };

  const handleDeleteSelectedTranscripts = () => {
    if (selectedTranscriptIds.length === 0) return;
    Alert.alert(
      'Delete transcripts',
      `Delete ${selectedTranscriptIds.length} selected?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const results = await Promise.all(selectedTranscriptIds.map((id) => deleteCall(id)));
            if (results.some((r) => !r.success)) {
              Alert.alert('Delete failed', 'One or more transcripts could not be deleted.');
            }
            setSelectedTranscriptIds([]);
            loadTranscripts({ silent: true });
          }
        }
      ]
    );
  };

  // ── Recordings ──
  const loadRecordings = useCallback(async (options = {}) => {
    if (!options.silent) setRecordingsLoading(true);
    try {
      const entries = await loadLocalAudioRecordings();
      setRecordings(entries);
    } catch (error) {
      console.error('Error loading recordings:', error);
    } finally {
      if (!options.silent) setRecordingsLoading(false);
    }
  }, []);

  useEffect(() => { loadRecordings(); }, [loadRecordings]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadRecordings({ silent: true });
    });
    return () => unsubscribeFocus();
  }, [loadRecordings, navigation]);

  const handleCreateNote = () => {
    navigation.navigate('CreateNote');
  };

  // Group notes by topic
  const groupedNotes = topics
    .filter(topic => selectedTopic === null || topic.id === selectedTopic)
    .map(topic => ({
      title: topic.name,
      data: notes.filter(note => note.topicId === topic.id),
      topicId: topic.id
    }))
    .filter(group => group.data.length > 0 || selectedTopic === null);

  const unorganizedNotes = notes.filter(note => !note.topicId);
  if (unorganizedNotes.length > 0 && (selectedTopic === null)) {
    groupedNotes.unshift({ title: '', data: unorganizedNotes, topicId: null });
  }

  const handleEditNote = (note) => {
    if (selectedNoteIds.length > 0) {
      setSelectedNoteIds((currentSelection) => (
        currentSelection.includes(note.id)
          ? currentSelection.filter((noteId) => noteId !== note.id)
          : [...currentSelection, note.id]
      ));
      return;
    }
    navigation.navigate('CreateNote', { note });
  };

  const handleSelectNote = (noteId) => {
    setSelectedNoteIds((currentSelection) => {
      if (currentSelection.includes(noteId)) {
        return currentSelection.filter((currentNoteId) => currentNoteId !== noteId);
      }
      return [...currentSelection, noteId];
    });
  };

  const handleDeleteSelectedNotes = () => {
    if (selectedNoteIds.length === 0) return;
    Alert.alert(
      'Delete notes',
      `Delete ${selectedNoteIds.length} selected ${selectedNoteIds.length === 1 ? 'note' : 'notes'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const deletionResults = await Promise.all(selectedNoteIds.map((noteId) => deleteNote(noteId)));
            if (deletionResults.some((result) => !result.success)) {
              Alert.alert('Delete failed', 'One or more selected notes could not be deleted.');
            }
            setSelectedNoteIds([]);
            loadNotes(selectedTopic, { silent: true });
          }
        }
      ]
    );
  };

  const bottomContentInset = Math.max(insets.bottom, BOTTOM_SAFE_ZONE);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomContentInset + 24 }}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
      >
        {/* ══════ NOTES SECTION ══════ */}
        <TouchableOpacity
          style={[styles.sectionHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          onPress={() => setNotesExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderLeft}>
            <Ionicons
              name={notesExpanded ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color={colors.mutedText}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {selectedNoteIds.length > 0 ? (
              <TouchableOpacity style={styles.iconButton} onPress={handleDeleteSelectedNotes}>
                <Feather name="trash-2" size={20} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={handleCreateNote}>
                <Ionicons name="add" size={22} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {notesExpanded && (
          <View>
            {topics.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.topicScroll, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
                contentContainerStyle={styles.topicContent}
              >
                <TouchableOpacity
                  style={[
                    styles.topicTag,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    selectedTopic === null && [styles.topicTagActive, { backgroundColor: colors.accent, borderColor: colors.accent }]
                  ]}
                  onPress={() => setSelectedTopic(null)}
                >
                  <Text style={[styles.topicTagText, { color: colors.mutedText }, selectedTopic === null && styles.topicTagTextActive]}>All</Text>
                </TouchableOpacity>
                {topics.map(topic => (
                  <TouchableOpacity
                    key={topic.id}
                    style={[
                      styles.topicTag,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      selectedTopic === topic.id && [styles.topicTagActive, { backgroundColor: colors.accent, borderColor: colors.accent }]
                    ]}
                    onPress={() => setSelectedTopic(topic.id)}
                  >
                    <Text style={[styles.topicTagText, { color: colors.mutedText }, selectedTopic === topic.id && styles.topicTagTextActive]}>
                      {topic.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {groupedNotes.length === 0 ? (
              <View style={styles.emptyListState}>
                <Text style={[styles.emptyListText, { color: colors.mutedText }]}>Tap + to create your first note.</Text>
              </View>
            ) : (
              groupedNotes.map(group => (
                <View key={group.topicId || 'unorganized'}>
                  {group.title ? (
                    <View style={styles.noteSectionHeader}>
                      <Text style={[styles.noteSectionTitle, { color: colors.mutedText }]}>{group.title}</Text>
                    </View>
                  ) : null}
                  {group.data.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      noteTextScale={noteTextScale}
                      onPress={() => handleEditNote(note)}
                      onLongPress={() => handleSelectNote(note.id)}
                      isSelected={selectedNoteIds.includes(note.id)}
                      selectionMode={selectedNoteIds.length > 0}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        {/* ══════ TRANSCRIPTS SECTION ══════ */}
        <TouchableOpacity
          style={[styles.sectionHeader, styles.sectionHeaderSpaced, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          onPress={() => setTranscriptsExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderLeft}>
            <Ionicons
              name={transcriptsExpanded ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color={colors.mutedText}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Transcripts</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {selectedTranscriptIds.length > 0 && (
              <TouchableOpacity style={styles.iconButton} onPress={handleDeleteSelectedTranscripts}>
                <Feather name="trash-2" size={20} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {transcriptsExpanded && (
          <View>
            {transcriptsLoading ? (
              <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
            ) : transcripts.length === 0 ? (
              <View style={styles.emptyListState}>
                <Text style={[styles.emptyListText, { color: colors.mutedText }]}>No transcripts yet</Text>
              </View>
            ) : (
              groupedTranscripts.map(group => (
                <View key={group.title}>
                  <View style={styles.noteSectionHeader}>
                    <Text style={[styles.noteSectionTitle, { color: colors.mutedText }]}>{group.title}</Text>
                  </View>
                  {group.data.map(item => (
                    <TouchableOpacity
                      key={item.id}
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
                          <Text style={[styles.transcriptTime, { color: colors.text }]}>
                            {new Date(item.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={[styles.transcriptMode, { color: colors.mutedText }]}>{getTranscriptModeLabel(item)}</Text>
                        </View>
                        <Text style={[styles.transcriptDuration, { color: colors.mutedText }]}>{item.callDurationSeconds}s</Text>
                      </View>
                      <Text style={[styles.transcriptPreview, { color: colors.mutedText }]} numberOfLines={2}>
                        {item.summary || item.fullTranscript?.substring(0, 100) || 'No transcript'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        {/* ══════ RECORDINGS SECTION ══════ */}
        <TouchableOpacity
          style={[styles.sectionHeader, styles.sectionHeaderSpaced, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          onPress={() => setRecordingsExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderLeft}>
            <Ionicons
              name={recordingsExpanded ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color={colors.mutedText}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recordings</Text>
          </View>
        </TouchableOpacity>

        {recordingsExpanded && (
          <View>
            {recordingsLoading ? (
              <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
            ) : recordings.length === 0 ? (
              <View style={styles.emptyListState}>
                <Text style={[styles.emptyListText, { color: colors.mutedText }]}>
                  No recordings yet. Use the Reader to save audio.
                </Text>
              </View>
            ) : (
              recordings.map((entry) => (
                <RecordingCard
                  key={entry.id || entry.savedAudioId}
                  entry={entry}
                  colors={colors}
                  onRefresh={() => loadRecordings({ silent: true })}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  // ── Section headers (accordion) ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: designTokens.chrome.listHeaderHorizontalPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  sectionHeaderSpaced: { marginTop: 0, borderTopWidth: 1, borderTopColor: '#e9ecef' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  addButton: { padding: 4 },
  iconButton: { paddingHorizontal: 6, paddingVertical: 6 },
  // ── Topics ──
  topicScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  topicContent: { paddingHorizontal: designTokens.spacing.md, paddingVertical: 10 },
  topicTag: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: designTokens.radius.pill,
    backgroundColor: '#e9ecef', marginRight: designTokens.spacing.sm,
    borderWidth: 1, borderColor: '#dee2e6'
  },
  topicTagActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  topicTagText: { fontSize: designTokens.typography.label, fontWeight: '500', color: '#495057' },
  topicTagTextActive: { color: '#fff' },
  // ── Note section sub-header ──
  noteSectionHeader: {
    paddingHorizontal: designTokens.spacing.md,
    paddingVertical: designTokens.spacing.sm,
  },
  noteSectionTitle: {
    fontSize: designTokens.typography.sectionLabel,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  // ── Transcript cards ──
  transcriptCard: {
    borderRadius: designTokens.radius.sm,
    padding: designTokens.spacing.md,
    marginHorizontal: designTokens.spacing.sm,
    marginBottom: designTokens.spacing.sm,
    borderWidth: 1,
  },
  transcriptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8
  },
  transcriptMetaColumn: { flexShrink: 1, gap: 2 },
  transcriptTime: { fontSize: 14, fontWeight: '600' },
  transcriptMode: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  transcriptDuration: { fontSize: 12 },
  transcriptPreview: { fontSize: designTokens.typography.bodySmall, lineHeight: 18 },
  // ── Misc ──
  loader: { marginTop: 50 },
  emptyListState: { paddingHorizontal: designTokens.spacing.lg, paddingTop: designTokens.spacing.lg, paddingBottom: designTokens.spacing.lg },
  emptyListText: { fontSize: designTokens.typography.body, textAlign: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: designTokens.spacing.xxxl },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
});

export default NotesScreen;
