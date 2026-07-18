/**
 * Secure storage utility using expo-secure-store
 * Handles JWT token storage and retrieval securely
 */

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'emmaline_auth_token';
const USER_KEY = 'emmaline_user';
const PREFERENCES_KEY = 'emmaline_preferences';
const AI_DISCLOSURE_ACCEPTED_KEY = 'emmaline_ai_disclosure_accepted_v1';
const DEFAULT_PREFERENCES = {
  callLanguage: 'en',
  callVoice: 'marin',
  speechRate: 1,
  callResponseDelayMs: 1600,
  themeMode: 'dark',
  noteTextScale: 1
};

/**
 * Save authentication token securely
 */
export const saveToken = async (token) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return true;
  } catch (error) {
    console.error('Error saving token:', error);
    return false;
  }
};

/**
 * Retrieve authentication token
 */
export const getToken = async () => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    return null;
  }
};

/**
 * Delete authentication token
 */
export const deleteToken = async () => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return true;
  } catch (error) {
    console.error('Error deleting token:', error);
    return false;
  }
};

/**
 * Save user information
 */
export const saveUser = async (user) => {
  try {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('Error saving user:', error);
    return false;
  }
};

/**
 * Retrieve user information
 */
export const getUser = async () => {
  try {
    const userStr = await SecureStore.getItemAsync(USER_KEY);
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  } catch (error) {
    console.error('Error retrieving user:', error);
    return null;
  }
};

/**
 * Delete user information
 */
export const deleteUser = async () => {
  try {
    await SecureStore.deleteItemAsync(USER_KEY);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async () => {
  const token = await getToken();
  return !!token;
};

export const getPreferences = async () => {
  try {
    const preferenceStr = await SecureStore.getItemAsync(PREFERENCES_KEY);

    if (!preferenceStr) {
      return { ...DEFAULT_PREFERENCES };
    }

    return {
      ...DEFAULT_PREFERENCES,
      ...JSON.parse(preferenceStr)
    };
  } catch (error) {
    console.error('Error retrieving preferences:', error);
    return { ...DEFAULT_PREFERENCES };
  }
};

export const savePreferences = async (preferences) => {
  try {
    const nextPreferences = {
      ...DEFAULT_PREFERENCES,
      ...(await getPreferences()),
      ...preferences
    };

    await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(nextPreferences));
    return true;
  } catch (error) {
    console.error('Error saving preferences:', error);
    return false;
  }
};

export const getAiDisclosureAccepted = async () => {
  try {
    return (await SecureStore.getItemAsync(AI_DISCLOSURE_ACCEPTED_KEY)) === 'true';
  } catch (error) {
    console.error('Error retrieving AI disclosure preference:', error);
    return false;
  }
};

export const saveAiDisclosureAccepted = async (accepted = true) => {
  try {
    await SecureStore.setItemAsync(AI_DISCLOSURE_ACCEPTED_KEY, accepted ? 'true' : 'false');
    return true;
  } catch (error) {
    console.error('Error saving AI disclosure preference:', error);
    return false;
  }
};

export const getOnboardingComplete = async () => {
  try {
    const value = await SecureStore.getItemAsync('ali_onboarding_complete');
    return value === 'true';
  } catch {
    return false;
  }
};

export const saveOnboardingComplete = async () => {
  try {
    await SecureStore.setItemAsync('ali_onboarding_complete', 'true');
  } catch {}
};

export const getCallLanguagePreference = async () => {
  const preferences = await getPreferences();
  return preferences.callLanguage || 'en';
};

export const saveCallLanguagePreference = async (callLanguage) => {
  return savePreferences({ callLanguage });
};

export const getCallVoicePreference = async () => {
  const preferences = await getPreferences();
  return preferences.callVoice || DEFAULT_PREFERENCES.callVoice;
};

export const saveCallVoicePreference = async (callVoice) => {
  return savePreferences({ callVoice: String(callVoice || DEFAULT_PREFERENCES.callVoice) });
};

export const getInworldVoicePreference = async () => {
  const preferences = await getPreferences();
  return String(preferences.inworldVoice || 'Sarah').trim();
};

export const saveInworldVoicePreference = async (inworldVoice) => {
  return savePreferences({ inworldVoice: String(inworldVoice || 'Sarah').trim() });
};

export const getVoiceProviderPreference = async () => {
  const preferences = await getPreferences();
  return String(preferences.voiceProvider || 'openai').trim().toLowerCase();
};

export const saveVoiceProviderPreference = async (provider) => {
  return savePreferences({ voiceProvider: String(provider || 'openai').trim().toLowerCase() });
};

export const getSpeechRatePreference = async () => {
  const preferences = await getPreferences();
  const speechRate = Number(preferences.speechRate);

  if (!Number.isFinite(speechRate)) {
    return DEFAULT_PREFERENCES.speechRate;
  }

  return speechRate;
};

export const saveSpeechRatePreference = async (speechRate) => {
  return savePreferences({ speechRate: Number(speechRate) });
};

export const getCallResponseDelayPreference = async () => {
  const preferences = await getPreferences();
  const responseDelayMs = Number(preferences.callResponseDelayMs);

  if (!Number.isFinite(responseDelayMs)) {
    return DEFAULT_PREFERENCES.callResponseDelayMs;
  }

  return responseDelayMs;
};

export const saveCallResponseDelayPreference = async (callResponseDelayMs) => {
  return savePreferences({ callResponseDelayMs: Number(callResponseDelayMs) });
};

export const getThemeModePreference = async () => {
  const preferences = await getPreferences();
  return preferences.themeMode === 'light' ? 'light' : 'dark';
};

export const saveThemeModePreference = async (themeMode) => {
  return savePreferences({ themeMode: themeMode === 'light' ? 'light' : 'dark' });
};

export const getNoteTextScalePreference = async () => {
  const preferences = await getPreferences();
  const noteTextScale = Number(preferences.noteTextScale);

  if (!Number.isFinite(noteTextScale)) {
    return DEFAULT_PREFERENCES.noteTextScale;
  }

  return Math.min(1.3, Math.max(0.95, noteTextScale));
};

export const saveNoteTextScalePreference = async (noteTextScale) => {
  const normalized = Math.min(1.3, Math.max(0.95, Number(noteTextScale) || DEFAULT_PREFERENCES.noteTextScale));
  return savePreferences({ noteTextScale: normalized });
};

/**
 * Logout - clear all auth data
 */
export const logout = async () => {
  try {
    await deleteToken();
    await deleteUser();
    return true;
  } catch (error) {
    console.error('Error during logout:', error);
    return false;
  }
};

export default {
  saveToken,
  getToken,
  deleteToken,
  saveUser,
  getUser,
  deleteUser,
  isAuthenticated,
  getPreferences,
  savePreferences,
  getAiDisclosureAccepted,
  saveAiDisclosureAccepted,
  getCallLanguagePreference,
  saveCallLanguagePreference,
  getCallVoicePreference,
  saveCallVoicePreference,
  getInworldVoicePreference,
  saveInworldVoicePreference,
  getVoiceProviderPreference,
  saveVoiceProviderPreference,
  getSpeechRatePreference,
  saveSpeechRatePreference,
  getCallResponseDelayPreference,
  saveCallResponseDelayPreference,
  getThemeModePreference,
  saveThemeModePreference,
  getNoteTextScalePreference,
  saveNoteTextScalePreference,
  getOnboardingComplete,
  saveOnboardingComplete
  logout
};
