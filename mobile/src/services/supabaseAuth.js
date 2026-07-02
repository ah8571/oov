import { AppState } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_STORAGE_KEY = 'emmaline_supabase_session';

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const storageAdapter = {
  getItem: async (key) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    await SecureStore.setItemAsync(key, value);
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
    throw error;
  }

  return data;
};

export const getOAuthRedirectUrl = () => AuthSession.makeRedirectUri({
  scheme: 'emmaline',
  path: 'auth/callback'
});

export const startOAuthSignIn = async ({ provider, scopes, queryParams } = {}) => {
  const { data, error } = await getClient().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getOAuthRedirectUrl(),
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
