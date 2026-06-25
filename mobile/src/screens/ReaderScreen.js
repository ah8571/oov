import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { importReaderDocument } from '../services/api.js';
import { useAppTheme } from '../theme/appTheme.js';
import { getCallLanguagePreference, getSpeechRatePreference } from '../utils/secureStorage.js';

const BOTTOM_SAFE_ZONE = 44;
const MAX_SPEECH_CHUNK_LENGTH = 1600;

const resolveSpeechLanguage = (languagePreference) => {
  if (languagePreference === 'es') {
    return 'es-US';
  }

  return 'en-US';
};

const splitTextIntoSpeechChunks = (text) => {
  const source = String(text || '').trim();

  if (!source) {
    return [];
  }

  const chunks = [];
  let remainingText = source;

  while (remainingText.length > MAX_SPEECH_CHUNK_LENGTH) {
    const candidate = remainingText.slice(0, MAX_SPEECH_CHUNK_LENGTH);
    const sentenceBreak = Math.max(
      candidate.lastIndexOf('. '),
      candidate.lastIndexOf('? '),
      candidate.lastIndexOf('! '),
      candidate.lastIndexOf('\n')
    );
    const wordBreak = candidate.lastIndexOf(' ');
    const breakIndex = sentenceBreak > 300 ? sentenceBreak + 1 : wordBreak > 300 ? wordBreak : MAX_SPEECH_CHUNK_LENGTH;

    chunks.push(remainingText.slice(0, breakIndex).trim());
    remainingText = remainingText.slice(breakIndex).trim();
  }

  if (remainingText) {
    chunks.push(remainingText);
  }

  return chunks.filter(Boolean);
};

