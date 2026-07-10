import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';

import { beginSocialOAuth, completeAuthenticatedUserProfile, loginUser, loginWithSocialProvider, registerUser } from '../services/api.js';
import { getOAuthBrowserRedirectUrl, getOAuthRedirectUrl } from '../services/supabaseAuth.js';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_REDIRECT_TIMEOUT_MS = 120000;
const SOCIAL_LOGIN_TIMEOUT_MS = 20000;
const OAUTH_REDIRECT_DISMISS_GRACE_MS = 2500;

const withTimeout = (promise, timeoutMs, timeoutMessage) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const timeoutError = new Error(timeoutMessage);
      timeoutError.name = 'SocialAuthTimeoutError';
      reject(timeoutError);
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
};

const waitForOAuthRedirect = (redirectUrl, timeoutMs = OAUTH_REDIRECT_TIMEOUT_MS) => {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      subscription?.remove();

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      resolve(result);
    };

    const normalizedRedirectUrl = String(redirectUrl || '').toLowerCase();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const nextUrl = String(url || '');

      if (nextUrl.toLowerCase().startsWith(normalizedRedirectUrl)) {
        finish({ type: 'success', url: nextUrl, source: 'linking' });
      }
    });

    const timeoutId = setTimeout(() => {
      finish({ type: 'timeout', url: null, source: 'linking' });
    }, timeoutMs);
  });
};

const waitForOAuthRedirectAfterDismiss = (redirectResultPromise) => {
  return Promise.race([
    redirectResultPromise,
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({ type: 'dismiss', url: null, source: 'browser' });
      }, OAUTH_REDIRECT_DISMISS_GRACE_MS);
    })
  ]);
};

const logAuthFlow = (step, details = null) => {
  if (details === null || details === undefined) {
    console.log(`[AuthFlow] ${step}`);
    return;
  }

  console.log(`[AuthFlow] ${step}`, details);
};

const hasPendingProfileSetup = (profileSetup) => {
  if (!profileSetup || typeof profileSetup !== 'object') {
    return false;
  }

  return Boolean(profileSetup.email || profileSetup.provider || profileSetup.fullName);
};

const formatAppleFullName = (fullName) => {
  if (!fullName || typeof fullName !== 'object') {
    return null;
  }

  const parts = [fullName.givenName, fullName.familyName]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : null;
};

const formatProviderLabel = (provider) => {
  const normalizedProvider = String(provider || '').trim().toLowerCase();

  if (!normalizedProvider) {
    return 'Social';
  }

  return normalizedProvider.charAt(0).toUpperCase() + normalizedProvider.slice(1);
};

const formatAppleAuthErrorDetails = (error) => {
  if (!error) {
    return 'Unknown error.';
  }

  const details = [
    error?.message ? `Reason: ${error.message}` : null,
    error?.code ? `Code: ${error.code}` : null,
    error?.domain ? `Domain: ${error.domain}` : null,
    error?.name ? `Name: ${error.name}` : null
  ].filter(Boolean);

  return details.length > 0 ? details.join('\n') : 'Unknown error.';
};

