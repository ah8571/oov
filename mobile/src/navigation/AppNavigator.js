import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginScreen from '../screens/LoginScreen';
import TranscriptScreen from '../screens/TranscriptScreen';
import NotesScreen from '../screens/NotesScreen';
import ReaderScreen from '../screens/ReaderScreen';
import CreateNoteScreen from '../screens/CreateNoteScreen';
import CallDetailScreen from '../screens/CallDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UpgradeScreen from '../screens/UpgradeScreen';
import LegalDocumentScreen from '../screens/LegalDocumentScreen';
import SupportScreen from '../screens/SupportScreen';
import { isAuthenticated as hasAuthToken, getUser } from '../utils/secureStorage.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';
import { logoutUser } from '../services/api.js';

const Stack = createStackNavigator();

const TranscriptStack = ({ onAppHeaderScroll, stackKey, transcriptResetToken }) => {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      key={stackKey}
      initialRouteName="TranscriptList"
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface, borderBottomColor: colors.border, shadowColor: 'transparent' },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        cardStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen 
        name="TranscriptList" 
        options={{ headerShown: false }}
      >
        {(screenProps) => <TranscriptScreen {...screenProps} onAppHeaderScroll={onAppHeaderScroll} transcriptResetToken={transcriptResetToken} />}
      </Stack.Screen>
      <Stack.Screen 
        name="CallDetail" 
        options={{ headerShown: false }}
      >
        {(screenProps) => <CallDetailScreen {...screenProps} onAppHeaderScroll={onAppHeaderScroll} transcriptResetToken={transcriptResetToken} />}
      </Stack.Screen>
    </Stack.Navigator>
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
    </Stack.Navigator>
  );
};

const AppHome = ({ onLogout }) => {
  const [uiState, setUiState] = useState({
    activeScreen: 'transcripts',
    menuOpen: false,
    transcriptStackVersion: 0,
    notesStackVersion: 0,
    transcriptResetToken: 0,
    notesResetToken: 0
  });
  const { colors, isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 8);
  const floatingButtonBottom = 16;
  const floatingButtonSize = designTokens.chrome.menuButtonSize;
  const contentTopInset = topInset + 6;
  const controlBackgroundColor = isDarkMode ? '#000000' : '#ffffff';
  const { activeScreen, menuOpen, transcriptStackVersion, notesStackVersion, transcriptResetToken, notesResetToken } = uiState;

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
      'Log out of Emmaline on this device?',
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
            left: 0
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
                left: 8,
                top: topInset + 8,
                bottom: floatingButtonBottom + floatingButtonSize + 8
              }
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openScreen('transcripts')}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>Transcripts</Text>
            </TouchableOpacity>
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
        {activeScreen === 'transcripts'
          ? <TranscriptStack stackKey={`transcripts-${transcriptStackVersion}`} onAppHeaderScroll={handleAppHeaderScroll} transcriptResetToken={transcriptResetToken} />
          : activeScreen === 'notes'
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
  const [user, setUser] = useState(null);
  const { colors, isDarkMode } = useAppTheme();

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
    const checkAuthStatus = async () => {
      try {
        const authenticated = await hasAuthToken();

        if (!authenticated) {
          setIsAuthenticated(false);
          setUser(null);
          onAuthStateChange?.(false);
          return;
        }

        const storedUser = await getUser();
        setUser(storedUser);
        setIsAuthenticated(true);
        onAuthStateChange?.(true);
      } catch (error) {
        setIsAuthenticated(false);
        setUser(null);
        onAuthStateChange?.(false);
      }
    };

    checkAuthStatus();
  }, [onAuthStateChange]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    onAuthStateChange?.(true);
  };

  const handleLogout = async () => {
    const response = await logoutUser();

    if (!response.success) {
      Alert.alert('Logout failed', response.error || 'Unable to log out right now.');
      return;
    }

    setUser(null);
    setIsAuthenticated(false);
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
            {(screenProps) => <LoginScreen {...screenProps} onLoginSuccess={handleLoginSuccess} />}
          </Stack.Screen>
          <Stack.Screen name="PrivacyPolicy" options={{ headerShown: false }}>
            {() => <LegalDocumentScreen documentKey="privacyPolicy" />}
          </Stack.Screen>
          <Stack.Screen name="TermsOfService" options={{ headerShown: false }}>
            {() => <LegalDocumentScreen documentKey="termsOfService" />}
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
  }
});
