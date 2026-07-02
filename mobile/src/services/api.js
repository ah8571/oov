/**
 * API client service for Emmaline mobile app
 * Handles all HTTP requests to the backend with automatic token management
 */

import axios from 'axios';
import * as SecureStorage from '../utils/secureStorage.js';
import {
  exchangeCodeForSession as exchangeSupabaseOAuthCode,
  getAccessToken,
  getSession,
  refreshSession as refreshSupabaseSession,
  startOAuthSignIn as startSupabaseOAuthSignIn,
  signInWithIdToken as signInWithSupabaseIdToken,
  signInWithPassword as signInWithSupabasePassword,
  signOut as signOutFromSupabase,
  signUpWithPassword as signUpWithSupabasePassword
} from './supabaseAuth.js';

// Configuration
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_NATIVE_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  'https://api.emmaline.app/api';
const REQUEST_TIMEOUT = 30000; // 30 seconds

const formatApiError = (error, fallbackMessage) => {
  if (error.response?.data?.error) {
    if (String(error.response.data.error).includes('Unacceptable audience in id_token')) {
      return 'Apple Sign In is misconfigured on the backend. Supabase Apple provider should use your Apple Services ID as the client ID, not the app bundle identifier.';
    }

    return error.response.data.error;
  }

  if (String(error.message || '').includes('Unacceptable audience in id_token')) {
    return 'Apple Sign In is misconfigured on the backend. Supabase Apple provider should use your Apple Services ID as the client ID, not the app bundle identifier.';
  }

  if (error.message === 'Network Error') {
    return `Network error reaching ${API_BASE_URL}. Check backend health and the app's API configuration.`;
  }

  return error.message || fallbackMessage;
};

const logApiRequest = (method, path, details = {}) => {
  console.log(`[API] ${method.toUpperCase()} ${API_BASE_URL}${path}`, details);
};

const logApiFailure = (method, path, error) => {
  console.error(`[API] ${method.toUpperCase()} ${API_BASE_URL}${path} failed`, {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data || null
  });
};

const isMissingProfileError = (error) => {
  return error?.response?.status === 404 && error?.response?.data?.error === 'User not found';
};

const isProfileConsentRequiredError = (error) => {
  return error?.response?.status === 400
    && error?.response?.data?.error === 'Terms of Use and Privacy Policy acceptance are required';
};

const getPendingProfileSetup = async ({ provider = null, email = null, fullName = null } = {}) => {
  const session = await getSession();
  const authUser = session?.user || null;
  const authMetadata = authUser?.user_metadata || {};
  const providers = Array.isArray(authUser?.app_metadata?.providers) ? authUser.app_metadata.providers : [];

  return {
    provider: provider || providers[0] || null,
    email: authUser?.email || authMetadata.email || email || null,
    fullName: authMetadata.full_name || authMetadata.name || fullName || null
  };
};

const syncUserProfile = async ({
  marketingOptIn,
  termsAccepted,
  privacyAccepted,
  email,
  fullName
} = {}) => {
  const payload = {};

  if (typeof marketingOptIn === 'boolean') {
    payload.marketingOptIn = marketingOptIn;
  }

  if (typeof termsAccepted === 'boolean') {
    payload.termsAccepted = termsAccepted;
  }

  if (typeof privacyAccepted === 'boolean') {
    payload.privacyAccepted = privacyAccepted;
  }

  if (email) {
    payload.email = email;
  }

  if (fullName) {
    payload.fullName = fullName;
  }

  logApiRequest('post', '/auth/profile/sync', payload);
  const response = await apiClient.post('/auth/profile/sync', payload);
  await SecureStorage.saveUser(response.data.user);

  return response.data.user;
};

const fetchCurrentUserProfile = async () => {
  const response = await apiClient.get('/auth/me');
  await SecureStorage.saveUser(response.data.user);

  return response.data.user;
};

/**
 * Create axios instance with default config
 */
const createClient = () => {
  return axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

let apiClient = createClient();

/**
 * Add token to request headers
 */
const addTokenToHeaders = async () => {
  const token = await getAccessToken();
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    removeTokenFromHeaders();
  }
};

/**
 * Remove token from request headers
 */
