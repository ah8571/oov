import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import useAudioPlayer from '../hooks/useAudioPlayer';
import { deleteLocalAudioFile, loadLocalAudioRecordings, persistLocalAudioRecordings, renameLocalAudioFile } from '../utils/localAudioStorage';
import { deleteSavedReaderAudio, updateSavedReaderAudio } from '../services/api';

const formatTime = (ms) => {
  if (!ms || ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const RecordingCard = ({ entry, colors, onRefresh }) => {
  const progressTrackWidthRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [updating, setUpdating] = useState(false);

  const {
    isLoaded,
    isPlaying,
    positionMillis,
    durationMillis,
    togglePlayback,
    seekTo,
    jumpForward,
    jumpBack,
  } = useAudioPlayer(entry);

  const progressRatio = durationMillis > 0
    ? Math.max(0, Math.min(1, positionMillis / durationMillis))
    : 0;

  const handleProgressSeek = (event) => {
    const width = progressTrackWidthRef.current;
    if (!width || !durationMillis) return;
    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
    seekTo(ratio * durationMillis);
  };

  // ── Actions ──

  const handleStartEdit = () => {
    setEditTitle(String(entry?.title || 'Recording'));
    setEditing(true);
    setMenuOpen(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditTitle('');
  };

  const handleSaveTitle = async () => {
    const nextTitle = editTitle.trim();
    if (!nextTitle) {
      Alert.alert('Title required', 'Add a title before saving.');
      return;
    }
    setUpdating(true);
    try {
      // Backend sync (best-effort)
      if (entry.savedAudioId) {
        await updateSavedReaderAudio(entry.savedAudioId, nextTitle);
      }
      // Local rename
      const renamed = await renameLocalAudioFile(entry, nextTitle);
      // Update local index
      const allEntries = await loadLocalAudioRecordings();
      const updated = allEntries.map((e) =>
        e.id === entry.id ? { ...e, ...renamed } : e
      );
      await persistLocalAudioRecordings(updated);
      setEditing(false);
      setEditTitle('');
      onRefresh?.();
    } catch (error) {
      Alert.alert('Rename failed', error?.message || 'Unable to rename.');
    } finally {
      setUpdating(false);
    }
  };

  const handleShare = async () => {
    setMenuOpen(false);
    if (!entry?.uri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(entry.uri);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    Alert.alert(
      'Delete recording',
      `Delete "${entry?.title || 'Recording'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              if (entry.savedAudioId) {
                await deleteSavedReaderAudio(entry.savedAudioId);
              }
              await deleteLocalAudioFile(entry);
              const allEntries = await loadLocalAudioRecordings();
              const updated = allEntries.filter((e) => e.id !== entry.id);
              await persistLocalAudioRecordings(updated);
              onRefresh?.();
            } catch (error) {
              Alert.alert('Delete failed', error?.message || 'Unable to delete.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <TouchableOpacity
          style={[styles.playButton, { borderColor: colors.border, backgroundColor: isPlaying ? colors.accent : colors.surface }]}
          onPress={togglePlayback}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color={isPlaying ? '#ffffff' : colors.text}
          />
        </TouchableOpacity>

        <View style={styles.info}>
          {editing ? (
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              style={[styles.titleInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {entry.title || 'Recording'}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedText }]}>
                {entry.voiceLabel || entry.voiceName || 'Audio'}
                {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleDateString()}` : ''}
              </Text>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.menuButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setMenuOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={[styles.menuButtonText, { color: colors.text }]}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Progress + time (shown when loaded) */}
      {isLoaded && (
        <View style={styles.progressRow}>
          <Text style={[styles.timeText, { color: colors.mutedText }]}>{formatTime(positionMillis)}</Text>
          <TouchableOpacity
            style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt || colors.background }]}
            onPress={handleProgressSeek}
            onLayout={(e) => { progressTrackWidthRef.current = e.nativeEvent.layout.width; }}
            activeOpacity={1}
          >
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%`, backgroundColor: colors.accent }]} />
          </TouchableOpacity>
          <Text style={[styles.timeText, { color: colors.mutedText }]}>{formatTime(durationMillis)}</Text>
        </View>
      )}

      {/* Playback controls (shown when playing or loaded) */}
      {isLoaded && (
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.controlButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => jumpBack(15000)}
          >
            <Text style={[styles.controlText, { color: colors.text }]}>-15s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => seekTo(0)}
          >
            <Text style={[styles.controlText, { color: colors.text }]}>Restart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => jumpForward(15000)}
          >
            <Text style={[styles.controlText, { color: colors.text }]}>+15s</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action menu (rename / download / delete) */}
      {menuOpen && (
        <View style={styles.actionsRow}>
          {editing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: updating ? 0.7 : 1 }]}
                onPress={handleSaveTitle}
                disabled={updating}
                activeOpacity={0.85}
              >
                <Text style={[styles.actionText, { color: colors.text }]}>{updating ? 'Saving...' : 'Save name'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={handleCancelEdit}
                activeOpacity={0.85}
              >
                <Text style={[styles.actionText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={handleStartEdit}
              activeOpacity={0.85}
            >
              <Text style={[styles.actionText, { color: colors.text }]}>Rename</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handleDelete}
            activeOpacity={0.85}
          >
            <Text style={[styles.deleteText, { color: colors.text }]}>×</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  titleInput: {
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  meta: {
    fontSize: 12,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  menuButtonText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  timeText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 4,
  },
  controlButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  controlText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default RecordingCard;
