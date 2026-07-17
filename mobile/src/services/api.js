/**
 * API client service for Emmaline mobile app
 * Handles all HTTP requests to the backend with automatic token management
 */

import axios from 'axios';
import appsFlyer from 'react-native-appsflyer';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
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
const DEFAULT_API_BASE_URL = 'https://api.emmaline.app/api';
const DEVELOPMENT_API_BASE_URL = 'http://127.0.0.1:3000/api';
const appConfigExtra =
  Constants.expoConfig?.extra ||
  Constants.manifest2?.extra?.expoClient?.extra ||
  Constants.manifest?.extra ||
  {};
const appVariant = String(appConfigExtra.appVariant || '').trim().toLowerCase();
const isDevelopmentVariant = appVariant === 'development';
const isLocalDevelopmentRuntime = __DEV__;

const normalizeApiBaseUrl = (url) => {
  const normalizedUrl = String(url || '').trim();

  if (!normalizedUrl) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);

    if (parsedUrl.hostname === 'api.emmaine.app') {
      parsedUrl.hostname = 'api.emmaline.app';
    } else if (parsedUrl.hostname === 'emmaine.app') {
      parsedUrl.hostname = 'emmaline.app';
    }

    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/api';

    return parsedUrl.toString().replace(/\/+$/, '');
  } catch (error) {
    return normalizedUrl.replace('api.emmaine.app', 'api.emmaline.app').replace('emmaine.app', 'emmaline.app').replace(/\/+$/, '');
  }
};

const isLoopbackApiUrl = (url) => {
  const normalizedUrl = String(url || '').trim();

  if (!normalizedUrl) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return ['127.0.0.1', 'localhost', '10.0.2.2'].includes(parsedUrl.hostname);
  } catch (error) {
    return normalizedUrl.includes('127.0.0.1') || normalizedUrl.includes('localhost') || normalizedUrl.includes('10.0.2.2');
  }
};

const getConfiguredApiBaseUrl = () => {
  const configCandidates = [
    appConfigExtra.apiUrl,
    process.env.EXPO_PUBLIC_API_URL,
    process.env.REACT_NATIVE_BACKEND_URL,
    process.env.REACT_APP_API_URL
  ].filter(Boolean);

  // If an explicit API URL is configured (e.g. via EAS build profile), use it.
  // Only fall back to the local dev URL when running a pure local dev build
  // with no remote API configured.
  if (configCandidates.length > 0) {
    return configCandidates[0];
  }

  if (isDevelopmentVariant || isLocalDevelopmentRuntime) {
    return DEVELOPMENT_API_BASE_URL;
  }

  return DEFAULT_API_BASE_URL;
};

const configuredApiBaseUrl = getConfiguredApiBaseUrl();

