import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SectionList
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteNote, getNotes, getTopics } from '../services/api.js';
import NoteCard from '../components/NoteCard';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';
import { getNoteTextScalePreference } from '../utils/secureStorage.js';

/**
 * NotesScreen
 * View notes organized by topic with ability to create new notes
 */
const BOTTOM_SAFE_ZONE = 44;

const NotesScreen = ({ navigation, onAppHeaderScroll }) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [noteTextScale, setNoteTextScale] = useState(1);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);

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

  // Add "Unorganized" section if there are notes without a topic
  const unorganizedNotes = notes.filter(note => !note.topicId);
  if (unorganizedNotes.length > 0 && (selectedTopic === null)) {
    groupedNotes.unshift({
      title: '',
      data: unorganizedNotes,
      topicId: null
    });
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
    if (selectedNoteIds.length === 0) {
      return;
    }

    Alert.alert(
      'Delete notes',
      `Delete ${selectedNoteIds.length} selected ${selectedNoteIds.length === 1 ? 'note' : 'notes'}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const deletionResults = await Promise.all(selectedNoteIds.map((noteId) => deleteNote(noteId)));
            const hasFailure = deletionResults.some((result) => !result.success);

            if (hasFailure) {
              Alert.alert('Delete failed', 'One or more selected notes could not be deleted.');
            }

            setSelectedNoteIds([]);
            loadNotes(selectedTopic, { silent: true });
          }
        }
      ]
    );
  };

  const renderNote = ({ item }) => (
    <NoteCard
      note={item}
      noteTextScale={noteTextScale}
      onPress={() => handleEditNote(item)}
      onLongPress={() => handleSelectNote(item.id)}
      isSelected={selectedNoteIds.includes(item.id)}
      selectionMode={selectedNoteIds.length > 0}
    />
  );

  const renderSectionHeader = ({ section: { title } }) => (
    !title ? null : (
    <View style={[styles.sectionHeader, { backgroundColor: 'transparent' }]}>
      <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>{title}</Text>
    </View>
    )
  );

  const renderListHeader = () => (
    <>
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>{selectedNoteIds.length > 0 ? `${selectedNoteIds.length} selected` : 'Notes'}</Text>
        <View style={styles.headerActions}>
          {selectedNoteIds.length > 0 ? (
            <TouchableOpacity style={styles.iconButton} onPress={handleDeleteSelectedNotes}>
              <Feather name="trash-2" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.createButton}
            onPress={selectedNoteIds.length > 0 ? () => setSelectedNoteIds([]) : handleCreateNote}
          >
            <Text style={[styles.createButtonText, { color: colors.text }]}>{selectedNoteIds.length > 0 ? 'Done' : '+'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {topics.length > 0 ? (
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
            <Text
              style={[
                styles.topicTagText,
                { color: colors.mutedText },
                selectedTopic === null && styles.topicTagTextActive
              ]}
            >
              All
            </Text>
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
              <Text
                style={[
                  styles.topicTagText,
                  { color: colors.mutedText },
                  selectedTopic === topic.id && styles.topicTagTextActive
                ]}
              >
                {topic.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.listHeaderSpacer} />
    </>
  );

  const bottomContentInset = Math.max(insets.bottom, BOTTOM_SAFE_ZONE);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      ) : errorMessage ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Unable to load notes</Text>
          <Text style={[styles.emptySubtext, { color: colors.mutedText }]}>{errorMessage}</Text>
        </View>
      ) : notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>No notes yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.mutedText }]}>
            Create a note or extract from a call
          </Text>
        </View>
      ) : (
        <SectionList
          sections={groupedNotes}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderNote}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={[styles.notesList, { paddingBottom: bottomContentInset + 24 }]}
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
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pageTitle: {
    fontSize: designTokens.typography.pageTitle,
    fontWeight: '700',
    color: '#212529'
  },
  createButton: {
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconButton: {
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  createButtonText: {
    fontSize: 36,
    color: '#111111',
    fontWeight: '300',
    lineHeight: 36
  },
  topicScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  topicContent: {
    paddingHorizontal: designTokens.spacing.md,
    paddingVertical: 10
  },
  topicTag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: designTokens.radius.pill,
    backgroundColor: '#e9ecef',
    marginRight: designTokens.spacing.sm,
    borderWidth: 1,
    borderColor: '#dee2e6'
  },
  topicTagActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF'
  },
  topicTagText: {
    fontSize: designTokens.typography.label,
    fontWeight: '500',
    color: '#495057'
  },
  topicTagTextActive: {
    color: '#fff'
  },
  loader: {
    marginTop: 50
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: designTokens.spacing.xxxl
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center'
  },
  notesList: {
    paddingHorizontal: 10,
    paddingTop: 10
  },
  listHeaderSpacer: {
    height: 6
  }
});

export default NotesScreen;
