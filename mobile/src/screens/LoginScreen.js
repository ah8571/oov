import React, { useState } from 'react';
import {
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

import legalContent from '../content/legalContent.json';
import { loginUser, registerUser } from '../services/api.js';

/**
 * LoginScreen
 * Initial authentication screen for users
 */
const LoginScreen = ({ navigation, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedRequiredTerms, setAcceptedRequiredTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('[Auth] Submit pressed', {
        mode: isLogin ? 'login' : 'register',
        email: email.trim().toLowerCase()
      });

      if (!email || !password) {
        console.warn('[Auth] Validation failed: missing email or password');
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      if (!isLogin && !acceptedRequiredTerms) {
        setError('You must agree to the Terms of Use and Privacy Policy to create an account.');
        setLoading(false);
        return;
      }

      const response = isLogin
        ? await loginUser(email.trim().toLowerCase(), password)
        : await registerUser(email.trim().toLowerCase(), password, {
            marketingOptIn,
            termsAccepted: acceptedRequiredTerms,
            privacyAccepted: acceptedRequiredTerms
          });

      console.log('[Auth] Response received', {
        success: response.success,
        error: response.error || null
      });

      if (!response.success) {
        setError(response.error || 'Authentication failed');
        return;
      }

      console.log('[Auth] Login success, handing user to app shell');
      onLoginSuccess(response.user);
    } catch (err) {
      console.error('[Auth] Unexpected exception', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Emmaline</Text>
          <Text style={styles.subtitle}>Voice Assistant</Text>
        </View>

        <View style={styles.form}>
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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!isLogin ? (
            <View style={styles.consentGroup}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAcceptedRequiredTerms((current) => !current)}
                activeOpacity={0.85}
                disabled={loading}
              >
                <View style={[styles.checkbox, acceptedRequiredTerms && styles.checkboxChecked]}>
                  {acceptedRequiredTerms ? <Ionicons name="checkmark" size={14} color="#050607" /> : null}
                </View>
                <Text style={styles.checkboxText}>{legalContent.consentText.required}</Text>
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')} disabled={loading}>
                  <Text style={styles.linkText}>Read Terms</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')} disabled={loading}>
                  <Text style={styles.linkText}>Read Privacy Policy</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setMarketingOptIn((current) => !current)}
                activeOpacity={0.85}
                disabled={loading}
              >
                <View style={[styles.checkbox, marketingOptIn && styles.checkboxChecked]}>
                  {marketingOptIn ? <Ionicons name="checkmark" size={14} color="#050607" /> : null}
                </View>
                <Text style={styles.checkboxText}>{legalContent.consentText.marketing}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#050607" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

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
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Hands-free AI assistant for multitasking
          </Text>
          <Text style={styles.footerSubtext}>
            Call, talk, and organize your thoughts
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050607'
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 40
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f5f7fa',
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: '#f5f7fa'
  },
  checkboxText: {
    flex: 1,
    color: '#d6dbe1',
    fontSize: 12,
    lineHeight: 18
  },
  linkRow: {
    flexDirection: 'row',
    gap: 16,
    marginLeft: 32,
    marginTop: -2
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
    alignItems: 'center'
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
