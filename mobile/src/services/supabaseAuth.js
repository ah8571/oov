import { AppState, Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_STORAGE_KEY = 'emmaline_supabase_session';
const SUPABASE_STORAGE_WARNING_THRESHOLD = 1800;
const OAUTH_REDIRECT_PATH = 'auth/callback';
const OAUTH_BROWSER_REDIRECT_URL = String(
  process.env.EXPO_PUBLIC_OAUTH_BROWSER_REDIRECT_URL || 'https://oov.digital/auth/callback'
).trim();

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let lastHandledOAuthRedirectUrl = null;

const pickDefinedEntries = (entries) => {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined && value !== null));
};

const compactAuthUserMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  return pickDefinedEntries([
    ['email', metadata.email],
    ['full_name', metadata.full_name],
    ['name', metadata.name],
    ['terms_accepted_at', metadata.terms_accepted_at],
    ['privacy_accepted_at', metadata.privacy_accepted_at],
    ['term_and_privacy_accepted_at', metadata.term_and_privacy_accepted_at],
    ['marketing_opt_in', typeof metadata.marketing_opt_in === 'boolean' ? metadata.marketing_opt_in : undefined],
    ['marketing_consent_at', metadata.marketing_consent_at]
  ]);
};

const compactAuthAppMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  return pickDefinedEntries([
    ['provider', metadata.provider],
    ['providers', Array.isArray(metadata.providers) ? metadata.providers : undefined]
  ]);
};

const sanitizeStoredAuthUser = (user) => {
  if (!user || typeof user !== 'object') {
    return user;
  }

  return pickDefinedEntries([
    ['id', user.id],
    ['email', user.email],
    ['phone', user.phone],
    ['aud', user.aud],
    ['role', user.role],
    ['app_metadata', compactAuthAppMetadata(user.app_metadata)],
    ['user_metadata', compactAuthUserMetadata(user.user_metadata)]
  ]);
};

const sanitizeStoredSession = (session) => {
  if (!session || typeof session !== 'object') {
    return session;
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: sanitizeStoredAuthUser(session.user)
  };
};

const sanitizeSupabaseStorageValue = (key, value) => {
  if (key !== SUPABASE_STORAGE_KEY || typeof value !== 'string') {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    const sanitized = sanitizeStoredSession(parsed);
    let serialized = JSON.stringify(sanitized);

    if (serialized.length <= SUPABASE_STORAGE_WARNING_THRESHOLD) {
      return serialized;
    }

    serialized = JSON.stringify({
      access_token: sanitized.access_token,
      refresh_token: sanitized.refresh_token,
      expires_at: sanitized.expires_at,
      expires_in: sanitized.expires_in,
      token_type: sanitized.token_type,
      user: pickDefinedEntries([
        ['id', sanitized.user?.id],
        ['email', sanitized.user?.email]
      ])
    });

    return serialized;
  } catch {
    return value;
  }
};

const storageAdapter = {
  getItem: async (key) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    await SecureStore.setItemAsync(key, sanitizeSupabaseStorageValue(key, value));
  },
  removeItem: async (key) => {
    await SecureStore.deleteItemAsync(key);
  }
};

const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: storageAdapter,
        storageKey: SUPABASE_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;

let appStateSubscription = null;

const getClient = () => {
  if (!supabase) {
    throw new Error('Supabase auth is not configured. Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return supabase;
};

export const initializeSupabaseAuth = () => {
  const client = getClient();

  if (!appStateSubscription) {
    if (AppState.currentState === 'active') {
      client.auth.startAutoRefresh();
    }

    appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    });
  }

  return () => {
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }

    client.auth.stopAutoRefresh();
  };
};

export const getSupabaseClient = () => getClient();

export const getSession = async () => {
  const { data, error } = await getClient().auth.getSession();

  if (error) {
    throw error;
  }

  return data.session || null;
};

export const getAccessToken = async () => {
  const session = await getSession();
  return session?.access_token || null;
};

export const hasSession = async () => {
  return Boolean(await getSession());
};

export const signUpWithPassword = async ({
  email,
  password,
  marketingOptIn = false,
  termsAccepted = false,
  privacyAccepted = false
}) => {
  const consentAcceptedAt = (termsAccepted && privacyAccepted)
    ? new Date().toISOString()
    : null;

  const { data, error } = await getClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        marketing_opt_in: Boolean(marketingOptIn),
        marketing_consent_at: marketingOptIn ? new Date().toISOString() : null,
        term_and_privacy_accepted_at: consentAcceptedAt,
        terms_accepted_at: consentAcceptedAt,
        privacy_accepted_at: consentAcceptedAt
      }
    }
  });

  if (error) {
    throw error;
  }

  if (data.session) {
    return data;
  }

  const loginResult = await signInWithPassword({ email, password });
  return loginResult;
};