const removeTokenFromHeaders = () => {
  delete apiClient.defaults.headers.common['Authorization'];
};

/**
 * Register a new user
 */
export const registerUser = async (email, password, options = {}) => {
  try {
    const {
      marketingOptIn = false
    } = options;

    await signUpWithSupabasePassword({
      email,
      marketingOptIn,
      password
    });

    await addTokenToHeaders();

    return {
      success: true,
      requiresProfileCompletion: true,
      profileSetup: await getPendingProfileSetup({ email })
    };
  } catch (error) {
    logApiFailure('post', '/auth/profile/sync', error);
    return {
      success: false,
      error: formatApiError(error, 'Registration failed')
    };
  }
};

/**
 * Login user
 */
export const loginUser = async (email, password) => {
  try {
    await signInWithSupabasePassword({ email, password });
    await addTokenToHeaders();
    let user;

    try {
      user = await fetchCurrentUserProfile();

      if (user && user.hasAcceptedLegalConsent === false) {
        return {
          success: false,
          requiresProfileCompletion: true,
          profileSetup: await getPendingProfileSetup({ email })
        };
      }
    } catch (error) {
      if (!isMissingProfileError(error)) {
        throw error;
      }

      return {
        success: false,
        requiresProfileCompletion: true,
        profileSetup: await getPendingProfileSetup({ email })
      };
    }

    return {
      success: true,
      user,
      token: await getAccessToken()
    };
  } catch (error) {
    logApiFailure('get', '/auth/me', error);
    return {
      success: false,
      error: formatApiError(error, 'Login failed')
    };
  }
};

export const loginWithSocialProvider = async ({
  mode = 'login',
  provider,
  idToken,
  redirectUrl = null,
  email = null,
  fullName = null,
  marketingOptIn = false,
  termsAccepted = false,
  privacyAccepted = false
}) => {
  try {
    if (redirectUrl) {
      await exchangeSupabaseOAuthCode(redirectUrl);
    } else {
      await signInWithSupabaseIdToken({
        provider,
        idToken
      });
    }

    await addTokenToHeaders();
    let user;

    if (mode === 'create') {
      logApiRequest('post', '/auth/profile/sync', { provider, email, mode });
      const response = await apiClient.post('/auth/profile/sync', {
        marketingOptIn,
        termsAccepted,
        privacyAccepted,
        email,
        fullName
      });

      user = response.data.user;
      await SecureStorage.saveUser(user);
    } else {
      try {
        user = await fetchCurrentUserProfile();

        if (user && user.hasAcceptedLegalConsent === false) {
          return {
            success: false,
            requiresProfileCompletion: true,
            profileSetup: await getPendingProfileSetup({ provider, email, fullName })
          };
        }
      } catch (error) {
        if (!isMissingProfileError(error)) {
          throw error;
        }

        return {
          success: false,
          requiresProfileCompletion: true,
          profileSetup: await getPendingProfileSetup({ provider, email, fullName }),
          error: 'Finish creating your Emmaline account to continue.'
        };
      }
    }

    return {
      success: true,
      user,
      token: await getAccessToken()
    };
  } catch (error) {
    logApiFailure('post', '/auth/profile/sync', error);
    return {
      success: false,
      error: formatApiError(error, `Unable to sign in with ${provider || 'social login'}`)
    };
  }
};

export const beginSocialOAuth = async ({ provider, scopes, queryParams } = {}) => {
  try {
    const result = await startSupabaseOAuthSignIn({ provider, scopes, queryParams });

    return {
      success: true,
      url: result.url
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, `Unable to start ${provider || 'social login'}`)
    };
  }
};

