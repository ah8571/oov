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
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';

import { beginSocialOAuth, completeAuthenticatedUserProfile, loginUser, loginWithSocialProvider, registerUser } from '../services/api.js';
import { getOAuthRedirectUrl } from '../services/supabaseAuth.js';

WebBrowser.maybeCompleteAuthSession();

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
  const showingPendingProfileSetup = Boolean(activePendingProfileSetup?.email);

  useEffect(() => {
    if (pendingProfileSetup?.email) {
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

    try {
      const response = await loginWithSocialProvider({
        mode: socialMode,
        provider,
        idToken,
        redirectUrl,
        email: socialEmail,
        fullName: socialFullName,
        marketingOptIn,
        termsAccepted: acceptedRequiredTerms,
        privacyAccepted: acceptedRequiredTerms
      });

      if (!response.success) {
        if (response.requiresProfileCompletion) {
          setLocalPendingProfileSetup(response.profileSetup || null);
          return;
        }

        setError(response.error || `${provider} sign-in failed`);
        return;
      }

      onLoginSuccess(response.user);
    } catch (err) {
      setError(err.message || `${provider} sign-in failed`);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialOAuth = async ({ provider, scopes, queryParams, unavailableMessage }) => {
    setError('');

    setLoading(true);

    try {
      const oauthStart = await beginSocialOAuth({ provider, scopes, queryParams });

      if (!oauthStart.success || !oauthStart.url) {
        setError(oauthStart.error || unavailableMessage || `${provider} sign-in failed`);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        oauthStart.url,
        getOAuthRedirectUrl()
      );

      if (result.type !== 'success' || !result.url) {
        if (result.type !== 'cancel') {
          setError(unavailableMessage || `${provider} sign-in failed`);
        }
        return;
      }

      await completeSocialLogin({
        provider,
        redirectUrl: result.url
      });
    } catch (err) {
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

    try {
      await handleSocialOAuth({
        provider: 'apple',
        scopes: 'name email',
        unavailableMessage: 'Apple sign-in failed'
      });
    } catch (err) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }

      setError(err.message || 'Apple sign-in failed');
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

    try {
      const response = await completeAuthenticatedUserProfile({
        marketingOptIn,
        termsAccepted: acceptedRequiredTerms,
        privacyAccepted: acceptedRequiredTerms,
        email: activePendingProfileSetup?.email || null,
        fullName: activePendingProfileSetup?.fullName || null
      });

      if (!response.success) {
        setError(response.error || 'Unable to finish creating your account.');
        return;
      }

      setLocalPendingProfileSetup(null);
      onLoginSuccess(response.user);
    } catch (err) {
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
          {showingPendingProfileSetup ? (
            <View style={styles.pendingSetupCard}>
              <Text style={styles.pendingSetupTitle}>Finish creating your account</Text>
              <Text style={styles.pendingSetupText}>
                You signed in with {activePendingProfileSetup?.provider === 'google' ? 'Google' : activePendingProfileSetup?.provider === 'apple' ? 'Apple' : 'your provider'}, but your Emmaline account is not set up yet.
              </Text>
              {activePendingProfileSetup?.email ? (
                <Text style={styles.pendingSetupEmail}>{activePendingProfileSetup.email}</Text>
              ) : null}
              <Text style={styles.pendingSetupText}>
                Confirm the required terms below, then we will finish creating your Emmaline account.
              </Text>
            </View>
          ) : null}

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
              <View style={styles.consentItem}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => {
                    setAcceptedRequiredTerms((current) => !current);
                    setError('');
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
  pendingSetupCard: {
    borderWidth: 1,
    borderColor: 'rgba(245, 247, 250, 0.18)',
    borderRadius: 12,
    backgroundColor: 'rgba(245, 247, 250, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
    gap: 8
  },
  pendingSetupTitle: {
    color: '#f5f7fa',
    fontSize: 16,
    fontWeight: '700'
  },
  pendingSetupText: {
    color: '#d6dbe1',
    fontSize: 12,
    lineHeight: 18
  },
  pendingSetupEmail: {
    color: '#f5f7fa',
    fontSize: 13,
    fontWeight: '600'
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
  consentGroup: {
    gap: 12,
    marginBottom: 4
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