const API_BASE_URL = normalizeApiBaseUrl(configuredApiBaseUrl);
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

    // Best-effort: notify AppsFlyer about a registration event for SKAN/attribution mapping
    try {
      if (appsFlyer && typeof appsFlyer.logEvent === 'function') {
        appsFlyer.logEvent('registration', { method: 'email' }, (res) => {}, (err) => {});
      }
    } catch (e) {
      // Non-fatal: continue even if AppsFlyer logging fails
      console.warn('AppsFlyer registration event failed', e?.message || e);
    }

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
    if (provider === 'apple') {
      Sentry.captureMessage('Apple social login: starting session completion.', {
        level: 'info',
        tags: {
          area: 'social_auth_api',
          provider: 'apple'
        },
        extra: {
          mode,
          hasRedirectUrl: Boolean(redirectUrl),
          hasIdToken: Boolean(idToken),
          hasEmail: Boolean(email),
          hasFullName: Boolean(fullName)
        }
      });
    }

    if (redirectUrl) {
      await exchangeSupabaseOAuthCode(redirectUrl);
    } else {
      await signInWithSupabaseIdToken({
        provider,
        idToken
      });
    }

    if (provider === 'apple') {
      Sentry.captureMessage('Apple social login: Supabase session created.', {
        level: 'info',
        tags: {
          area: 'social_auth_api',
          provider: 'apple'
        },
        extra: {
          mode
        }
      });
    }

    await addTokenToHeaders();
    let user;

    try {
      if (provider === 'apple') {
        Sentry.captureMessage('Apple social login: fetching backend profile.', {
          level: 'info',
          tags: {
            area: 'social_auth_api',
            provider: 'apple'
          },
          extra: {
            mode
          }
        });
      }

      user = await fetchCurrentUserProfile();

      if (provider === 'apple') {
        Sentry.captureMessage('Apple social login: backend profile loaded.', {
          level: 'info',
          tags: {
            area: 'social_auth_api',
            provider: 'apple'
          },
          extra: {
            mode,
            hasAcceptedLegalConsent: user?.hasAcceptedLegalConsent ?? null
          }
        });
      }

      if (user && user.hasAcceptedLegalConsent === false) {
        if (!termsAccepted || !privacyAccepted) {
          if (provider === 'apple') {
            Sentry.captureMessage('Apple social login: profile completion required after backend profile load.', {
              level: 'info',
              tags: {
                area: 'social_auth_api',
                provider: 'apple'
              },
              extra: {
                mode
              }
            });
          }

          return {
            success: false,
            requiresProfileCompletion: true,
            profileSetup: await getPendingProfileSetup({ provider, email, fullName })
          };
        }

        user = await syncUserProfile({
          marketingOptIn,
          termsAccepted,
          privacyAccepted,
          email,
          fullName
        });
      }
    } catch (error) {
      if (!isMissingProfileError(error)) {
        throw error;
      }

      if (provider === 'apple') {
        Sentry.captureMessage('Apple social login: backend profile missing, deciding whether to create profile.', {
          level: 'info',
          tags: {
            area: 'social_auth_api',
            provider: 'apple'
          },
          extra: {
            mode,
            termsAccepted,
            privacyAccepted
          }
        });
      }

      if (!termsAccepted || !privacyAccepted) {
        return {
          success: false,
          requiresProfileCompletion: true,
          profileSetup: await getPendingProfileSetup({ provider, email, fullName }),
          error: mode === 'create' ? 'Finish creating your Emmaline account to continue.' : null
        };
      }

      user = await syncUserProfile({
        marketingOptIn,
        termsAccepted,
        privacyAccepted,
        email,
        fullName
      });
    }

    return {
      success: true,
      user,
      token: await getAccessToken()
    };
  } catch (error) {
    logApiFailure('post', '/auth/profile/sync', error);

    Sentry.captureException(error, {
      tags: {
        area: 'social_auth_api',
        provider: provider || 'unknown'
      },
      extra: {
        mode,
        hasRedirectUrl: Boolean(redirectUrl),
        hasIdToken: Boolean(idToken),
        hasEmail: Boolean(email),
        hasFullName: Boolean(fullName),
        responseStatus: error?.response?.status || null,
        responseData: error?.response?.data || null
      }
    });

    if (isProfileConsentRequiredError(error)) {
      return {
        success: false,
        requiresProfileCompletion: true,
        profileSetup: await getPendingProfileSetup({ provider, email, fullName }),
        error: 'Finish creating your Emmaline account to continue.'
      };
    }

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
      message: response.data.message || '',
      supportRequest: response.data.supportRequest || null,
      emailDelivery: response.data.emailDelivery || null
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
 * Get a provider-specific voice mode session for in-app audio.
 */
export const submitVoiceCallCompletion = async ({ durationSeconds, voice, model } = {}) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post('/voice/call/complete', {
      durationSeconds: Math.round(Number(durationSeconds || 0)),
      voice: String(voice || 'marin'),
      model: String(model || 'gpt-realtime-2.1')
    });

    return {
      success: true,
      callId: response.data.callId || null,
      estimatedCostUsd: response.data.estimatedCostUsd || null,
      billing: response.data.billing || null
    };
  } catch (error) {
    return {
      success: false,
      error: error?.response?.data?.error || error.message
    };
  }
};

