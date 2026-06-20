/**
 * API client service for Emmaline mobile app
 * Handles all HTTP requests to the backend with automatic token management
 */

import axios from 'axios';
import * as SecureStorage from '../utils/secureStorage.js';

// Configuration
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_NATIVE_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api';
const REQUEST_TIMEOUT = 30000; // 30 seconds

const formatApiError = (error, fallbackMessage) => {
  if (error.response?.data?.error) {
    return error.response.data.error;
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
  const token = await SecureStorage.getToken();
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
export const registerUser = async (email, password) => {
  try {
    logApiRequest('post', '/auth/register', { email });
    const response = await apiClient.post('/auth/register', { email, password });

    // Save token and user info
    await SecureStorage.saveToken(response.data.token);
    await SecureStorage.saveUser(response.data.user);
    await addTokenToHeaders();

    return {
      success: true,
      user: response.data.user,
      token: response.data.token
    };
  } catch (error) {
    logApiFailure('post', '/auth/register', error);
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
    logApiRequest('post', '/auth/login', { email });
    const response = await apiClient.post('/auth/login', { email, password });

    // Save token and user info
    await SecureStorage.saveToken(response.data.token);
    await SecureStorage.saveUser(response.data.user);
    await addTokenToHeaders();

    return {
      success: true,
      user: response.data.user,
      token: response.data.token
    };
  } catch (error) {
    logApiFailure('post', '/auth/login', error);
    return {
      success: false,
      error: formatApiError(error, 'Login failed')
    };
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.get('/auth/me');

    return {
      success: true,
      user: response.data.user
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
    await addTokenToHeaders();
    const response = await apiClient.post('/auth/refresh');

    // Update stored token
    await SecureStorage.saveToken(response.data.token);
    await addTokenToHeaders();

    return {
      success: true,
      token: response.data.token
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
    const isAuth = await SecureStorage.isAuthenticated();
    if (isAuth) {
      await addTokenToHeaders();
      // Verify token is still valid
      const result = await getCurrentUser();
      if (!result.success) {
        // Token invalid, try refreshing
        await refreshAuthToken();
      }
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
  getCurrentUser,
  refreshAuthToken,
  logoutUser,

  // Calls
  getCalls,
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
