import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { createNote, getNote, getTopics, updateNote } from '../services/api.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';
import FloatingBackButton from '../components/FloatingBackButton';
import { normalizeNoteContentToHtml, stripNoteContentToPlainText } from '../utils/noteContent.js';
import { getNoteTextScalePreference, saveNoteTextScalePreference } from '../utils/secureStorage.js';

const AUTO_SAVE_DELAY_MS = 900;
const UNTITLED_NOTE_TITLE = 'Untitled note';
const NOTE_TEXT_SCALE_OPTIONS = [0.95, 1, 1.15, 1.3];
const TOOLBAR_DOCK_HEIGHT = 58;
const BOTTOM_SAFE_ZONE = 44;

/**
 * CreateNoteScreen
 * Create or edit a note
 */
const CreateNoteScreen = ({ route, navigation, onAppHeaderScroll, notesResetToken = 0 }) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const existingNote = route?.params?.note || null;
  const [noteId, setNoteId] = useState(existingNote?.id || null);
  const [title, setTitle] = useState(existingNote?.title || '');
  const [content, setContent] = useState(normalizeNoteContentToHtml(existingNote?.content || ''));
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topics, setTopics] = useState([]);
  const [saveState, setSaveState] = useState(existingNote?.id ? 'Saved' : 'Idle');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [editorFocused, setEditorFocused] = useState(false);
  const [noteTextScale, setNoteTextScale] = useState(1);
  const isEditing = useMemo(() => Boolean(noteId || existingNote?.id), [existingNote?.id, noteId]);
  const richTextRef = useRef(null);
  const pendingContentRef = useRef(content);
  const noteIdRef = useRef(existingNote?.id || null);
  const draftRef = useRef({
    title: existingNote?.title || '',
    content: normalizeNoteContentToHtml(existingNote?.content || ''),
    selectedTopic: existingNote?.topicId || null
  });
  const isHydratingRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');
  const isMountedRef = useRef(true);
  const lastNotesResetTokenRef = useRef(notesResetToken);
  const titleInputRef = useRef(null);
  const pendingEditorFocusRef = useRef(false);

  const updateSaveState = (nextValue) => {
    if (isMountedRef.current) {
      setSaveState(nextValue);
    }
  };

  const clearAutoSaveTimeout = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  };

  const buildDraftPayload = () => {
    const nextTitle = String(draftRef.current.title || '').trim();
    const nextContent = String(draftRef.current.content || '').trim();
    const nextTopicId = draftRef.current.selectedTopic || null;
    const plainTextContent = stripNoteContentToPlainText(nextContent).trim();

    if (!nextTitle && !plainTextContent && !nextTopicId) {
      return null;
    }

    const effectiveTitle = nextTitle || UNTITLED_NOTE_TITLE;
    const normalizedContent = normalizeNoteContentToHtml(nextContent, { title: effectiveTitle });

    return {
      title: effectiveTitle,
      content: normalizedContent,
      topicId: nextTopicId
    };
  };

  const buildSnapshot = ({ noteId: snapshotNoteId = noteIdRef.current, title: snapshotTitle, content: snapshotContent, topicId }) => {
    return JSON.stringify({
      noteId: snapshotNoteId || null,
      title: snapshotTitle || '',
      content: snapshotContent || '',
      topicId: topicId || null
    });
  };

  const flushAutoSave = async (force = false) => {
    clearAutoSaveTimeout();

    if (isHydratingRef.current) {
      return true;
    }

    const payload = buildDraftPayload();

    if (!payload) {
      updateSaveState('Idle');
      return true;
    }

    const snapshot = buildSnapshot(payload);

    if (snapshot === lastSavedSnapshotRef.current) {
      updateSaveState('Saved');
      return true;
    }

    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return true;
    }

    saveInFlightRef.current = true;
    updateSaveState('Saving...');

    try {
      const currentNoteId = noteIdRef.current;
      const response = currentNoteId
        ? await updateNote(currentNoteId, payload.title, payload.content, payload.topicId)
        : await createNote(payload.title, payload.content, payload.topicId);

      if (!response.success) {
        throw new Error(response.error || 'Unable to save note');
      }

      const savedNote = response.note || {};
      const savedNoteId = savedNote.id || currentNoteId || null;
      const savedTitle = savedNote.title || payload.title;
      const savedTopicId = savedNote.topicId ?? payload.topicId ?? null;
      const savedContent = normalizeNoteContentToHtml(savedNote.content || payload.content, {
        title: savedTitle
      });

      noteIdRef.current = savedNoteId;
      if (savedNoteId !== noteId) {
        setNoteId(savedNoteId);
      }

      lastSavedSnapshotRef.current = buildSnapshot({
        noteId: savedNoteId,
        title: savedTitle,
        content: savedContent,
        topicId: savedTopicId
      });

      updateSaveState('Saved');
      return true;
    } catch (error) {
      updateSaveState('Save failed');
      return false;
    } finally {
      saveInFlightRef.current = false;

      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        flushAutoSave();
      }
    }
  };

  const hydrateNote = (noteRecord) => {
    isHydratingRef.current = true;

    const normalizedContent = normalizeNoteContentToHtml(noteRecord?.content || '', {
      title: noteRecord?.title || ''
    });

    const hydratedNoteId = noteRecord?.id || null;

    noteIdRef.current = hydratedNoteId;
    setNoteId(hydratedNoteId);
    setTitle(noteRecord?.title || '');
    setSelectedTopic(noteRecord?.topicId || null);
    setContent(normalizedContent);
    draftRef.current = {
      title: noteRecord?.title || '',
      content: normalizedContent,
      selectedTopic: noteRecord?.topicId || null
    };
    pendingContentRef.current = normalizedContent;
    lastSavedSnapshotRef.current = hydratedNoteId
      ? buildSnapshot({
          noteId: hydratedNoteId,
          title: noteRecord?.title || '',
          content: normalizedContent,
          topicId: noteRecord?.topicId || null
        })
      : '';
    updateSaveState(hydratedNoteId ? 'Saved' : 'Idle');

    requestAnimationFrame(() => {
      richTextRef.current?.setContentHTML?.(normalizedContent || '<p></p>');
      richTextRef.current?.blurContentEditor?.();
      Keyboard.dismiss();
      isHydratingRef.current = false;
    });
  };

  useEffect(() => {
    pendingContentRef.current = content;
    draftRef.current = {
      title,
      content,
      selectedTopic
    };
  }, [content, selectedTopic, title]);

  useEffect(() => {
    hydrateNote(existingNote);
  }, [existingNote?.id, existingNote?.title, existingNote?.content, existingNote?.topicId]);

  useEffect(() => {
    let isActive = true;

    const loadFullNote = async () => {
      if (!existingNote?.id) {
        return;
      }

      const response = await getNote(existingNote.id);

      if (isActive && response.success && response.note) {
        hydrateNote(response.note);
      }
    };

    loadFullNote();

    return () => {
      isActive = false;
    };
  }, [existingNote?.id]);

  useEffect(() => {
    const activeNoteId = existingNote?.id || noteIdRef.current;

    if (!activeNoteId) {
      return undefined;
    }

    let isActive = true;

    const syncRemoteNote = async () => {
      const response = await getNote(activeNoteId);

      if (!isActive || !response.success || !response.note) {
        return;
      }

      const remoteTitle = response.note.title || '';
      const remoteContent = normalizeNoteContentToHtml(response.note.content || '', {
        title: remoteTitle
      });
      const remoteSnapshot = buildSnapshot({
        noteId: response.note.id || activeNoteId,
        title: remoteTitle,
        content: remoteContent,
        topicId: response.note.topicId || null
      });

      if (remoteSnapshot === lastSavedSnapshotRef.current) {
        return;
      }

      const localPayload = buildDraftPayload();
      const localSnapshot = localPayload
        ? buildSnapshot({
            noteId: noteIdRef.current,
            title: localPayload.title,
            content: localPayload.content,
            topicId: localPayload.topicId
          })
        : '';

      if (localSnapshot && localSnapshot !== lastSavedSnapshotRef.current) {
        return;
      }

      hydrateNote(response.note);
    };

    const unsubscribeFocus = navigation.addListener('focus', syncRemoteNote);
    const pollId = setInterval(syncRemoteNote, 4000);

    return () => {
      isActive = false;
      clearInterval(pollId);
      unsubscribeFocus();
    };
  }, [existingNote?.id, navigation]);

  useEffect(() => {
    const loadTopics = async () => {
      const response = await getTopics();
      if (response.success) {
        setTopics(response.topics || []);
      }
    };

    loadTopics();
  }, []);

  useEffect(() => {
    const loadNoteTextScale = async () => {
      const savedScale = await getNoteTextScalePreference();
      setNoteTextScale(savedScale || 1);
    };

    loadNoteTextScale();
  }, []);

  useEffect(() => {
    const escapedBackground = JSON.stringify(colors.background);
    const escapedText = JSON.stringify(colors.text);
    const escapedMutedText = JSON.stringify(colors.mutedText);
    const escapedBottomPadding = JSON.stringify(`${editorContentBottomPadding}px`);
    const escapedBodyFontSize = JSON.stringify(`${editorFontSize}px`);
    const escapedBodyLineHeight = JSON.stringify(`${editorLineHeight}px`);
    const escapedHeading1FontSize = JSON.stringify(`${heading1Size}px`);
    const escapedHeading1LineHeight = JSON.stringify(`${Math.round(heading1Size * 1.2)}px`);
    const escapedHeading2FontSize = JSON.stringify(`${heading2Size}px`);
    const escapedHeading2LineHeight = JSON.stringify(`${Math.round(heading2Size * 1.25)}px`);
    const escapedHeading3FontSize = JSON.stringify(`${heading3Size}px`);
    const escapedHeading3LineHeight = JSON.stringify(`${Math.round(heading3Size * 1.3)}px`);
    const nextEditorStyle = {
      backgroundColor: colors.background,
      color: colors.text,
      contentCSSText: `font-size: ${editorFontSize}px; line-height: ${editorLineHeight}px; color: ${colors.text}; padding: 0 0 ${editorContentBottomPadding}px 0; background-color: ${colors.background};`,
      placeholderColor: colors.mutedText,
      cssText: `body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: ${colors.background}; color: ${colors.text}; margin: 0; padding: 0; } #editor, .pell-content { font-size: ${editorFontSize}px; line-height: ${editorLineHeight}px; color: ${colors.text}; background-color: ${colors.background}; } p, div, li, span { margin: 0 0 12px 0; font-size: ${editorFontSize}px; line-height: ${editorLineHeight}px; color: ${colors.text}; } ul, ol { padding-left: 22px; margin: 0 0 12px 0; } h1 { margin: 0 0 12px 0; font-size: ${heading1Size}px; line-height: ${Math.round(heading1Size * 1.2)}px; } h2 { margin: 0 0 12px 0; font-size: ${heading2Size}px; line-height: ${Math.round(heading2Size * 1.25)}px; } h3 { margin: 0 0 12px 0; font-size: ${heading3Size}px; line-height: ${Math.round(heading3Size * 1.3)}px; }`
    };

    const typographyStyleSheet = [
      'html, body {',
      `background-color: ${colors.background};`,
      `color: ${colors.text};`,
      `font-size: ${editorFontSize}px;`,
      `line-height: ${editorLineHeight}px;`,
      '}',
      '.pell-content, #editor {',
      `background-color: ${colors.background};`,
      `color: ${colors.text};`,
      `font-size: ${editorFontSize}px;`,
      `line-height: ${editorLineHeight}px;`,
      `padding-bottom: ${editorContentBottomPadding}px;`,
      '}',
      'p, div, li, span {',
      `font-size: ${editorFontSize}px;`,
      `line-height: ${editorLineHeight}px;`,
      `color: ${colors.text};`,
      'margin: 0 0 12px 0;',
      '}',
      'ul, ol {',
      'padding-left: 22px;',
      'margin: 0 0 12px 0;',
      '}',
      'h1 {',
      `font-size: ${heading1Size}px;`,
      `line-height: ${Math.round(heading1Size * 1.2)}px;`,
      `color: ${colors.text};`,
      '}',
      'h2 {',
      `font-size: ${heading2Size}px;`,
      `line-height: ${Math.round(heading2Size * 1.25)}px;`,
      `color: ${colors.text};`,
      '}',
      'h3 {',
      `font-size: ${heading3Size}px;`,
      `line-height: ${Math.round(heading3Size * 1.3)}px;`,
      `color: ${colors.text};`,
      '}',
      '::placeholder {',
      `color: ${colors.mutedText};`,
      '}'
    ].join(' ');

    richTextRef.current?.setContentStyle?.(nextEditorStyle);
    richTextRef.current?.commandDOM?.(`
      document.documentElement.style.backgroundColor = ${escapedBackground};
      document.body.style.backgroundColor = ${escapedBackground};
      document.body.style.color = ${escapedText};
      document.body.style.fontSize = ${escapedBodyFontSize};
      document.body.style.lineHeight = ${escapedBodyLineHeight};
      var contentShell = $('.content');
      if (contentShell) {
        contentShell.style.backgroundColor = ${escapedBackground};
      }
      var editorRoot = $('#editor');
      if (editorRoot) {
        editorRoot.style.backgroundColor = ${escapedBackground};
        editorRoot.style.color = ${escapedText};
      }
      var editableSurface = document.querySelector('.pell-content');
      if (editableSurface) {
        editableSurface.style.backgroundColor = ${escapedBackground};
        editableSurface.style.color = ${escapedText};
        editableSurface.style.fontSize = ${escapedBodyFontSize};
        editableSurface.style.lineHeight = ${escapedBodyLineHeight};
        editableSurface.style.paddingBottom = ${escapedBottomPadding};
      }
      var existingTypographyStyle = document.getElementById('emmaline-note-scale-style');
      if (!existingTypographyStyle) {
        existingTypographyStyle = document.createElement('style');
        existingTypographyStyle.id = 'emmaline-note-scale-style';
        document.head.appendChild(existingTypographyStyle);
      }
      existingTypographyStyle.textContent = ${JSON.stringify(typographyStyleSheet)};

      Array.from(document.querySelectorAll('p, div, li, span, h1, h2, h3')).forEach(function(node) {
        node.style.removeProperty('font-size');
        node.style.removeProperty('line-height');
        node.style.removeProperty('color');
        node.style.removeProperty('font');
      });

      var placeholderNode = document.querySelector('.pell-content[contenteditable="true"]');
      if (placeholderNode) {
        placeholderNode.style.setProperty('--placeholder-color', ${escapedMutedText});
      }
    `);
  }, [colors.background, colors.mutedText, colors.text, editorContentBottomPadding, editorFontSize, editorLineHeight, heading1Size, heading2Size, heading3Size]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height || Keyboard.metrics?.()?.height || 0);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isHydratingRef.current) {
      return undefined;
    }

    const payload = buildDraftPayload();

    if (!payload) {
      clearAutoSaveTimeout();
      updateSaveState('Idle');
      return undefined;
    }

    const nextSnapshot = buildSnapshot(payload);

    if (nextSnapshot === lastSavedSnapshotRef.current) {
      clearAutoSaveTimeout();
      updateSaveState('Saved');
      return undefined;
    }

    updateSaveState('Unsaved');
    clearAutoSaveTimeout();
    autoSaveTimeoutRef.current = setTimeout(() => {
      flushAutoSave();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      clearAutoSaveTimeout();
    };
  }, [title, content, selectedTopic]);

  useEffect(() => {
    return () => {
      onAppHeaderScroll?.(0);
      isMountedRef.current = false;
      clearAutoSaveTimeout();
      flushAutoSave(true).catch(() => {
        // Best-effort save when leaving the note screen.
      });
    };
  }, [onAppHeaderScroll]);

  useEffect(() => {
    if (lastNotesResetTokenRef.current === notesResetToken) {
      return;
    }

    lastNotesResetTokenRef.current = notesResetToken;

    if (navigation.canGoBack()) {
      navigation.popToTop?.();
    } else {
      navigation.navigate('NotesList');
    }
  }, [navigation, notesResetToken]);

  const handleEditorScroll = (event) => {
    const nextOffsetY = Math.max(0, event.nativeEvent.contentOffset.y || 0);
    onAppHeaderScroll?.(nextOffsetY);
  };

  const handleIncreaseTextSize = async () => {
    const currentIndex = NOTE_TEXT_SCALE_OPTIONS.findIndex((value) => Math.abs(value - noteTextScale) < 0.001);
    const nextIndex = currentIndex >= 0 ? Math.min(currentIndex + 1, NOTE_TEXT_SCALE_OPTIONS.length - 1) : 1;
    const nextScale = NOTE_TEXT_SCALE_OPTIONS[nextIndex];

    if (Math.abs(nextScale - noteTextScale) < 0.001) {
      return;
    }

    setNoteTextScale(nextScale);
    await saveNoteTextScalePreference(nextScale);
    requestAnimationFrame(() => {
      richTextRef.current?.focusContentEditor?.();
    });
  };

  const handleDecreaseTextSize = async () => {
    const currentIndex = NOTE_TEXT_SCALE_OPTIONS.findIndex((value) => Math.abs(value - noteTextScale) < 0.001);
    const nextIndex = currentIndex >= 0 ? Math.max(currentIndex - 1, 0) : NOTE_TEXT_SCALE_OPTIONS.indexOf(1);
    const nextScale = NOTE_TEXT_SCALE_OPTIONS[nextIndex];

    if (Math.abs(nextScale - noteTextScale) < 0.001) {
      return;
    }

    setNoteTextScale(nextScale);
    await saveNoteTextScalePreference(nextScale);
    requestAnimationFrame(() => {
      richTextRef.current?.focusContentEditor?.();
    });
  };

  const editorFontSize = 16 * noteTextScale;
  const editorLineHeight = Math.round(editorFontSize * 1.7);
  const heading1Size = Math.round(32 * noteTextScale);
  const heading2Size = Math.round(24 * noteTextScale);
  const heading3Size = Math.round(20 * noteTextScale);
  const titleFontSize = Math.round(36 * noteTextScale);
  const titleLineHeight = Math.round(titleFontSize * 1.15);
  const safeBottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? BOTTOM_SAFE_ZONE : 12);
  const effectiveKeyboardHeight = keyboardVisible ? (keyboardHeight || Keyboard.metrics?.()?.height || 0) : 0;
  const toolbarBottomOffset = editorFocused && effectiveKeyboardHeight > 0
    ? Math.max(effectiveKeyboardHeight - safeBottomInset, 0)
    : safeBottomInset;
  const toolbarVisible = keyboardVisible && editorFocused;
  const toolbarVisualHeight = TOOLBAR_DOCK_HEIGHT + Math.max(safeBottomInset - 2, 8);
  const editorContentBottomPadding = toolbarVisible ? toolbarVisualHeight + 96 : safeBottomInset + 44;
  const contentBottomPadding = toolbarVisible
    ? toolbarVisualHeight + toolbarBottomOffset + 28
    : safeBottomInset + 36;
  const floatingBackInset = Math.max(insets.top - 12, 0) + 30;
  const editorWrapperPointerEvents = Platform.OS === 'android'
    ? 'box-none'
    : (editorFocused ? 'box-none' : 'auto');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <FloatingBackButton onPress={() => navigation.goBack()} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          keyboardVisible ? styles.contentContainerWithKeyboard : null,
          { paddingTop: floatingBackInset, paddingBottom: contentBottomPadding }
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={handleEditorScroll}
        scrollEventThrottle={16}
      >
        <TextInput
          ref={titleInputRef}
          style={[
            styles.titleInput,
            {
              color: colors.text,
              borderBottomColor: colors.border,
              fontSize: titleFontSize,
              lineHeight: titleLineHeight
            }
          ]}
          placeholder="Note Title"
          placeholderTextColor={colors.mutedText}
          value={title}
          onChangeText={setTitle}
          multiline
          scrollEnabled={false}
          blurOnSubmit={false}
          onBlur={() => {
            if (!pendingEditorFocusRef.current) {
              return;
            }

            requestAnimationFrame(() => {
              richTextRef.current?.focusContentEditor?.();
            });
          }}
          editable
        />

        <Pressable
          style={[styles.editorShell, { borderTopColor: colors.border }]}
          pointerEvents={editorWrapperPointerEvents}
          onPress={() => {
            if (Platform.OS === 'android') {
              return;
            }

            if (editorFocused) {
              return;
            }

            pendingEditorFocusRef.current = true;
            requestAnimationFrame(() => {
              richTextRef.current?.focusContentEditor?.();
            });
          }}
          onPressIn={() => {
            if (Platform.OS === 'android') {
              return;
            }

            if (editorFocused) {
              return;
            }

            pendingEditorFocusRef.current = true;
          }}
        >
          <RichEditor
            key={existingNote?.id || noteId || 'new-note'}
            ref={richTextRef}
            initialContentHTML={content || '<p></p>'}
            initialFocus={false}
            placeholder="Start typing your note..."
            editorInitializedCallback={() => {
              richTextRef.current?.setContentHTML?.(pendingContentRef.current || '<p></p>');

              if (!editorFocused) {
                richTextRef.current?.blurContentEditor?.();
                Keyboard.dismiss();
              }
            }}
            onFocus={() => {
              pendingEditorFocusRef.current = false;
              setEditorFocused(true);
              const metricsHeight = Keyboard.metrics?.()?.height || 0;
              if (metricsHeight > 0) {
                setKeyboardVisible(true);
                setKeyboardHeight(metricsHeight);
              }
            }}
            onBlur={() => {
              pendingEditorFocusRef.current = false;
              setEditorFocused(false);
            }}
            onChange={(nextContent) => {
              pendingContentRef.current = nextContent || '';
              setContent(nextContent || '');
            }}
            style={styles.richEditor}
            useContainer={Platform.OS !== 'android'}
            initialHeight={320}
            disabled={false}
            editorStyle={{
              backgroundColor: colors.background,
              color: colors.text,
              contentCSSText: `font-size: ${editorFontSize}px; line-height: ${editorLineHeight}px; color: ${colors.text}; padding: 0 0 ${editorContentBottomPadding}px 0; background-color: ${colors.background};`,
              placeholderColor: colors.mutedText,
              cssText: `body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: ${colors.background}; color: ${colors.text}; margin: 0; padding: 0; } #editor, .pell-content { font-size: ${editorFontSize}px; line-height: ${editorLineHeight}px; color: ${colors.text}; background-color: ${colors.background}; } p, div, li, span { margin: 0 0 12px 0; font-size: ${editorFontSize}px; line-height: ${editorLineHeight}px; color: ${colors.text}; } ul, ol { padding-left: 22px; margin: 0 0 12px 0; } h1 { margin: 0 0 12px 0; font-size: ${heading1Size}px; line-height: ${Math.round(heading1Size * 1.2)}px; } h2 { margin: 0 0 12px 0; font-size: ${heading2Size}px; line-height: ${Math.round(heading2Size * 1.25)}px; } h3 { margin: 0 0 12px 0; font-size: ${heading3Size}px; line-height: ${Math.round(heading3Size * 1.3)}px; }`
            }}
          />
        </Pressable>

        {topics.length > 0 ? (
          <View style={styles.topicSelector}>
            <Text style={[styles.topicSelectorLabel, { color: colors.text }]}>Topic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.topicTag,
                  { backgroundColor: colors.surfaceAlt },
                  selectedTopic === null && [styles.topicTagActive, { backgroundColor: colors.accent }]
                ]}
                onPress={() => setSelectedTopic(null)}
              >
                <Text style={[styles.topicTagText, { color: colors.mutedText }, selectedTopic === null && styles.topicTagTextActive]}>None</Text>
              </TouchableOpacity>
              {topics.map((topic) => (
                <TouchableOpacity
                  key={topic.id}
                  style={[
                    styles.topicTag,
                    { backgroundColor: colors.surfaceAlt },
                    selectedTopic === topic.id && [styles.topicTagActive, { backgroundColor: colors.accent }]
                  ]}
                  onPress={() => setSelectedTopic(topic.id)}
                >
                  <Text style={[styles.topicTagText, { color: colors.mutedText }, selectedTopic === topic.id && styles.topicTagTextActive]}>{topic.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {toolbarVisible ? (
        <View
          style={[
            styles.toolbarDock,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              bottom: toolbarBottomOffset,
              paddingBottom: Math.max(safeBottomInset - 2, 8)
            }
          ]}
        >
          <View style={styles.toolbarRichArea}>
            <RichToolbar
              editor={richTextRef}
              style={[styles.toolbar, { backgroundColor: colors.surface }]}
              selectedIconTint={colors.accent}
              iconTint={colors.text}
              disabledIconTint={colors.mutedText}
              actions={[
                actions.setBold,
                actions.setItalic,
                actions.setUnderline,
                actions.heading1,
                actions.heading2,
                actions.setParagraph,
                actions.insertBulletsList,
                actions.insertOrderedList,
                actions.undo,
                actions.redo
              ]}
              iconMap={{
                [actions.setBold]: ({ tintColor }) => <Text style={[styles.toolbarIconText, { color: tintColor }]}>B</Text>,
                [actions.setItalic]: ({ tintColor }) => <Text style={[styles.toolbarIconText, styles.toolbarIconItalic, { color: tintColor }]}>I</Text>,
                [actions.setUnderline]: ({ tintColor }) => <Text style={[styles.toolbarIconText, styles.toolbarIconUnderline, { color: tintColor }]}>U</Text>,
                [actions.heading1]: ({ tintColor }) => <Text style={[styles.toolbarIconText, { color: tintColor }]}>H1</Text>,
                [actions.heading2]: ({ tintColor }) => <Text style={[styles.toolbarIconText, { color: tintColor }]}>H2</Text>,
                [actions.setParagraph]: ({ tintColor }) => <Text style={[styles.toolbarIconText, { color: tintColor }]}>Tx</Text>,
                [actions.insertBulletsList]: ({ tintColor }) => <Text style={[styles.toolbarIconText, { color: tintColor }]}>•</Text>,
                [actions.insertOrderedList]: ({ tintColor }) => <Text style={[styles.toolbarIconText, { color: tintColor }]}>1.</Text>,
                [actions.undo]: ({ tintColor }) => <Text style={[styles.toolbarIconText, { color: tintColor }]}>↶</Text>,
                [actions.redo]: ({ tintColor }) => <Text style={[styles.toolbarIconText, { color: tintColor }]}>↷</Text>
              }}
            />
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  disabledButton: {
    opacity: 0.5
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10
  },
  contentContainer: {
    paddingBottom: BOTTOM_SAFE_ZONE + 8
  },
  contentContainerWithKeyboard: {
    paddingBottom: TOOLBAR_DOCK_HEIGHT + BOTTOM_SAFE_ZONE + 44
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 14,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 0,
    textAlignVertical: 'top'
  },
  editorShell: {
    paddingTop: 4
  },
  richEditor: {
    minHeight: 320
  },
  toolbarRichArea: {
    flex: 1
  },
  toolbar: {
    borderBottomWidth: 0,
    paddingHorizontal: 0,
    minHeight: 46
  },
  toolbarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    minHeight: TOOLBAR_DOCK_HEIGHT,
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: -2
    }
  },
  toolbarControls: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  toolbarScaleButton: {
    minWidth: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: designTokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolbarScaleButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    includeFontPadding: false
  },
  toolbarSeparator: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#dee2e6',
    marginHorizontal: 10
  },
  toolbarIconText: {
    fontSize: 15,
    fontWeight: '700'
  },
  toolbarIconItalic: {
    fontStyle: 'italic'
  },
  toolbarIconUnderline: {
    textDecorationLine: 'underline'
  },
  topicSelector: {
    marginTop: 16
  },
  topicSelectorLabel: {
    fontSize: designTokens.typography.label,
    fontWeight: '600',
    color: '#495057',
    marginBottom: designTokens.spacing.sm
  },
  topicTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: designTokens.radius.lg,
    backgroundColor: '#e9ecef',
    marginRight: designTokens.spacing.sm
  },
  topicTagActive: {
    backgroundColor: '#007AFF'
  },
  topicTagText: {
    fontSize: designTokens.typography.label,
    color: '#495057'
  },
  topicTagTextActive: {
    color: '#fff'
  }
});

export default CreateNoteScreen;