export const completeAuthenticatedUserProfile = async ({
  marketingOptIn = false,
  termsAccepted = false,
  privacyAccepted = false,
  email = null,
  fullName = null
} = {}) => {
  try {
    await addTokenToHeaders();
    const user = await syncUserProfile({
      marketingOptIn,
      termsAccepted,
      privacyAccepted,
      email,
      fullName
    });

    return {
      success: true,
      user
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Unable to finish account setup')
    };
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  try {
    await addTokenToHeaders();
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        error: 'No authenticated session found'
      };
    }

    let user;

    try {
      user = await fetchCurrentUserProfile();

      if (user && user.hasAcceptedLegalConsent === false) {
        return {
          success: false,
          requiresProfileCompletion: true,
          profileSetup: await getPendingProfileSetup({ email: session.user?.email || null })
        };
      }
    } catch (error) {
      if (!isMissingProfileError(error)) {
        throw error;
      }

      try {
        user = await syncUserProfile({ email: session.user?.email || null });
      } catch (syncError) {
        if (!isProfileConsentRequiredError(syncError)) {
          throw syncError;
        }

        return {
          success: false,
          requiresProfileCompletion: true,
          profileSetup: await getPendingProfileSetup({ email: session.user?.email || null })
        };
      }
    }

    return {
      success: true,
      user
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to load current user')
    };
  }
};

/**
 * Refresh authentication token
 */
export const refreshAuthToken = async () => {
  try {
    await refreshSupabaseSession();
    await addTokenToHeaders();

    return {
      success: true,
      token: await getAccessToken()
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to refresh token')
    };
  }
};

/**
 * Logout user
 */
export const logoutUser = async () => {
  try {
    await signOutFromSupabase();
    await SecureStorage.logout();
    removeTokenFromHeaders();

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export const submitSupportRequest = async ({ name = '', email, subject, message, source = 'mobile_support' }) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post('/support/requests', {
      name,
      email,
      subject,
      message,
      source
    });

    return {
      success: true,
      supportRequest: response.data.supportRequest || null
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to submit support request')
    };
  }
};

export const deleteAccount = async ({ reason = '', source = 'mobile_settings' } = {}) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.delete('/support/account', {
      data: {
        reason,
        source
      }
    });

    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to delete account')
    };
  }
};

// ============= CALLS API =============

/**
 * Get all calls for user
 */
export const getCalls = async (limit = 50, offset = 0) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.get('/calls', {
      params: { limit, offset }
    });

    return {
      success: true,
      calls: response.data.calls,
      total: response.data.total
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to load calls')
    };
  }
};

export const deleteCall = async (callId) => {
  try {
    await addTokenToHeaders();
    await apiClient.delete(`/calls/${callId}`);

    return {
      success: true
    };
  } catch (error) {
    logApiFailure('delete', `/calls/${callId}`, error);
    return {
      success: false,
      error: formatApiError(error, 'Failed to delete transcript')
    };
  }
};

/**
 * Get a specific call with transcript
 */
export const getCallDetail = async (callId) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.get(`/calls/${callId}`);

    return {
      success: true,
      call: response.data.call
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to load call details')
    };
  }
};

/**
 * Get Twilio Voice SDK token for in-app VoIP calling
 */
export const getVoiceToken = async () => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post('/voice/token');

    return {
      success: true,
      token: response.data.token,
      identity: response.data.identity,
      ttl: response.data.ttl,
      billing: response.data.billing || null
    };
  } catch (error) {
    const responseData = error.response?.data || {};

    return {
      success: false,
      error: responseData.error || error.message,
      code: responseData.code || null,
      billing: responseData.billing || null,
      statusCode: error.response?.status || null
    };
  }
};

export const getBillingStatus = async () => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.get('/billing/status');

    return {
      success: true,
      billing: response.data.billing
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to fetch voice token')
    };
  }
};