const LoginScreen = ({ navigation, onLoginSuccess, pendingProfileSetup = null }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedRequiredTerms, setAcceptedRequiredTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [localPendingProfileSetup, setLocalPendingProfileSetup] = useState(null);
  const [appleAuthDebugMessage, setAppleAuthDebugMessage] = useState('');
  const [appleAuthDebugLevel, setAppleAuthDebugLevel] = useState('info');

  useEffect(() => {
    const loadAppleAvailability = async () => {
      if (Platform.OS !== 'ios') {
        setAppleAuthAvailable(false);
        return;
      }

      const available = await AppleAuthentication.isAvailableAsync();
      setAppleAuthAvailable(available);
    };

    loadAppleAvailability();
  }, []);

  const socialMode = isLogin ? 'login' : 'create';
  const activePendingProfileSetup = pendingProfileSetup || localPendingProfileSetup;
  const showingPendingProfileSetup = hasPendingProfileSetup(activePendingProfileSetup);

  const updateAppleAuthDebug = (message, level = 'info') => {
    setAppleAuthDebugMessage(String(message || ''));
    setAppleAuthDebugLevel(level);
  };

  const clearAppleAuthError = () => {
    setError((currentError) => (
      currentError.includes('Apple Sign In') || currentError.includes('Apple sign-in')
        ? ''
        : currentError
    ));
  };

  useEffect(() => {
    if (hasPendingProfileSetup(pendingProfileSetup)) {
      setLocalPendingProfileSetup(pendingProfileSetup);
      return;
    }

    setLocalPendingProfileSetup(null);
  }, [pendingProfileSetup]);

  useEffect(() => {
    if (!showingPendingProfileSetup) {
      return;
    }

    setIsLogin(false);
    setError('');
  }, [showingPendingProfileSetup]);

  const completeSocialLogin = async ({ provider, idToken = null, redirectUrl = null, socialEmail = null, socialFullName = null }) => {
    setLoading(true);
    setError('');

    if (provider === 'apple') {
      updateAppleAuthDebug('Apple credential received. Finishing the Emmaline session with Supabase and the backend.', 'info');
    }

    logAuthFlow('completeSocialLogin:start', {
      provider,
      hasRedirectUrl: Boolean(redirectUrl),
      mode: socialMode
    });

    try {
      const response = await withTimeout(
        loginWithSocialProvider({
          mode: socialMode,
          provider,
          idToken,
          redirectUrl,
          email: socialEmail,
          fullName: socialFullName,
          marketingOptIn,
          termsAccepted: acceptedRequiredTerms,
          privacyAccepted: acceptedRequiredTerms
        }),
        SOCIAL_LOGIN_TIMEOUT_MS,
        `${formatProviderLabel(provider)} sign-in timed out before Emmaline could finish the session.`
      );

      logAuthFlow('completeSocialLogin:response', {
        provider,
        success: Boolean(response?.success),
        requiresProfileCompletion: Boolean(response?.requiresProfileCompletion),
        hasUser: Boolean(response?.user),
        error: response?.error || null
      });

      if (!response.success) {
        if (response.requiresProfileCompletion) {
          logAuthFlow('completeSocialLogin:pendingProfileSetup', response.profileSetup || null);
          Sentry.captureMessage('Social sign-in requires profile completion.', {
            level: 'info',
            tags: {
              area: 'social_auth_profile_completion',
              provider
            },
            extra: {
              mode: socialMode,
              hasEmail: Boolean(response?.profileSetup?.email || socialEmail),
              hasFullName: Boolean(response?.profileSetup?.fullName || socialFullName)
            }
          });
          setLocalPendingProfileSetup(response.profileSetup || null);
          if (provider === 'apple') {
            updateAppleAuthDebug('Apple Sign In worked, but this account still needs consent/profile completion before the app can continue.', 'info');
          }
          setError('');
          return;
        }

        if (provider === 'apple') {
          updateAppleAuthDebug(`Apple Sign In reached Emmaline, but the app rejected the session: ${response.error || 'Unknown social-login response.'}`, 'error');
        }

        Sentry.captureMessage(response.error || `${provider} sign-in failed`, {
          level: 'error',
          tags: {
            area: 'social_auth',
            provider
          },
          extra: {
            mode: socialMode,
            hasRedirectUrl: Boolean(redirectUrl),
            hasIdToken: Boolean(idToken)
          }
        });

        setError(response.error || `${provider} sign-in failed`);
        return;
      }

      if (provider === 'apple') {
        updateAppleAuthDebug('Apple Sign In finished successfully and the Emmaline session is ready.', 'info');
      }

      onLoginSuccess(response.user);
    } catch (err) {
      if (err?.name === 'SocialAuthTimeoutError') {
        Sentry.captureMessage(err.message, {
          level: 'error',
          tags: {
            area: 'social_auth_timeout',
            provider
          },
          extra: {
            mode: socialMode,
            hasRedirectUrl: Boolean(redirectUrl),
            hasIdToken: Boolean(idToken)
          }
        });
      }

      if (provider === 'apple') {
        updateAppleAuthDebug(
          [
            'Apple Sign In failed while Emmaline was finishing the session.',
            `Reason: ${err?.message || 'Unknown error.'}`,
            `Error name: ${err?.name || 'Unknown'}`
          ].join('\n'),
          'error'
        );
      }

      Sentry.captureException(err, {
        tags: {
          area: 'social_auth',
          provider
        },
        extra: {
          mode: socialMode,
          hasRedirectUrl: Boolean(redirectUrl),
          hasIdToken: Boolean(idToken)
        }
      });
      setError(err.message || `${provider} sign-in failed`);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialOAuth = async ({ provider, scopes, queryParams, unavailableMessage }) => {
    setError('');

    setLoading(true);
    logAuthFlow('handleSocialOAuth:start', { provider, mode: socialMode });

    try {
      const redirectUrl = Platform.OS === 'android'
        ? getOAuthBrowserRedirectUrl()
        : getOAuthRedirectUrl();
      const oauthStart = await beginSocialOAuth({ provider, scopes, queryParams });
      logAuthFlow('handleSocialOAuth:oauthStart', {
        provider,
        success: Boolean(oauthStart?.success),
        hasUrl: Boolean(oauthStart?.url)
      });

      if (!oauthStart.success || !oauthStart.url) {
        setError(oauthStart.error || unavailableMessage || `${provider} sign-in failed`);
        return;
      }

      const redirectResultPromise = waitForOAuthRedirect(redirectUrl);
      let result = await Promise.race([
        WebBrowser.openAuthSessionAsync(oauthStart.url, redirectUrl),
        redirectResultPromise
      ]);

      if (result.type === 'dismiss') {
        result = await waitForOAuthRedirectAfterDismiss(redirectResultPromise);
      }

      logAuthFlow('handleSocialOAuth:result', result);

      if (result.type !== 'success' || !result.url) {
        if (Platform.OS === 'android' && result.type === 'dismiss') {
          logAuthFlow('handleSocialOAuth:awaitingAuthStateAfterDismiss', {
            provider,
            mode: socialMode
          });
          return;
        }

        if (result.type !== 'cancel') {
          setError(unavailableMessage || `${provider} sign-in failed`);
        }
        return;
      }

      if (result.source === 'linking') {
        try {
          const dismissResult = WebBrowser.dismissBrowser();

          if (dismissResult && typeof dismissResult.then === 'function') {
            await dismissResult;
          }
        } catch {
          // The browser may already be closed when the deep link resolves first.
        }
      }

      await completeSocialLogin({
        provider,
        redirectUrl: result.url
      });
    } catch (err) {
      logAuthFlow('handleSocialOAuth:error', err?.message || String(err));
      setError(err.message || unavailableMessage || `${provider} sign-in failed`);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      if (!email || !password) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      const response = isLogin
        ? await loginUser(email.trim().toLowerCase(), password)
        : await registerUser(email.trim().toLowerCase(), password, {
            marketingOptIn
          });

      if (response.requiresProfileCompletion) {
        setLocalPendingProfileSetup(response.profileSetup || null);
        return;
      }

      if (!response.success) {
        setError(response.error || 'Authentication failed');
        return;
      }

      onLoginSuccess(response.user);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    if (!appleAuthAvailable) {
      Alert.alert('Apple Sign In unavailable', 'Apple Sign In is only available on supported iOS builds.');
      return;
    }

    setLoading(true);
    setError('');
    updateAppleAuthDebug('Apple Sign In started. Waiting for Face ID or Touch ID confirmation.', 'info');

    Sentry.captureMessage('Apple sign-in started from login screen.', {
      level: 'info',
      tags: {
        area: 'apple_auth'
      },
      extra: {
        mode: socialMode,
        appleAuthAvailable
      }
    });

    try {
      logAuthFlow('handleAppleAuth:start', { mode: socialMode });

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });

      logAuthFlow('handleAppleAuth:credential', {
        hasIdentityToken: Boolean(credential?.identityToken),
        hasEmail: Boolean(credential?.email),
        hasFullName: Boolean(credential?.fullName)
      });

      Sentry.captureMessage('Apple credential returned to the login screen.', {
        level: 'info',
        tags: {
          area: 'apple_auth'
        },
        extra: {
          mode: socialMode,
          hasIdentityToken: Boolean(credential?.identityToken),
          hasEmail: Boolean(credential?.email),
          hasFullName: Boolean(credential?.fullName)
        }
      });

      updateAppleAuthDebug(
        [
          'Apple credential received.',
          `Identity token returned: ${credential?.identityToken ? 'yes' : 'no'}`,
          `Email returned: ${credential?.email ? 'yes' : 'no'}`,
          `Full name returned: ${credential?.fullName ? 'yes' : 'no'}`
        ].join('\n'),
        'info'
      );

      if (!credential?.identityToken) {
        Sentry.captureMessage('Apple sign-in did not return an identity token.', {
          level: 'error',
          tags: {
            area: 'apple_auth'
          },
          extra: {
            mode: socialMode,
            hasEmail: Boolean(credential?.email),
            hasFullName: Boolean(credential?.fullName)
          }
        });
        setError('Apple sign-in did not return an identity token. Apple approved the request, but no usable login token came back to the app.');
        updateAppleAuthDebug(
          [
            'Apple Sign In did not return an identity token.',
            `Email returned: ${credential?.email ? 'yes' : 'no'}`,
            `Full name returned: ${credential?.fullName ? 'yes' : 'no'}`
          ].join('\n'),
          'info'
        );
        return;
      }

      updateAppleAuthDebug('Apple credential looks valid. Emmaline is now creating the app session.', 'info');

      await completeSocialLogin({
        provider: 'apple',
        idToken: credential.identityToken,
        socialEmail: credential.email || null,
        socialFullName: formatAppleFullName(credential.fullName)
      });
    } catch (err) {
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') {
        const cancelDetails = formatAppleAuthErrorDetails(err);

        Sentry.captureMessage('Apple Sign In canceled before Emmaline could create the session.', {
          level: 'warning',
          tags: {
            area: 'apple_auth_cancel'
          },
          extra: {
            mode: socialMode,
            code: err?.code || null,
            domain: err?.domain || null,
            message: err?.message || null,
            name: err?.name || null,
            fullError: JSON.stringify(err, Object.getOwnPropertyNames(err || {}))
          }
        });

        updateAppleAuthDebug(
          [
            'Apple Sign In was canceled before Emmaline could create the session.',
            cancelDetails
          ].join('\n'),
          'info'
        );
        clearAppleAuthError();
        return;
      }

      logAuthFlow('handleAppleAuth:error', err?.message || String(err));
      Sentry.captureException(err, {
        tags: {
          area: 'apple_auth'
        },
        extra: {
          mode: socialMode
        }
      });
      const detailedError = [
        'Apple Sign In failed before Emmaline could finish the login.',
        `Reason: ${err?.message || 'Unknown error.'}`,
        err?.code ? `Code: ${err.code}` : null
      ].filter(Boolean).join('\n');
      updateAppleAuthDebug(detailedError, 'info');
      clearAppleAuthError();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    await handleSocialOAuth({
      provider: 'google',
      scopes: 'email profile',
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account'
      },
      unavailableMessage: 'Google sign-in failed'
    });
  };

  const handleCompletePendingProfileSetup = async () => {
    if (!acceptedRequiredTerms) {
      setError('You must agree to the Terms of Use and Privacy Policy to create an account.');
      return;
    }

    setLoading(true);
    setError('');
    logAuthFlow('handleCompletePendingProfileSetup:start', {
      hasEmail: Boolean(activePendingProfileSetup?.email),
      hasFullName: Boolean(activePendingProfileSetup?.fullName),
      marketingOptIn,
      acceptedRequiredTerms
    });

    try {
      const response = await completeAuthenticatedUserProfile({
        marketingOptIn,
        termsAccepted: acceptedRequiredTerms,
        privacyAccepted: acceptedRequiredTerms,
        email: activePendingProfileSetup?.email || null,
        fullName: activePendingProfileSetup?.fullName || null
      });

      logAuthFlow('handleCompletePendingProfileSetup:response', {
        success: Boolean(response?.success),
        hasUser: Boolean(response?.user),
        error: response?.error || null
      });

      if (!response.success) {
        setError(response.error || 'Unable to finish creating your account.');
        return;
      }

      setLocalPendingProfileSetup(null);
      onLoginSuccess(response.user);
    } catch (err) {
      logAuthFlow('handleCompletePendingProfileSetup:error', err?.message || String(err));
      setError(err.message || 'Unable to finish creating your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Emmaline</Text>
          <Text style={styles.subtitle}>Voice Assistant</Text>
        </View>

        <View style={styles.form}>
          {showingPendingProfileSetup ? null : (
            <View style={styles.socialGroup}>
              {appleAuthAvailable ? (
                <TouchableOpacity
                  style={[styles.socialButton, styles.appleButton, loading && styles.buttonDisabled]}
                  onPress={handleAppleAuth}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-apple" size={18} color="#050607" />
                  <Text style={styles.socialButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.socialButton, loading && styles.buttonDisabled]}
                onPress={handleGoogleAuth}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-google" size={18} color="#050607" />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.separatorRow}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>{showingPendingProfileSetup ? 'finish setup' : 'or use email'}</Text>
            <View style={styles.separatorLine} />
          </View>

          {showingPendingProfileSetup ? null : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#8f98a3"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />

              <View style={styles.passwordField}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Password"
                  placeholderTextColor="#8f98a3"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword((current) => !current)}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#b0b7c0"
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {showingPendingProfileSetup ? (
            <View style={styles.consentGroup}>
              <View style={styles.pendingSetupNotice}>
                <Text style={styles.pendingSetupTitle}>One more step</Text>
                <Text style={styles.pendingSetupText}>
                  Your {formatProviderLabel(activePendingProfileSetup?.provider)} sign-in worked. Confirm your consent preferences to finish creating your Emmaline account.
                </Text>
              </View>

              <View style={styles.consentItem}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => {
                    setAcceptedRequiredTerms((current) => !current);
                    if (!error.includes('Apple Sign In')) {
                      setError('');
                    }
                  }}
                  activeOpacity={0.85}
                  disabled={loading}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <View style={[styles.checkbox, acceptedRequiredTerms && styles.checkboxChecked]}>
                    {acceptedRequiredTerms ? <Ionicons name="checkmark" size={16} color="#050607" /> : null}
                  </View>
                  <Text style={styles.checkboxText}>
                    I agree to the Terms of Use and Privacy Policy.
                  </Text>
                </TouchableOpacity>

                <View style={styles.inlineLinksRow}>
                  <Text
                    style={styles.inlineLinkText}
                    onPress={() => navigation.navigate('TermsOfService')}
                  >
                    Terms of Use
                  </Text>
                  <Text style={styles.inlineLinkDivider}>•</Text>
                  <Text
                    style={styles.inlineLinkText}
                    onPress={() => navigation.navigate('PrivacyPolicy')}
                  >
                    Privacy Policy
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setMarketingOptIn((current) => !current)}
                activeOpacity={0.85}
                disabled={loading}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <View style={[styles.checkbox, marketingOptIn && styles.checkboxChecked]}>
                  {marketingOptIn ? <Ionicons name="checkmark" size={16} color="#050607" /> : null}
                </View>
                <Text style={styles.checkboxText}>Optional: email me the educational newsletter and product updates from Emmaline.</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={showingPendingProfileSetup ? handleCompletePendingProfileSetup : handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#050607" />
            ) : (
              <Text style={styles.buttonText}>
                {showingPendingProfileSetup ? 'Finish Creating Account' : isLogin ? 'Sign In' : 'Create Account with Email'}
              </Text>
            )}
          </TouchableOpacity>

          {showingPendingProfileSetup ? null : (
            <TouchableOpacity
              onPress={() => {
                setIsLogin(!isLogin);
                setError('');
                setAppleAuthDebugMessage('');
                setAppleAuthDebugLevel('info');
                setAcceptedRequiredTerms(false);
                setMarketingOptIn(false);
              }}
              disabled={loading}
            >
              <Text style={styles.toggleText}>
                {isLogin
                  ? "Don't have an account? Create one"
                  : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          )}

          {appleAuthDebugMessage ? (
            <View style={[
              styles.appleDebugCard,
              styles.appleDebugCardInfo
            ]}>
              <Text style={[
                styles.appleDebugTitle,
                styles.appleDebugTitleInfo
              ]}>
                Apple Sign In status
              </Text>
              <Text style={[
                styles.appleDebugText,
                styles.appleDebugTextInfo
              ]}>
                {appleAuthDebugMessage}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hands-free AI assistant for multitasking</Text>
          <Text style={styles.footerSubtext}>Call, talk, and organize your thoughts</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050607'
  },
  scrollView: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 56
  },
  header: {
    alignItems: 'center',
    marginTop: 20
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f5f7fa',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: '#b0b7c0'
  },
  form: {
    marginVertical: 32
  },
  socialGroup: {
    gap: 12,
    marginBottom: 20
  },
  socialButton: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: '#f5f7fa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16
  },
  appleButton: {
    backgroundColor: '#ffffff'
  },
  socialButtonText: {
    color: '#050607',
    fontSize: 15,
    fontWeight: '700'
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245, 247, 250, 0.16)'
  },
  separatorText: {
    color: '#8f98a3',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  input: {
    backgroundColor: '#050607',
    borderWidth: 1,
    borderColor: '#f5f7fa',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 14,
    color: '#f5f7fa'
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050607',
    borderWidth: 1,
    borderColor: '#f5f7fa',
    borderRadius: 10,
    marginBottom: 12,
    paddingLeft: 16
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 12,
    fontSize: 14,
    color: '#f5f7fa'
  },
  passwordToggle: {
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  errorText: {
    color: '#ff9aa8',
    fontSize: 12,
    marginBottom: 12,
    fontWeight: '500'
  },
  appleDebugCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    marginTop: 12
  },
  appleDebugCardInfo: {
    backgroundColor: 'rgba(245, 247, 250, 0.06)',
    borderColor: 'rgba(245, 247, 250, 0.14)'
  },
  appleDebugTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  appleDebugTitleInfo: {
    color: '#f5f7fa'
  },
  appleDebugText: {
    fontSize: 12,
    lineHeight: 18
  },
  appleDebugTextInfo: {
    color: '#d6dbe1'
  },
  consentGroup: {
    gap: 12,
    marginBottom: 4
  },
  pendingSetupNotice: {
    backgroundColor: 'rgba(245, 247, 250, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245, 247, 250, 0.14)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6
  },
  pendingSetupTitle: {
    color: '#f5f7fa',
    fontSize: 14,
    fontWeight: '700'
  },
  pendingSetupText: {
    color: '#d6dbe1',
    fontSize: 13,
    lineHeight: 19
  },
  consentItem: {
    gap: 8
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 44,
    paddingVertical: 4
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#f5f7fa',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: '#f5f7fa'
  },
  checkboxText: {
    flex: 1,
    color: '#d6dbe1',
    fontSize: 13,
    lineHeight: 20,
    paddingTop: 1
  },
  inlineLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 36
  },
  inlineLinkDivider: {
    color: '#8f98a3',
    fontSize: 12
  },
  inlineLinkText: {
    color: '#f5f7fa',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  linkText: {
    color: '#f5f7fa',
    fontSize: 12,
    fontWeight: '600'
  },
  button: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#050607',
    fontSize: 16,
    fontWeight: '600'
  },
  toggleText: {
    color: '#f5f7fa',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12
  },
  footer: {
    alignItems: 'center',
    marginTop: 24
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f7fa',
    marginBottom: 4
  },
  footerSubtext: {
    fontSize: 12,
    color: '#b0b7c0'
  }
});

export default LoginScreen;
