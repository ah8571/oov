import * as FileSystem from 'expo-file-system/legacy';

const READER_AUDIO_DIRECTORY = `${FileSystem.documentDirectory}reader-audio`;
const READER_AUDIO_INDEX_FILE = `${READER_AUDIO_DIRECTORY}/latest.json`;

/**
 * Load saved reader audio entries from the local device index.
 * Each entry has { id, title, uri, voiceLabel, createdAt, ... }.
 */
export const loadLocalAudioRecordings = async () => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(READER_AUDIO_INDEX_FILE);
    if (!fileInfo.exists) return [];

    const content = await FileSystem.readAsStringAsync(READER_AUDIO_INDEX_FILE);
    const parsed = JSON.parse(content);
    const entries = Array.isArray(parsed) ? parsed : [];

    // Filter to entries with valid local URIs
    const validEntries = [];
    for (const entry of entries) {
      if (!entry?.uri) continue;
      try {
        const audioInfo = await FileSystem.getInfoAsync(entry.uri);
        if (audioInfo.exists) {
          validEntries.push(entry);
        }
      } catch {
        // Skip entries with inaccessible files
      }
    }

    return validEntries;
  } catch (error) {
    console.error('[loadLocalAudioRecordings] Error:', error?.message);
    return [];
  }
};

/**
 * Persist entries back to the local index file.
 */
export const persistLocalAudioRecordings = async (entries) => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(READER_AUDIO_DIRECTORY);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(READER_AUDIO_DIRECTORY, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(READER_AUDIO_INDEX_FILE, JSON.stringify(entries));
  } catch (error) {
    console.error('[persistLocalAudioRecordings] Error:', error?.message);
  }
};

/**
 * Rename a local audio file and return the updated entry info.
 */
export const renameLocalAudioFile = async (entry, nextTitle) => {
  if (!entry?.uri) return entry;
  const ext = entry.uri.includes('.') ? entry.uri.slice(entry.uri.lastIndexOf('.')) : '.mp3';
  const safeName = nextTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'recording';
  const nextUri = `${READER_AUDIO_DIRECTORY}/${safeName}-${Date.now()}${ext}`;
  try {
    await FileSystem.moveAsync({ from: entry.uri, to: nextUri });
    return { ...entry, uri: nextUri, title: nextTitle, fileName: `${safeName}${ext}` };
  } catch {
    // If move fails, keep the old URI but update title
    return { ...entry, title: nextTitle };
  }
};

/**
 * Delete a local audio file.
 */
export const deleteLocalAudioFile = async (entry) => {
  if (entry?.uri) {
    try {
      await FileSystem.deleteAsync(entry.uri, { idempotent: true });
    } catch {}
  }
};
