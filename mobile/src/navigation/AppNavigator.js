import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';

import LoginScreen from '../screens/LoginScreen';
import NotesScreen from '../screens/NotesScreen';
import ReaderScreen from '../screens/ReaderScreen';
import CreateNoteScreen from '../screens/CreateNoteScreen';
import CallDetailScreen from '../screens/CallDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UpgradeScreen from '../screens/UpgradeScreen';
import LegalDocumentScreen from '../screens/LegalDocumentScreen';
import SupportScreen from '../screens/SupportScreen';
import { getAiDisclosureAccepted, getUser, logout as clearStoredAuth, saveAiDisclosureAccepted } from '../utils/secureStorage.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';
import { getCurrentUser, logoutUser } from '../services/api.js';
import { handleOAuthRedirect, hasSession, initializeSupabaseAuth, onAuthStateChange as subscribeToSupabaseAuthState } from '../services/supabaseAuth.js';
import { syncRevenueCatUser } from '../services/revenueCatService.js';

const Stack = createStackNavigator();

const AIDisclosureScreen = ({ navigation, isChecking = false, onAccept, onLogout }) => {
  const { colors } = useAppTheme();
  const [hasCheckedConsent, setHasCheckedConsent] = useState(false);

  const handleAccept = async () => {
    if (!hasCheckedConsent) {
      Alert.alert('Consent required', 'Please confirm the AI data-sharing disclosure before continuing.');
      return;
    }

    await onAccept?.();
  };

  return (
    <ScrollView style={[styles.disclosureContainer, { backgroundColor: colors.background }]} contentContainerStyle={styles.disclosureContent}>
      <View style={[styles.disclosureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.disclosureEyebrow, { color: colors.mutedText }]}>Privacy disclosure</Text>
        <Text style={[styles.disclosureTitle, { color: colors.text }]}>AI processing permission</Text>
        <Text style={[styles.disclosureBody, { color: colors.mutedText }]}>Before oov processes AI features, we need your permission.</Text>
        <Text style={[styles.disclosureBody, { color: colors.mutedText }]}>When you use voice mode, Listen Mode, notes, or Reader, oov may send the audio, transcripts, note text, pasted text, or uploaded documents you choose to share to OpenAI, Google Cloud, or Resemble so they can generate transcripts, summaries, spoken audio, or AI responses.</Text>

        <TouchableOpacity style={styles.disclosureCheckboxRow} onPress={() => setHasCheckedConsent((current) => !current)} activeOpacity={0.85}>
          <View style={[styles.disclosureCheckbox, hasCheckedConsent && styles.disclosureCheckboxChecked, { borderColor: colors.border }]}>
            {hasCheckedConsent ? <Text style={styles.disclosureCheckboxMark}>✓</Text> : null}
          </View>
          <Text style={[styles.disclosureCheckboxText, { color: colors.text }]}>I allow oov to send the content I choose to submit to these AI providers to power AI features.</Text>
        </TouchableOpacity>

        <View style={styles.disclosureLinksRow}>
          <Text style={[styles.disclosureLink, { color: colors.accent }]} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
          <Text style={[styles.disclosureLinkDivider, { color: colors.mutedText }]}>•</Text>
          <Text style={[styles.disclosureLink, { color: colors.accent }]} onPress={() => navigation.navigate('TermsOfService')}>Terms of Use</Text>
          <Text style={[styles.disclosureLinkDivider, { color: colors.mutedText }]}>•</Text>
          <Text style={[styles.disclosureLink, { color: colors.accent }]} onPress={() => navigation.navigate('EULA')}>EULA</Text>
        </View>

        {isChecking ? (
          <ActivityIndicator style={styles.disclosureLoading} color={colors.accent} />
        ) : (
          <>
            <TouchableOpacity style={[styles.disclosureButton, { backgroundColor: colors.text }]} onPress={handleAccept} activeOpacity={0.85}>
              <Text style={[styles.disclosureButtonText, { color: colors.background }]}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.disclosureSecondaryButton, { borderColor: colors.border }]} onPress={onLogout} activeOpacity={0.85}>
              <Text style={[styles.disclosureSecondaryButtonText, { color: colors.text }]}>Log out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const NotesStack = ({ onAppHeaderScroll, notesResetToken, stackKey }) => {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      key={stackKey}
      initialRouteName="NotesList"
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface, borderBottomColor: colors.border, shadowColor: 'transparent' },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        cardStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen 
        name="NotesList" 
        options={{ headerShown: false }}
      >
        {(screenProps) => <NotesScreen {...screenProps} onAppHeaderScroll={onAppHeaderScroll} notesResetToken={notesResetToken} />}
      </Stack.Screen>
      <Stack.Screen
        name="CreateNote"
        options={{ headerShown: false }}
      >
        {(screenProps) => <CreateNoteScreen {...screenProps} onAppHeaderScroll={onAppHeaderScroll} notesResetToken={notesResetToken} />}
      </Stack.Screen>
      <Stack.Screen
        name="CallDetail"
        options={{ headerShown: false }}
      >
        {(screenProps) => <CallDetailScreen {...screenProps} onAppHeaderScroll={onAppHeaderScroll} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

const AppHome = ({ onLogout }) => {
  const [uiState, setUiState] = useState({
    activeScreen: 'notes',
    menuOpen: false,
    notesStackVersion: 0,
    notesResetToken: 0
  });
  const { colors, isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 8);
  const floatingButtonBottom = 16;
  const floatingButtonSize = designTokens.chrome.menuButtonSize;
  const contentTopInset = topInset + 6;
  const controlBackgroundColor = isDarkMode ? '#000000' : '#ffffff';
  const { activeScreen, menuOpen, notesStackVersion, notesResetToken } = uiState;

  const handleAppHeaderScroll = useCallback((offsetY = 0) => {
    const normalizedOffset = Number.isFinite(Number(offsetY)) ? Math.max(0, Number(offsetY)) : 0;

    if (normalizedOffset <= 0) {
      return;
    }

    setUiState((currentState) => {
      if (!currentState.menuOpen) {
        return currentState;
      }

      return {
        ...currentState,
        menuOpen: false
      };
    });
  }, []);

  const openScreen = (screen) => {
    setUiState((currentState) => ({
      ...currentState,
      activeScreen: screen,
      menuOpen: false
    }));
  };

  const handleLogoutPress = () => {
    setUiState((currentState) => ({
      ...currentState,
      menuOpen: false
    }));
    Alert.alert(
      'Log out',
      'Log out of oov on this device?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => onLogout?.()
        }
      ]
    );
  };

  const handleAccountDeleted = async () => {
    await onLogout?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.floatingMenuContainer,
          {
            bottom: floatingButtonBottom,
            left: 10
          }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.menuButton,
            {
              backgroundColor: controlBackgroundColor,
              width: floatingButtonSize,
              height: floatingButtonSize
            }
          ]}
          onPress={() => {
            setUiState((currentState) => ({
              ...currentState,
              menuOpen: !currentState.menuOpen
            }));
          }}
          activeOpacity={0.8}
        >
          <View style={styles.menuIconBars}>
            <View style={[styles.menuIconBar, { backgroundColor: isDarkMode ? '#ffffff' : '#111111' }]} />
            <View style={[styles.menuIconBar, { backgroundColor: isDarkMode ? '#ffffff' : '#111111' }]} />
            <View style={[styles.menuIconBar, { backgroundColor: isDarkMode ? '#ffffff' : '#111111' }]} />
          </View>
        </TouchableOpacity>
      </View>

      {menuOpen ? (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayBackdrop}
            onPress={() => {
              setUiState((currentState) => ({
                ...currentState,
                menuOpen: false
              }));
            }}
            activeOpacity={1}
          />
          <View
            style={[
              styles.sideMenu,
              {
                backgroundColor: colors.surface,
                borderRightColor: colors.border,
                left: 12,
                top: topInset + 8,
                bottom: floatingButtonBottom + floatingButtonSize + 8
              }
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openScreen('notes')}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openScreen('reader')}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>Reader</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openScreen('upgrade')}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>Upgrade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openScreen('settings')}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openScreen('support')}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>Support</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast, { borderTopColor: colors.border }]}
              onPress={handleLogoutPress}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuItemDangerText, { color: colors.text }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.content,
          {
            backgroundColor: colors.background,
            paddingTop: contentTopInset
          }
        ]}
      >
        {activeScreen === 'notes'
          ? <NotesStack stackKey={`notes-${notesStackVersion}`} onAppHeaderScroll={handleAppHeaderScroll} notesResetToken={notesResetToken} />
          : activeScreen === 'reader'
              ? <ReaderScreen onAppHeaderScroll={handleAppHeaderScroll} />
              : activeScreen === 'support'
                ? <SupportScreen />
                : activeScreen === 'privacy'
                  ? <LegalDocumentScreen documentKey="privacyPolicy" />
                  : activeScreen === 'terms'
                    ? <LegalDocumentScreen documentKey="termsOfService" />
            : activeScreen === 'upgrade'
              ? <UpgradeScreen />
              : <SettingsScreen onLogout={onLogout} onOpenUpgrade={() => openScreen('upgrade')} onOpenScreen={openScreen} onAccountDeleted={handleAccountDeleted} />}
      </View>
    </View>
  );
};

