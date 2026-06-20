import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../theme/appTheme.js';
import { stripNoteContentToPlainText } from '../utils/noteContent.js';

/**
 * NoteCard component
 * Displays a note preview
 */
const NoteCard = ({ note, onPress, noteTextScale = 1 }) => {
  const { colors } = useAppTheme();
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const previewText = stripNoteContentToPlainText(note.content || '');

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text, fontSize: 14 * noteTextScale }]}>{note.title}</Text>
        <Text style={[styles.cardDate, { color: colors.mutedText, fontSize: 11.5 * noteTextScale }]}>{formatDate(note.updatedAt || note.createdAt)}</Text>
      </View>
      
      <Text style={[styles.cardContent, { color: colors.mutedText, fontSize: 13 * noteTextScale, lineHeight: 18 * noteTextScale }]} numberOfLines={2}>
        {previewText}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#dee2e6'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 19,
    paddingRight: 8
  },
  cardDate: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 6,
    marginTop: 1,
    flexShrink: 0
  },
  cardContent: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18
  }
});

export default NoteCard;