export const getVoiceSession = async () => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post('/voice/session');

    return {
      success: true,
      provider: response.data.provider || response.data.session?.provider || null,
      transport: response.data.transport || response.data.session?.transport || null,
      session: response.data.session || null,
      token: response.data.token || response.data.session?.token || null,
      identity: response.data.identity || response.data.session?.identity || null,
      ttl: response.data.ttl || response.data.session?.ttl || null,
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

/**
 * Backward-compatible alias for older Twilio-specific callers.
 */
export const getVoiceToken = async () => {
  return getVoiceSession();
};

export const createGrokVoiceSession = async (options = {}) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post('/voice/grok/session', {
      voice: String(options.voice || 'eve').trim() || 'eve'
    });

    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Unable to start Grok voice session.')
    };
  }
};

export const createGeminiVoiceSession = async (options = {}) => {
  try {
    await addTokenToHeaders();
    const response = await apiClient.post('/voice/gemini/session', {
      model: String(options.model || '').trim() || null
    });

    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Unable to start Gemini voice session.')
    };
  }
};

export const createVoiceCallConnection = async (offerSdp, options = {}) => {
  try {
    const token = await getAccessToken();
    logApiRequest('post', '/voice/call', {
      voice: String(options.voice || '').trim() || null,
      apiBaseUrl: API_BASE_URL,
      offerLength: typeof offerSdp === 'string' ? offerSdp.length : 0
    });
    const response = await fetch(`${API_BASE_URL}/voice/call`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/sdp',
        Accept: 'application/sdp',
        ...(String(options.voice || '').trim() ? { 'X-Emmaline-Voice': String(options.voice || '').trim() } : {})
      },
      body: typeof offerSdp === 'string' ? offerSdp : ''
    });

    const responseText = await response.text();

    if (!response.ok) {
      let responseData = null;

      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = null;
      }

      const requestError = new Error(responseData?.error || response.statusText || 'Voice call setup failed.');
      requestError.response = {
        status: response.status,
        data: responseData || responseText || null
      };
      throw requestError;
    }

    return {
      success: true,
      answerSdp: responseText
    };
  } catch (error) {
    logApiFailure('post', '/voice/call', error);
    const responseData = error.response?.data || {};
    const detailText = [responseData.error, responseData.details]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      success: false,
      error: detailText || error.message,
      code: responseData.code || null,
      details: responseData.details || null,
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
      billing: response.data.billing,
      credits: response.data.credits
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

    logApiRequest('post', '/reader/extract', {
      fileName: fileAsset.name || 'document',
      mimeType: fileAsset.mimeType || 'application/octet-stream'
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
    logApiFailure('post', '/reader/extract', error);
    return {
      success: false,
      error: formatApiError(error, 'Failed to import document')
    };
  }
};

export const generateReaderAudio = async ({ text, title, provider = null, voiceProfile = null, languagePreference = 'en', speechRate = 1 }) => {
  try {
    await addTokenToHeaders();
    logApiRequest('post', '/reader/audio', {
      title: title || null,
      provider: provider || null,
      voiceProfile: voiceProfile || null,
      languagePreference,
      speechRate,
      characterCount: String(text || '').trim().length
    });
    const response = await apiClient.post('/reader/audio', {
      text,
      title,
      provider,
      voiceProfile,
      languagePreference,
      speechRate
    });

    return {
      success: true,
      fileName: response.data.fileName,
      contentType: response.data.contentType,
      audioBase64: response.data.audioBase64,
      metadata: response.data.metadata || null
    };
  } catch (error) {
    logApiFailure('post', '/reader/audio', error);
    return {
      success: false,
      error: formatApiError(error, 'Failed to create reader audio')
    };
  }
};

export const saveReaderAudio = async ({ text, title, provider = null, voiceProfile = null, languagePreference = 'en', speechRate = 1 }) => {
  try {
    await addTokenToHeaders();
    logApiRequest('post', '/reader/audio/save', {
      title: title || null,
      provider: provider || null,
      voiceProfile: voiceProfile || null,
      languagePreference,
      speechRate,
      characterCount: String(text || '').trim().length
    });
    const response = await apiClient.post('/reader/audio/save', {
      text,
      title,
      provider,
      voiceProfile,
      languagePreference,
      speechRate
    });

    return {
      success: true,
      savedAudioId: response.data.savedAudioId,
      createdAt: response.data.createdAt,
      fileName: response.data.fileName,
      contentType: response.data.contentType,
      audioBase64: response.data.audioBase64,
      metadata: response.data.metadata || null
    };
  } catch (error) {
    logApiFailure('post', '/reader/audio/save', error);
    return {
      success: false,
      error: formatApiError(error, 'Failed to save reader audio')
    };
  }
};

export const getSavedReaderAudio = async () => {
  try {
    await addTokenToHeaders();
    logApiRequest('get', '/reader/audio/saved');
    const response = await apiClient.get('/reader/audio/saved');

    return {
      success: true,
      entries: Array.isArray(response.data?.entries) ? response.data.entries : []
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return {
        success: true,
        entries: [],
        unavailable: true
      };
    }

    logApiFailure('get', '/reader/audio/saved', error);
    return {
      success: false,
      error: formatApiError(error, 'Failed to load saved reader audio')
    };
  }
};

export const deleteSavedReaderAudio = async (savedAudioId) => {
  try {
    await addTokenToHeaders();
    logApiRequest('delete', `/reader/audio/saved/${savedAudioId}`);
    const response = await apiClient.delete(`/reader/audio/saved/${savedAudioId}`);

    return {
      success: true,
      deletedId: response.data?.deletedId || savedAudioId
    };
  } catch (error) {
    logApiFailure('delete', `/reader/audio/saved/${savedAudioId}`, error);
    return {
      success: false,
      error: formatApiError(error, 'Failed to delete saved reader audio')
    };
  }
};

export const updateSavedReaderAudio = async (savedAudioId, title) => {
  try {
    await addTokenToHeaders();
    logApiRequest('patch', `/reader/audio/saved/${savedAudioId}`, { title });
    const response = await apiClient.patch(`/reader/audio/saved/${savedAudioId}`, { title });

    return {
      success: true,
      savedAudioId: response.data?.savedAudioId || savedAudioId,
      title: response.data?.title || title,
      fileName: response.data?.fileName || null,
      updatedAt: response.data?.updatedAt || null
    };
  } catch (error) {
    logApiFailure('patch', `/reader/audio/saved/${savedAudioId}`, error);
    return {
      success: false,
      error: formatApiError(error, 'Failed to update saved reader audio')
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

export const submitVoiceTurn = async (recordingAsset, options = {}) => {
  try {
    const token = await getAccessToken();

    if (!token) {
      return {
        success: false,
        error: 'You need to log in again before using Voice Mode.'
      };
    }

    const formData = new FormData();
    formData.append('audio', {
      uri: recordingAsset.uri,
      name: recordingAsset.name || 'voice-mode-turn.m4a',
      type: recordingAsset.mimeType || 'audio/mp4'
    });
    formData.append('durationMs', String(recordingAsset.durationMs || 0));
    formData.append('startedAt', recordingAsset.startedAt || new Date().toISOString());
    formData.append('endedAt', recordingAsset.endedAt || new Date().toISOString());
    formData.append('languagePreference', options.languagePreference || 'en');
    formData.append('conversationHistory', JSON.stringify(Array.isArray(options.conversationHistory) ? options.conversationHistory : []));

    const response = await axios.post(`${API_BASE_URL}/voice/turn`, formData, {
      timeout: 120000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    return {
      success: true,
      transcript: response.data.transcript || '',
      assistantText: response.data.assistantText || '',
      conversationHistory: response.data.conversationHistory || [],
      audioBase64: response.data.audioBase64 || '',
      audioMimeType: response.data.audioMimeType || 'audio/mpeg'
    };
  } catch (error) {
    return {
      success: false,
      error: formatApiError(error, 'Failed to process Voice Mode turn')
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
  getVoiceSession,
  getVoiceToken,
  createVoiceCallConnection,
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
