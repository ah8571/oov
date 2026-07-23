import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { deleteAccount, getBillingStatus } from '../services/api.js';
import {
  getCallLanguagePreference,
  getCallVoicePreference,
  getInworldVoicePreference,
  saveCallLanguagePreference,
  saveCallVoicePreference,
  saveInworldVoicePreference,
} from '../utils/secureStorage.js';
import { useAppTheme } from '../theme/appTheme.js';

const LANGUAGE_OPTIONS = [
  { value: 'en', title: 'English', description: 'Use English as the primary language.' },
  { value: 'es', title: 'Spanish', description: 'Use Spanish as the primary language.' },
  { value: 'ar', title: 'Arabic', description: 'Use Arabic as the primary language.' },
  { value: 'de', title: 'German', description: 'Use German as the primary language.' },
  { value: 'it', title: 'Italian', description: 'Use Italian as the primary language.' },
  { value: 'ja', title: 'Japanese', description: 'Use Japanese as the primary language.' },
  { value: 'ko', title: 'Korean', description: 'Use Korean as the primary language.' },
  { value: 'pt', title: 'Portuguese', description: 'Use Portuguese as the primary language.' },
  { value: 'ru', title: 'Russian', description: 'Use Russian as the primary language.' },
  { value: 'zh', title: 'Mandarin Chinese', description: 'Use Mandarin Chinese as the primary language.' }
];


const VOICE_OPTIONS = [
  {
    value: 'marin',
    title: 'Marin',
    description: 'Recommended by OpenAI for the strongest overall realtime quality.'
  },
  {
    value: 'cedar',
    title: 'Cedar',
    description: 'Also recommended by OpenAI for high-quality realtime replies.'
  },
  {
    value: 'alloy',
    title: 'Alloy',
    description: 'A built-in realtime voice option with a neutral profile.'
  },
  {
    value: 'ash',
    title: 'Ash',
    description: 'A built-in realtime voice option with a distinct timbre.'
  },
  {
    value: 'ballad',
    title: 'Ballad',
    description: 'A built-in realtime voice option with a softer presentation.'
  },
  {
    value: 'coral',
    title: 'Coral',
    description: 'A built-in realtime voice option with a brighter tone.'
  },
  {
    value: 'echo',
    title: 'Echo',
    description: 'A built-in realtime voice option with a crisp delivery.'
  },
  {
    value: 'sage',
    title: 'Sage',
    description: 'A built-in realtime voice option with a calmer pacing profile.'
  },
  {
    value: 'shimmer',
    title: 'Shimmer',
    description: 'A built-in realtime voice option with a lighter texture.'
  },
  {
    value: 'verse',
    title: 'Verse',
    description: 'A built-in realtime voice option with a more stylized feel.'
  }
];

const INWORLD_VOICE_OPTIONS = [
  {
    value: 'Sarah',
    title: 'Sarah',
    description: 'Female US English. Speaks 10 languages with natural accents.',
    languages: ['en', 'es', 'ar', 'de', 'it', 'ja', 'ko', 'pt', 'ru', 'zh']
  },
  {
    value: 'community-b72meov8bd46',
    title: 'Roy Mustang',
    description: 'Male voice. Speaks English and Italian.',
    languages: ['en', 'it']
  }
];