const AppNavigator = ({ onAuthStateChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingProfileSetup, setPendingProfileSetup] = useState(null);
  const [user, setUser] = useState(null);
  const [hasAcceptedAiDisclosure, setHasAcceptedAiDisclosure] = useState(false);
  const [hasResolvedAiDisclosure, setHasResolvedAiDisclosure] = useState(false);
  const { colors, isDarkMode } = useAppTheme();

  const hydrateAiDisclosureState = async () => {
    const accepted = await getAiDisclosureAccepted();
    setHasAcceptedAiDisclosure(Boolean(accepted));
    setHasResolvedAiDisclosure(true);
  };

  const syncRevenueCatIdentity = (appUserId) => {
    syncRevenueCatUser(appUserId).catch(() => {
      // RevenueCat identity sync is best-effort and should not block auth state.
    });
  };

  const navigationTheme = {
    dark: isDarkMode,
    colors: {
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.accent
    },
    fonts: undefined
  };

  useEffect(() => {
    const disposeSupabaseAuth = initializeSupabaseAuth();

    const resolveOAuthRedirect = async (url, source) => {
      if (!url) {
        return false;
      }

      try {
        const handled = await handleOAuthRedirect(url);

        if (handled) {
          console.log('[AuthFlow] AppNavigator:handledOAuthRedirect', { source, url });
        }

        return handled;
      } catch (error) {
        console.log('[AuthFlow] AppNavigator:handleOAuthRedirectError', {
          source,
          url,
          message: error?.message || String(error)
        });
        return false;
      }
    };

    const checkAuthStatus = async () => {
      if (checkAuthStatus._running) return;
      checkAuthStatus._running = true;
      try {
        const authenticated = await hasSession();
        console.log('[AuthFlow] checkAuthStatus:hasSession', { authenticated });

        if (!authenticated) {
          Sentry.setUser(null);
          setIsAuthenticated(false);
          setUser(null);
          setHasAcceptedAiDisclosure(false);
          setHasResolvedAiDisclosure(false);
          onAuthStateChange?.(false);
          return;
        }

        const currentUserResponse = await getCurrentUser();
        console.log('[AuthFlow] checkAuthStatus:getCurrentUser', {
          success: Boolean(currentUserResponse?.success),
          requiresProfileCompletion: Boolean(currentUserResponse?.requiresProfileCompletion),
          hasUser: Boolean(currentUserResponse?.user),
          error: currentUserResponse?.error || null,
          profileSetup: currentUserResponse?.profileSetup || null
        });

        if (currentUserResponse?.requiresProfileCompletion) {
          setPendingProfileSetup(currentUserResponse.profileSetup || null);
          setIsAuthenticated(false);
          setUser(null);
          setHasAcceptedAiDisclosure(false);
          setHasResolvedAiDisclosure(false);
          onAuthStateChange?.(false);
          return;
        }

        if (!currentUserResponse.success || !currentUserResponse.user) {
          await clearStoredAuth();
          await syncRevenueCatUser(null);
          Sentry.setUser(null);
          setIsAuthenticated(false);
          setUser(null);
          setHasAcceptedAiDisclosure(false);
          setHasResolvedAiDisclosure(false);
          onAuthStateChange?.(false);
          return;
        }

        const storedUser = currentUserResponse.user || await getUser();
        Sentry.setUser(
          storedUser?.id
            ? {
                id: String(storedUser.id),
                email: storedUser.email || undefined
              }
            : null
        );
        setPendingProfileSetup(null);
        setUser(storedUser);
        setIsAuthenticated(true);
        await hydrateAiDisclosureState();
        onAuthStateChange?.(true);
        syncRevenueCatIdentity(storedUser?.id ? String(storedUser.id) : null);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            area: 'auth_restore'
          }
        });
        Sentry.setUser(null);
        setIsAuthenticated(false);
        setUser(null);
        onAuthStateChange?.(false);
      } finally {
        checkAuthStatus._running = false;
      }
    };

    let isMounted = true;

    const initializeAuthState = async () => {
      const initialUrl = await Linking.getInitialURL();
      const handledInitialRedirect = await resolveOAuthRedirect(initialUrl, 'initial-url');

      if (!isMounted) {
        return;
      }

      await checkAuthStatus();

      if (handledInitialRedirect) {
        await checkAuthStatus();
      }
    };

    initializeAuthState();

    const linkingSubscription = Linking.addEventListener('url', async ({ url }) => {
      const handled = await resolveOAuthRedirect(url, 'event');

      if (handled) {
        await checkAuthStatus();
      }
    });

    const {
      data: { subscription }
    } = subscribeToSupabaseAuthState((_event, session) => {
      console.log('[AuthFlow] onAuthStateChange', {
        event: _event,
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
        email: session?.user?.email || null
      });
      Promise.resolve().then(async () => {
        if (!session) {
          Sentry.setUser(null);
          await syncRevenueCatUser(null);
          setIsAuthenticated(false);
          setUser(null);
          setHasAcceptedAiDisclosure(false);
          setHasResolvedAiDisclosure(false);
          onAuthStateChange?.(false);
          return;
        }

        const currentUserResponse = await getCurrentUser();
        if (currentUserResponse?.requiresProfileCompletion) {
          setPendingProfileSetup(currentUserResponse.profileSetup || null);
          setIsAuthenticated(false);
          setUser(null);
          setHasAcceptedAiDisclosure(false);
          setHasResolvedAiDisclosure(false);
          onAuthStateChange?.(false);
          return;
        }

        if (!currentUserResponse.success || !currentUserResponse.user) {
          await clearStoredAuth();
          Sentry.setUser(null);
          await syncRevenueCatUser(null);
          setIsAuthenticated(false);
          setUser(null);
          setHasAcceptedAiDisclosure(false);
          setHasResolvedAiDisclosure(false);
          onAuthStateChange?.(false);
          return;
        }

        const nextUser = currentUserResponse.user || await getUser();
        Sentry.setUser(
          nextUser?.id
            ? {
                id: String(nextUser.id),
                email: nextUser.email || undefined
              }
            : null
        );
        setPendingProfileSetup(null);
        setUser(nextUser);
        setIsAuthenticated(true);
        await hydrateAiDisclosureState();
        onAuthStateChange?.(true);
        syncRevenueCatIdentity(nextUser?.id ? String(nextUser.id) : null);
      }).catch((error) => {
        Sentry.captureException(error, {
          tags: {
            area: 'auth_state_change'
          }
        });
        Sentry.setUser(null);
        setIsAuthenticated(false);
        setUser(null);
        onAuthStateChange?.(false);
      });
    });

    return () => {
      isMounted = false;
      linkingSubscription.remove();
    };
  }, [onAuthStateChange]);

  const handleLoginSuccess = async (userData) => {
    Sentry.setUser(
      userData?.id
        ? {
            id: String(userData.id),
            email: userData.email || undefined
          }
        : null
    );
    syncRevenueCatUser(userData?.id ? String(userData.id) : null).catch(() => {
      // RevenueCat setup is best-effort here; the Upgrade screen surfaces setup issues.
    });
    setPendingProfileSetup(null);
    setUser(userData);
    setIsAuthenticated(true);
    await hydrateAiDisclosureState();
    onAuthStateChange?.(true);
  };

  const handleLogout = async () => {
    const response = await logoutUser();

    if (!response.success) {
      Alert.alert('Logout failed', response.error || 'Unable to log out right now.');
      return;
    }

    Sentry.setUser(null);
    await syncRevenueCatUser(null);
    setPendingProfileSetup(null);
    setUser(null);
    setIsAuthenticated(false);
    setHasAcceptedAiDisclosure(false);
    setHasResolvedAiDisclosure(false);
    onAuthStateChange?.(false);
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {!isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen 
            name="Login"
            options={{
              animationEnabled: false
            }}
          >
            {(screenProps) => (
              <LoginScreen
                {...screenProps}
                onLoginSuccess={handleLoginSuccess}
                pendingProfileSetup={pendingProfileSetup}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="PrivacyPolicy" options={{ headerShown: false }}>
            {() => <LegalDocumentScreen documentKey="privacyPolicy" />}
          </Stack.Screen>
          <Stack.Screen name="TermsOfService" options={{ headerShown: false }}>
            {() => <LegalDocumentScreen documentKey="termsOfService" />}
          </Stack.Screen>
          <Stack.Screen name="EULA" options={{ headerShown: false }}>
            {() => <LegalDocumentScreen documentKey="eula" />}
          </Stack.Screen>
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen 
              name="App" 
              options={{
                animationEnabled: false
              }}
            >
              {() => <AppHome onLogout={handleLogout} />}
            </Stack.Screen>
          <Stack.Screen name="PrivacyPolicy" options={{ headerShown: false }}>
            {() => <LegalDocumentScreen documentKey="privacyPolicy" />}
          </Stack.Screen>
          <Stack.Screen name="TermsOfService" options={{ headerShown: false }}>
            {() => <LegalDocumentScreen documentKey="termsOfService" />}
          </Stack.Screen>
          <Stack.Screen name="EULA" options={{ headerShown: false }}>
            {() => <LegalDocumentScreen documentKey="eula" />}
          </Stack.Screen>
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  floatingMenuContainer: {
    position: 'absolute',
    zIndex: 30,
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  },
  menuButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderRadius: designTokens.radius.pill,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8
  },
  menuIconBars: {
    width: designTokens.chrome.menuIconWidth,
    gap: designTokens.chrome.menuIconGap
  },
  menuIconBar: {
    height: designTokens.chrome.menuBarHeight,
    borderRadius: designTokens.radius.pill,
    backgroundColor: '#212529'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    flexDirection: 'row'
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  sideMenu: {
    position: 'absolute',
    width: designTokens.chrome.sideMenuWidth,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
    borderRadius: designTokens.radius.lg,
    overflow: 'hidden'
  },
  menuItem: {
    paddingHorizontal: 18,
    paddingVertical: designTokens.spacing.lg
  },
  menuItemLast: {
    marginTop: designTokens.spacing.xs,
    borderTopWidth: 1
  },
  menuItemText: {
    fontSize: 15,
    color: '#212529'
  },
  menuItemDangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529'
  },
  content: {
    flex: 1
  },
  disclosureContainer: {
    flex: 1
  },
  disclosureContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20
  },
  disclosureCard: {
    borderWidth: 1,
    borderRadius: designTokens.radius.lg,
    padding: 20,
    gap: 14
  },
  disclosureEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  disclosureTitle: {
    fontSize: 26,
    fontWeight: '700'
  },
  disclosureBody: {
    fontSize: 14,
    lineHeight: 21
  },
  disclosureCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4
  },
  disclosureCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  disclosureCheckboxChecked: {
    backgroundColor: '#111111'
  },
  disclosureCheckboxMark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  disclosureCheckboxText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600'
  },
  disclosureLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  disclosureLink: {
    fontSize: 14,
    fontWeight: '600'
  },
  disclosureLinkDivider: {
    fontSize: 14
  },
  disclosureButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  },
  disclosureButtonText: {
    fontSize: 15,
    fontWeight: '700'
  },
  disclosureSecondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  disclosureSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  disclosureLoading: {
    marginTop: 12
  }
});