export const signInWithPassword = async ({ email, password }) => {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return data;
};

export const signInWithIdToken = async ({ provider, idToken }) => {
  const { data, error } = await getClient().auth.signInWithIdToken({
    provider,
    token: idToken
  });

  if (error) {
    Sentry.captureException(error, {
      tags: {
        area: 'supabase_sign_in_with_id_token',
        provider: provider || 'unknown'
      },
      extra: {
        hasIdToken: Boolean(idToken),
        errorName: error?.name || null,
        errorCode: error?.code || null,
        errorStatus: error?.status || null
      }
    });
    throw error;
  }

  return data;
};

export const getOAuthRedirectUrl = () => AuthSession.makeRedirectUri({
  scheme: 'oov',
  path: OAUTH_REDIRECT_PATH
});

export const getOAuthBrowserRedirectUrl = () => OAUTH_BROWSER_REDIRECT_URL;

export const isOAuthRedirectUrl = (redirectUrl) => {
  const urlString = String(redirectUrl || '').trim().toLowerCase();

  if (!urlString.startsWith('oov://')) {
    return false;
  }

  return urlString.startsWith('oov://auth') || urlString.startsWith(getOAuthRedirectUrl().toLowerCase());
};

export const startOAuthSignIn = async ({ provider, scopes, queryParams } = {}) => {
  // On Android use the app scheme directly so the browser redirects back to
  // the app without going through oov.digital/auth/callback (which can fail
  // during backend deploys or if the website route is misconfigured).
  const redirectTo = Platform.OS === 'android'
    ? getOAuthRedirectUrl()
    : getOAuthBrowserRedirectUrl();
  console.log('[AuthFlow] startOAuthSignIn:redirectTo', { provider, redirectTo });

  const { data, error } = await getClient().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      scopes,
      skipBrowserRedirect: true,
      queryParams
    }
  });

  if (error || !data?.url) {
    throw error || new Error(`Unable to start ${provider} sign-in`);
  }

  return data;
};

const parseOAuthCallbackParams = (redirectUrl) => {
  const urlString = String(redirectUrl || '');
  const [beforeHash = '', fragmentPart = ''] = urlString.split('#', 2);
  const [, queryPart = ''] = beforeHash.split('?', 2);
  const queryParams = new URLSearchParams(queryPart || '');
  const fragmentParams = new URLSearchParams(fragmentPart || '');

  return {
    code: queryParams.get('code') || fragmentParams.get('code') || null,
    accessToken: queryParams.get('access_token') || fragmentParams.get('access_token') || null,
    refreshToken: queryParams.get('refresh_token') || fragmentParams.get('refresh_token') || null
  };
};

export const exchangeCodeForSession = async (redirectUrl) => {
  const { code, accessToken, refreshToken } = parseOAuthCallbackParams(redirectUrl);

  console.log('[AuthFlow] exchangeCodeForSession:params', {
    hasCode: Boolean(code),
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken)
  });

  if (code) {
    const { data, error } = await getClient().auth.exchangeCodeForSession(code);

    if (error || !data?.session) {
      throw error || new Error('Unable to complete social sign-in');
    }

    return data;
  }

  if (accessToken && refreshToken) {
    const { data, error } = await getClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error || !data?.session) {
      throw error || new Error('Unable to complete social sign-in');
    }

    return data;
  }

  const { data: existingSessionData, error: existingSessionError } = await getClient().auth.getSession();

  if (!existingSessionError && existingSessionData?.session) {
    return existingSessionData;
  }

  throw new Error('OAuth callback did not include an auth code or session tokens.');
};

export const handleOAuthRedirect = async (redirectUrl) => {
  const normalizedUrl = String(redirectUrl || '').trim();

  if (!normalizedUrl || !isOAuthRedirectUrl(normalizedUrl)) {
    return false;
  }

  console.log('[AuthFlow] handleOAuthRedirect:start', {
    url: normalizedUrl,
    alreadyHandled: normalizedUrl === lastHandledOAuthRedirectUrl
  });

  if (normalizedUrl === lastHandledOAuthRedirectUrl) {
    return true;
  }

  await exchangeCodeForSession(normalizedUrl);
  lastHandledOAuthRedirectUrl = normalizedUrl;
  console.log('[AuthFlow] handleOAuthRedirect:completed');
  return true;
};

export const refreshSession = async () => {
  const { data, error } = await getClient().auth.refreshSession();

  if (error) {
    throw error;
  }

  return data.session || null;
};

export const signOut = async () => {
  const { error } = await getClient().auth.signOut();

  if (error) {
    throw error;
  }
};

export const onAuthStateChange = (callback) => {
  return getClient().auth.onAuthStateChange(callback);
};