const areRatesEqual = (left, right) => Math.abs(Number(left) - Number(right)) < 0.001;
const areDelayValuesEqual = (left, right) => Number(left) === Number(right);
const SettingsScreen = ({ onLogout, onOpenUpgrade, onOpenScreen, onAccountDeleted }) => {
  const { colors, isDarkMode, toggleTheme } = useAppTheme();
  const [callLanguage, setCallLanguage] = useState('en');
  const [callVoice, setCallVoice] = useState('marin');
  const [inworldVoice, setInworldVoice] = useState('Sarah');
  const [billingSummary, setBillingSummary] = useState({
    loading: true,
    availableVoiceMinutes: 0,
    usedVoiceMinutes: 0,
    remainingFreeTrialSeconds: 0,
    voiceAccessSource: 'none',
    isProActive: false,
    creditBalance: null
  });
  const scrollViewRef = useRef(null);
  const scrollOffsetRef = useRef(0);

  useEffect(() => {
    const loadPreferences = async () => {
      const [savedLanguage, savedVoice, savedInworldVoice] = await Promise.all([
        getCallLanguagePreference(),
        getCallVoicePreference(),
        getInworldVoicePreference()
      ]);

      setCallLanguage(savedLanguage || 'en');
      setCallVoice(savedVoice || 'marin');
      setInworldVoice(savedInworldVoice || 'Sarah');
    };

    loadPreferences();
  }, []);

  const loadBillingSummary = useCallback(async () => {
    const response = await getBillingStatus();

    if (response.success && response.billing) {
      setBillingSummary({
        loading: false,
        availableVoiceMinutes: Number(response.billing.availableVoiceMinutes || 0),
        usedVoiceMinutes: Number(((response.billing.usedCallSeconds || 0) / 60).toFixed(1)),
        remainingFreeTrialSeconds: Number(response.billing.remainingFreeTrialSeconds || 0),
        voiceAccessSource: response.billing.voiceAccessSource || 'none',
        isProActive: Boolean(response.billing.stripe?.active),
        creditBalance: response.credits?.creditBalance ?? null
      });
      return;
    }

    setBillingSummary({
      loading: false,
      availableVoiceMinutes: 0,
      usedVoiceMinutes: 0,
      remainingFreeTrialSeconds: 0,
      voiceAccessSource: 'none',
      isProActive: false,
      creditBalance: null
    });
  }, []);

  useEffect(() => {
    loadBillingSummary();
  }, [loadBillingSummary]);

  const handleScroll = (event) => {
    scrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y || 0);
  };

  const restoreScrollOffset = () => {
    if (scrollOffsetRef.current <= 0) {
      return;
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: scrollOffsetRef.current, animated: false });
    });
  };

  const handleSelectVoice = async (value) => {
    setCallVoice(value);
    await saveCallVoicePreference(value);
  };

  const handleSelectInworldVoice = async (value) => {
    setInworldVoice(value);
    await saveInworldVoicePreference(value);
  };

  const handleSelectLanguage = async (value) => {
    setCallLanguage(value);
    const saved = await saveCallLanguagePreference(value);

    if (!saved) {
      Alert.alert('Settings error', 'Unable to save your call language preference.');
    }
  };

  const handleLogout = () => {
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently remove your oov account and the account-linked transcripts, notes, and related records stored for that account. This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            const response = await deleteAccount({ source: 'mobile_settings' });

            if (!response.success) {
              Alert.alert('Delete failed', response.error || 'Unable to delete your account right now.');
              return;
            }

            Alert.alert('Account deleted', 'Your oov account has been removed.');
            onAccountDeleted?.();
          }
        }
      ]
    );
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      onScroll={handleScroll}
      onContentSizeChange={restoreScrollOffset}
      scrollEventThrottle={16}
    >
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>
      </View>

      {/* Available credits */}
      <View style={styles.section}>
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoCardCopy}>
            <Text style={[styles.infoCardTitle, { color: colors.text }]}>Your available credits</Text>
            <Text style={[styles.infoCardDescription, { color: billingSummary.creditBalance != null ? colors.accent : colors.mutedText }]}>
              {billingSummary.loading ? 'Loading...' : billingSummary.creditBalance != null ? billingSummary.creditBalance : '—'}
            </Text>
          </View>
          <TouchableOpacity onPress={onOpenUpgrade} activeOpacity={0.8}>
            <Text style={[styles.upgradeLink, { color: colors.accent }]}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>Keep the quick theme icon in the header, or switch modes here with a little more context.</Text>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoCardCopy}>
            <Text style={[styles.infoCardTitle, { color: colors.text }]}>{isDarkMode ? 'Dark mode' : 'Light mode'}</Text>
            <Text style={[styles.infoCardDescription, { color: colors.mutedText }]}>
              {isDarkMode
                ? 'Use the darker palette for a quieter look and less glare.'
                : 'Use the lighter palette for maximum contrast in bright settings.'}
            </Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.text }}
            thumbColor={isDarkMode ? colors.background : colors.surface}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Voice access</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>See your current voice balance and upgrade path.</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoCardCopy}>
            <Text style={[styles.infoCardTitle, { color: colors.text }]}>Voice access</Text>
            <Text style={[styles.infoCardDescription, { color: colors.mutedText }]}>
              {billingSummary.isProActive ? 'oov Pro is active on this account.' : 'Free trial included, then monthly subscription for continued access.'}
            </Text>
            <Text style={[styles.billingFootnote, { color: colors.mutedText }]}>
              {billingSummary.loading
                ? 'Loading...'
                : billingSummary.voiceAccessSource === 'subscription'
                  ? 'Available now: Pro access active'
                  : `Used: ${billingSummary.usedVoiceMinutes} min · Available: ${billingSummary.availableVoiceMinutes.toFixed(1)} min`}
            </Text>
          </View>
          <TouchableOpacity onPress={onOpenUpgrade} activeOpacity={0.8}>
            <Text style={[styles.upgradeLink, { color: colors.accent }]}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Call language</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>
          Choose the primary language oov should expect on live voice calls. Users can still mix languages, but this sets the dedicated assistant language. Listen Mode is still the place for saved transcripts.
        </Text>

        {LANGUAGE_OPTIONS.map((option) => {
          const selected = callLanguage === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selected && [styles.optionCardSelected, { borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]
              ]}
              onPress={() => handleSelectLanguage(option.value)}
              activeOpacity={0.85}
            >
              <View style={[styles.radio, { borderColor: colors.mutedText }, selected && [styles.radioSelected, { borderColor: colors.accent }]]}>
                {selected ? <View style={[styles.radioInner, { backgroundColor: colors.accent }]} /> : null}
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                <Text style={[styles.optionDescription, { color: colors.mutedText }]}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Voice Mode voice</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>Choose which OpenAI realtime voice oov should use when speaking back.</Text>

        <Text style={[styles.providerSubheader, { color: colors.mutedText }]}>OpenAI Voices</Text>

        {VOICE_OPTIONS.map((option) => {
          const selected = callVoice === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selected && [styles.optionCardSelected, { borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]
              ]}
              onPress={() => handleSelectVoice(option.value)}
              activeOpacity={0.85}
            >
              <View style={[styles.radio, { borderColor: colors.mutedText }, selected && [styles.radioSelected, { borderColor: colors.accent }]]}>
                {selected ? <View style={[styles.radioInner, { backgroundColor: colors.accent }]} /> : null}
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                <Text style={[styles.optionDescription, { color: colors.mutedText }]}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Inworld Voice</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>Choose which voice Inworld uses. Only voices that speak your selected language are shown.</Text>

        <Text style={[styles.providerSubheader, { color: colors.mutedText }]}>Inworld Voices</Text>

        {INWORLD_VOICE_OPTIONS.filter(opt => opt.languages.includes(callLanguage)).map((option) => {
          const selected = inworldVoice === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selected && [styles.optionCardSelected, { borderColor: colors.accent, backgroundColor: colors.surfaceAlt }]
              ]}
              onPress={() => handleSelectInworldVoice(option.value)}
              activeOpacity={0.85}
            >
              <View style={[styles.radio, { borderColor: colors.mutedText }, selected && [styles.radioSelected, { borderColor: colors.accent }]]}>
                {selected ? <View style={[styles.radioInner, { backgroundColor: colors.accent }]} /> : null}
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                <Text style={[styles.optionDescription, { color: colors.mutedText }]}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>Support, legal documents, and account controls.</Text>

        <TouchableOpacity
          style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onOpenScreen?.('support')}
          activeOpacity={0.85}
        >
          <Text style={[styles.linkCardTitle, { color: colors.text }]}>Support</Text>
          <Text style={[styles.linkCardDescription, { color: colors.mutedText }]}>Send a request to support@oov.digital from inside the app.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onOpenScreen?.('privacy')}
          activeOpacity={0.85}
        >
          <Text style={[styles.linkCardTitle, { color: colors.text }]}>Privacy Policy</Text>
          <Text style={[styles.linkCardDescription, { color: colors.mutedText }]}>Review how oov handles voice, transcript, support, and account data.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onOpenScreen?.('terms')}
          activeOpacity={0.85}
        >
          <Text style={[styles.linkCardTitle, { color: colors.text }]}>Terms of Use</Text>
          <Text style={[styles.linkCardDescription, { color: colors.mutedText }]}>Review account, subscription, restore, and acceptable-use terms.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.upgradeCardButton, { backgroundColor: colors.text }]}
          onPress={onOpenUpgrade}
          activeOpacity={0.85}
        >
          <Text style={[styles.upgradeCardButtonText, { color: colors.surface }]}>Upgrade to Pro</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={[styles.logoutButtonText, { color: colors.text }]}>Log out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleDeleteAccount}
          activeOpacity={0.85}
        >
          <Text style={styles.deleteButtonText}>Delete account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  contentContainer: {
    paddingBottom: 40
  },
  headerBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212529'
  },
  section: {
    padding: 16,
    gap: 12
  },
  speedometerCard: {
    backgroundColor: '#fff7e6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#f1d6a8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  speedometerLabel: {
    fontSize: 14,
    color: '#8a5a00',
    fontWeight: '600'
  },
  speedometerValue: {
    fontSize: 24,
    color: '#5c3b00',
    fontWeight: '700'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529'
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20
  },
  providerSubheader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 8
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#dee2e6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16
  },
  infoCardCopy: {
    flex: 1
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4
  },
  infoCardDescription: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18
  },
  usageFootnote: {
    fontSize: 13,
    lineHeight: 18
  },
  billingFootnote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6
  },
  upgradeLink: {
    fontSize: 15,
    fontWeight: '700'
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#dee2e6'
  },
  optionCardSelected: {
    borderColor: '#111418',
    backgroundColor: '#f1f3f5'
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#adb5bd',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12
  },
  radioSelected: {
    borderColor: '#111418'
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111418'
  },
  optionContent: {
    flex: 1
  },
  rateBadge: {
    marginLeft: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#495057'
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4
  },
  optionDescription: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18
  },
  logoutButton: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  deleteButton: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  upgradeCardButton: {
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  upgradeCardButtonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529'
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#d64545'
  },
  linkCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6
  },
  linkCardTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  linkCardDescription: {
    fontSize: 13,
    lineHeight: 18
  }
});

export default SettingsScreen;