export const importReaderDocument = async (fileAsset) => {
  try {
    const token = await getAccessToken();

    if (!token) {
      return {
        success: false,
        error: 'You need to log in again before importing a document.'
      };
    }

    const formData = new FormData();
    formData.append('document', {
      uri: fileAsset.uri,
      name: fileAsset.name || 'document',
      type: fileAsset.mimeType || 'application/octet-stream'
    });

    const response = await axios.post(`${API_BASE_URL}/reader/extract`, formData, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    return {
      success: true,
      title: response.data.title,
      text: response.data.text,
      metadata: response.data.metadata || null
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to import document')
    };
  }
};

export const uploadListenModeRecording = async (recordingAsset, languagePreference = 'en') => {
  try {
    const token = await getAccessToken();

    if (!token) {
      return {
        success: false,
        error: 'You need to log in again before using Listen Mode.'
      };
    }

    const formData = new FormData();
    formData.append('audio', {
      uri: recordingAsset.uri,
      name: recordingAsset.name || 'listen-mode.m4a',
      type: recordingAsset.mimeType || 'audio/mp4'
    });
    formData.append('durationMs', String(recordingAsset.durationMs || 0));
    formData.append('startedAt', recordingAsset.startedAt || new Date().toISOString());
    formData.append('endedAt', recordingAsset.endedAt || new Date().toISOString());
    formData.append('languagePreference', languagePreference || 'en');

    const response = await axios.post(`${API_BASE_URL}/listen/sessions`, formData, {
      timeout: 120000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    return {
      success: true,
      callId: response.data.callId,
      transcript: response.data.transcript || '',
      summary: response.data.summary || '',
      keyPoints: response.data.keyPoints || [],
      actionItems: response.data.actionItems || []
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to process Listen Mode recording')
    };
  }
};

/**
 * End an active call
 */
export const endCall = async (callId) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post(`/calls/${callId}/end`);

    return {
      success: true,
      call: response.data.call
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Get transcript for a call
 */
export const getTranscript = async (callId) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.get(`/calls/${callId}/transcript`);

    return {
      success: true,
      transcript: response.data.transcript
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Get summary for a call
 */
export const getCallSummary = async (callId) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.get(`/calls/${callId}/summary`);

    return {
      success: true,
      summary: response.data.summary
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

// ============= NOTES API =============

/**
 * Get all notes for user
 */
export const getNotes = async (topic = null, limit = 50, offset = 0) => {
  try {
    await addTokenToHeaders();
    const params = { limit, offset };
    if (topic) {
      params.topic = topic;
    }

    const response = await apiClient.get('/notes', { params });

    return {
      success: true,
      notes: response.data.notes,
      total: response.data.total
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Get a specific note
 */
export const getNote = async (noteId) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.get(`/notes/${noteId}`);

    return {
      success: true,
      note: response.data.note
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Get all topics
 */
export const getTopics = async () => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.get('/notes/topics');

    return {
      success: true,
      topics: response.data.topics
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Create a new note
 */
export const createNote = async (title, content, topic = null) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post('/notes', {
      title,
      content,
      topic
    });

    return {
      success: true,
      note: response.data.note
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Update a note
 */
export const updateNote = async (noteId, title, content, topic = null) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.put(`/notes/${noteId}`, {
      title,
      content,
      topic
    });

    return {
      success: true,
      note: response.data.note
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Delete a note
 */
export const deleteNote = async (noteId) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.delete(`/notes/${noteId}`);

    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Create note from call transcript
 */
export const createNoteFromCall = async (callId, title = null) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post(`/notes/from-call/${callId}`, {
      title
    });

    return {
      success: true,
      note: response.data.note
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

// ============= UTILITY FUNCTIONS =============

/**
 * Initialize API client with saved token on app startup
 */
export const initializeAPIClient = async () => {
  try {
    const session = await getSession();
    if (session) {
      await addTokenToHeaders();
      const result = await getCurrentUser();
      if (!result.success) {
        await refreshAuthToken();
      }
    } else {
      removeTokenFromHeaders();
    }
    return true;
  } catch (error) {
    console.error('Error initializing API client:', error);
    return false;
  }
};

/**
 * Set API base URL (useful for different environments)
 */
export const setAPIBaseURL = (url) => {
  apiClient = createClient();
  apiClient.defaults.baseURL = url;
};

/**
 * Get current API base URL
 */
export const getAPIBaseURL = () => {
  return apiClient.defaults.baseURL;
};

export default {
  // Auth
  registerUser,
  loginUser,
  beginSocialOAuth,
  completeAuthenticatedUserProfile,
  getCurrentUser,
  refreshAuthToken,
  logoutUser,

  // Calls
  getCalls,
  deleteCall,
  getCallDetail,
  getVoiceToken,
  endCall,
  getTranscript,
  getCallSummary,

  // Notes
  getNotes,
  getNote,
  getTopics,
  createNote,
  updateNote,
  deleteNote,
  createNoteFromCall,

  // Utility
  initializeAPIClient,
  setAPIBaseURL,
  getAPIBaseURL
};
