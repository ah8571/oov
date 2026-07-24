/**
 * ReaderBar — Bottom bar for CreateNoteScreen.
 * Import (URL/PDF/Photo) on the left, Read aloud (voice picker) on the right.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Alert, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useReaderTts, READER_VOICE_OPTIONS } from '../hooks/useReaderTts';
import { importReaderDocument } from '../services/api.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';

export const ReaderBar = ({ text, title, onTextChange, onTitleChange, safeBottomInset = 0 }) => {
  const { isSpeaking, isPreparing, readAloud, stopReading, voiceOptions } = useReaderTts();
  const [selectedVoice, setSelectedVoice] = useState(voiceOptions[0]?.id || 'kokoro');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showImportOptions, setShowImportOptions] = useState(false);

  const { colors } = useAppTheme();
  const barBg = colors.cardBackground || '#1a1a2e';
  const borderColor = colors.borderColor || '#333';
  const accentColor = colors.primary || '#6c63ff';
  const textColor = colors.text || '#fff';
  const mutedColor = colors.mutedText || '#999';

  const currentVoice = voiceOptions.find(v => v.id === selectedVoice);

  // ── Import ──────────────────────────────────────────────────
  const handleImportFile = useCallback(async () => {
    setShowImportOptions(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const response = await importReaderDocument(file);
      if (response?.text) {
        onTextChange?.(response.text);
        onTitleChange?.(response.title || file.name || 'Imported document');
        Alert.alert('Imported', `Loaded ${response.wordCount || '?'} words from ${file.name}`);
      }
    } catch (error) {
      Alert.alert('Import failed', error?.message || 'Could not import document');
    }
  }, [onTextChange, onTitleChange]);

  // ── Read ────────────────────────────────────────────────────
  const handleRead = useCallback(() => {
    setShowVoicePicker(false);
    if (isSpeaking) {
      stopReading();
    } else {
      readAloud(text, title, selectedVoice);
    }
  }, [isSpeaking, stopReading, readAloud, text, title, selectedVoice]);

  // ── Styles (inline for simplicity) ──────────────────────────
  const barHeight = 52;

  const s = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      height: barHeight,
      paddingBottom: safeBottomInset,
      paddingHorizontal: 12,
      backgroundColor: barBg,
      borderTopWidth: 1,
      borderTopColor: borderColor
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: barBg
    },
    btnText: { color: textColor, fontSize: 14, fontWeight: '600', marginLeft: 6 },
    divider: { width: 1, height: 28, backgroundColor: borderColor, marginHorizontal: 8 },
    voiceChip: {
      marginLeft: 'auto',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: isSpeaking ? accentColor : 'transparent',
      borderWidth: 1,
      borderColor: accentColor
    },
    voiceChipText: { color: isSpeaking ? '#fff' : accentColor, fontSize: 12, fontWeight: '600' },

    // Modal
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: barBg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: safeBottomInset + 20
    },
    modalTitle: { color: textColor, fontSize: 16, fontWeight: '700', padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor },
    voiceOption: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderColor
    },
    voiceLabel: { color: textColor, fontSize: 15 },
    voiceMeta: { color: mutedColor, fontSize: 12, marginTop: 2 },
    importOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20
    },
    importOptionText: { color: textColor, fontSize: 15, marginLeft: 10 }
  });

  return (
    <View style={s.container}>
      {/* Import */}
      <TouchableOpacity style={s.btn} onPress={() => setShowImportOptions(true)}>
        <Text style={{ fontSize: 16 }}>📎</Text>
        <Text style={s.btnText}>Import</Text>
      </TouchableOpacity>

      <View style={s.divider} />

      {/* Read */}
      <TouchableOpacity style={s.btn} onPress={handleRead}>
        <Text style={{ fontSize: 16 }}>{isSpeaking ? '⏹' : '🔊'}</Text>
        <Text style={s.btnText}>{isPreparing ? 'Preparing…' : isSpeaking ? 'Stop' : 'Read'}</Text>
      </TouchableOpacity>

      {/* Voice chip */}
      <TouchableOpacity style={s.voiceChip} onPress={() => setShowVoicePicker(true)}>
        <Text style={s.voiceChipText}>{currentVoice?.label || 'Voice'}</Text>
      </TouchableOpacity>

      {/* ── Voice picker modal ──────────────────────────────── */}
      <Modal visible={showVoicePicker} transparent animationType="slide" onRequestClose={() => setShowVoicePicker(false)}>
        <TouchableOpacity style={s.backdrop} onPress={() => setShowVoicePicker(false)} activeOpacity={1}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Choose voice</Text>
            <FlatList
              data={voiceOptions}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.voiceOption, item.id === selectedVoice && { backgroundColor: accentColor + '22' }]}
                  onPress={() => { setSelectedVoice(item.id); setShowVoicePicker(false); }}
                >
                  <Text style={s.voiceLabel}>{item.label}</Text>
                  <Text style={s.voiceMeta}>
                    {item.provider === 'kokoro-runpod' ? 'Free · GPU fast' :
                     item.provider === 'resemble' ? 'Premium · Natural' :
                     item.provider === 'device' ? 'On-device · Basic' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Import options modal ─────────────────────────────── */}
      <Modal visible={showImportOptions} transparent animationType="slide" onRequestClose={() => setShowImportOptions(false)}>
        <TouchableOpacity style={s.backdrop} onPress={() => setShowImportOptions(false)} activeOpacity={1}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Import document</Text>
            <TouchableOpacity style={s.importOption} onPress={handleImportFile}>
              <Text style={{ fontSize: 18 }}>📄</Text>
              <Text style={s.importOptionText}>Select PDF or TXT file</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.importOption} onPress={() => {
              setShowImportOptions(false);
              Alert.prompt?.('Import URL', 'Paste a webpage URL to extract text', (url) => {
                if (url) {
                  importReaderDocument({ uri: url, name: 'webpage', type: 'text/html' })
                    .then(r => { if (r?.text) { onTextChange?.(r.text); onTitleChange?.(r.title || url); } })
                    .catch(e => Alert.alert('Import failed', e?.message));
                }
              });
            }}>
              <Text style={{ fontSize: 18 }}>🌐</Text>
              <Text style={s.importOptionText}>Import from URL</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