const ReaderScreen = ({ onAppHeaderScroll }) => {
  const { colors, isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [documentTitle, setDocumentTitle] = useState('');
  const [readerText, setReaderText] = useState('');
  const [importMetadata, setImportMetadata] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechChunksRef = useRef([]);
  const speechIndexRef = useRef(0);
  const speechCancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      speechCancelledRef.current = true;
      Speech.stop();
      onAppHeaderScroll?.(0);
    };
  }, [onAppHeaderScroll]);

  const handleScroll = (event) => {
    const nextOffsetY = Math.max(0, event.nativeEvent.contentOffset.y || 0);
    onAppHeaderScroll?.(nextOffsetY);
  };

  const stopReading = useCallback(() => {
    speechCancelledRef.current = true;
    speechChunksRef.current = [];
    speechIndexRef.current = 0;
    setIsSpeaking(false);
    Speech.stop();
  }, []);

  const speakNextChunk = useCallback(async (language, rate) => {
    if (speechCancelledRef.current) {
      return;
    }

    const nextChunk = speechChunksRef.current[speechIndexRef.current];

    if (!nextChunk) {
      setIsSpeaking(false);
      return;
    }

    Speech.speak(nextChunk, {
      language,
      rate,
      onDone: () => {
        speechIndexRef.current += 1;

        if (speechIndexRef.current >= speechChunksRef.current.length) {
          setIsSpeaking(false);
          return;
        }

        speakNextChunk(language, rate);
      },
      onStopped: () => {
        setIsSpeaking(false);
      },
      onError: () => {
        setIsSpeaking(false);
        Alert.alert('Reader error', 'The device could not read this text aloud.');
      }
    });
  }, []);

  const handleReadAloud = useCallback(async () => {
    const normalizedText = String(readerText || '').trim();

    if (!normalizedText) {
      Alert.alert('Nothing to read', 'Paste text or import a document first.');
      return;
    }

    stopReading();

    const [languagePreference, savedSpeechRate] = await Promise.all([
      getCallLanguagePreference(),
      getSpeechRatePreference()
    ]);
    const speechLanguage = resolveSpeechLanguage(languagePreference);
    const speechRate = Math.max(0.75, Math.min(1.1, Number(savedSpeechRate) || 1));

    speechCancelledRef.current = false;
    speechChunksRef.current = splitTextIntoSpeechChunks(normalizedText);
    speechIndexRef.current = 0;
    setIsSpeaking(true);
    speakNextChunk(speechLanguage, speechRate);
  }, [readerText, speakNextChunk, stopReading]);

  const handleImportDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false
      });

      if (result.canceled) {
        return;
      }

      const selectedFile = result.assets?.[0];

      if (!selectedFile) {
        Alert.alert('Import error', 'No document was selected.');
        return;
      }

      setIsImporting(true);
      const response = await importReaderDocument(selectedFile);

      if (!response.success) {
        throw new Error(response.error || 'Unable to import document');
      }

      stopReading();
      setDocumentTitle(response.title || selectedFile.name || 'Imported document');
      setReaderText(response.text || '');
      setImportMetadata(response.metadata || null);
    } catch (error) {
      Alert.alert('Import failed', error.message || 'Unable to import this document right now.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = () => {
    stopReading();
    setDocumentTitle('');
    setReaderText('');
    setImportMetadata(null);
  };

  const wordCount = String(readerText || '').trim() ? String(readerText || '').trim().split(/\s+/).filter(Boolean).length : 0;
  const bottomContentInset = Math.max(insets.bottom, BOTTOM_SAFE_ZONE);
  const primaryButtonBackground = isDarkMode ? colors.surfaceAlt : colors.text;
  const primaryButtonTextColor = isDarkMode ? colors.text : '#ffffff';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomContentInset + 24 }]}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Reader</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Read on the go</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>Paste text or import a plain-text file or PDF, then have your device read it aloud.</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryButtonBackground, borderColor: colors.border }]}
            onPress={handleImportDocument}
            disabled={isImporting}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, { color: primaryButtonTextColor }]}>{isImporting ? 'Importing...' : 'Import TXT or PDF'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handleClear}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        {isImporting ? (
          <View style={[styles.importCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.importingText, { color: colors.mutedText }]}>Extracting readable text from your document...</Text>
          </View>
        ) : null}

        {importMetadata ? (
          <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metaTitle, { color: colors.text }]}>{documentTitle || 'Imported document'}</Text>
            <Text style={[styles.metaText, { color: colors.mutedText }]}>Words: {importMetadata.wordCount || wordCount} · Characters: {importMetadata.characterCount || String(readerText || '').length}</Text>
            {importMetadata.pageCount ? (
              <Text style={[styles.metaText, { color: colors.mutedText }]}>Pages: {importMetadata.pageCount}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.editorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={documentTitle}
            onChangeText={setDocumentTitle}
            placeholder="Document title"
            placeholderTextColor={colors.mutedText}
            style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
          />
          <TextInput
            value={readerText}
            onChangeText={setReaderText}
            placeholder="Paste an article, study guide, memo, or document text here..."
            placeholderTextColor={colors.mutedText}
            multiline
            textAlignVertical="top"
            style={[styles.bodyInput, { color: colors.text }]}
          />
        </View>

        <View style={[styles.metaFooter, { borderColor: colors.border }]}> 
          <Text style={[styles.metaFooterText, { color: colors.mutedText }]}>{wordCount} words ready to read</Text>
          <Text style={[styles.metaFooterText, { color: colors.mutedText }]}>Uses your current speech speed preference</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryButtonBackground, borderColor: colors.border, opacity: isSpeaking ? 0.82 : 1 }]}
            onPress={handleReadAloud}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, { color: primaryButtonTextColor }]}>{isSpeaking ? 'Restart reading' : 'Read aloud'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: isSpeaking ? 1 : 0.55 }]}
            onPress={stopReading}
            disabled={!isSpeaking}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Stop</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.helpText, { color: colors.mutedText }]}>This first version reads with the device voice for speed. Imported PDFs are converted to plain text before playback.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  contentContainer: {
    paddingBottom: 24
  },
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '700'
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 14
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  importCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10
  },
  importingText: {
    fontSize: 14,
    textAlign: 'center'
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 4
  },
  metaTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18
  },
  editorCard: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden'
  },
  titleInput: {
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    borderBottomWidth: 1
  },
  bodyInput: {
    minHeight: 280,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    lineHeight: 24
  },
  metaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 12
  },
  metaFooterText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18
  },
  helpText: {
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: 8
  }
});

export default ReaderScreen;