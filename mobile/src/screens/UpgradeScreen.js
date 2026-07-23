import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { getBillingStatus } from '../services/api.js';
import {
  getRevenueCatDisplayMessage,
  getRevenueCatOfferings,
  getRevenueCatSetupMessage,
  initializeRevenueCat,
  isRevenueCatEnabled,
  isRevenueCatUserCancelled,
  purchaseRevenueCatPackage
} from '../services/revenueCatService.js';
import { getUser } from '../utils/secureStorage.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';

const LIVE_CALLS_ENABLED = false;

const UpgradeScreen = ({ navigation: _navigation }) => {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const isLiveCallAvailable = LIVE_CALLS_ENABLED;
  const [billing, setBilling] = useState(null);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offeringPackage, setOfferingPackage] = useState(null);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [revenueCatMessage, setRevenueCatMessage] = useState(null);

  useEffect(() => {
    const loadBilling = async () => {
      const response = await getBillingStatus();

      if (response.success) {
        setBilling(response.billing || null);
        setCredits(response.credits || null);
      }

      setLoading(false);
    };

    loadBilling();
  }, []);

  useEffect(() => {
    const loadRevenueCat = async () => {
      if (!isRevenueCatEnabled()) {
        setRevenueCatMessage(getRevenueCatSetupMessage());
        setOfferingsLoading(false);
        return;
      }

      try {
        const currentUser = await getUser();
        const initResponse = await initializeRevenueCat(currentUser?.id ? String(currentUser.id) : null);

        if (!initResponse.success) {
          setRevenueCatMessage(initResponse.error || getRevenueCatSetupMessage());
          return;
        }

        const offerings = await getRevenueCatOfferings();
        const currentOffering = offerings?.current || null;
        const defaultPackage = currentOffering?.monthly || currentOffering?.availablePackages?.[0] || null;

        setOfferingPackage(defaultPackage);
        setRevenueCatMessage(defaultPackage ? null : 'In-app purchases are not available in this build yet. The App Store products still need to be attached to the active RevenueCat offering.');
      } catch (error) {
        setRevenueCatMessage(getRevenueCatDisplayMessage(error?.message));
      } finally {
        setOfferingsLoading(false);
      }
    };

    loadRevenueCat();
  }, []);

  const handleWebUpgrade = async (tier) => {
    await WebBrowser.openBrowserAsync(`https://oov.digital/subscribe?tier=${tier}`);
    // Refresh billing status when the browser is dismissed
    const response = await getBillingStatus();
    if (response.success) {
      setBilling(response.billing || null);
      setCredits(response.credits || null);
    }
  };

  const handleIapPurchase = async () => {
    if (!offeringPackage) {
      Alert.alert('Unavailable', revenueCatMessage || 'In-app purchases are not available in this build yet.');
      return;
    }

    setPurchaseLoading(true);

    try {
      await purchaseRevenueCatPackage(offeringPackage);
      Alert.alert(
        'Credits added',
        '100 credits have been added to your account.'
      );
      // Refresh billing status to show updated credit balance
      const response = await getBillingStatus();
      if (response.success) {
        setCredits(response.credits || null);
      }
    } catch (error) {
      if (!isRevenueCatUserCancelled(error)) {
        Alert.alert('Purchase failed', error?.message || 'Unable to complete the purchase right now.');
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Upgrade</Text>
      </View>

      <View style={styles.section}>
        {/* Weekly tier */}
        <View style={[styles.tierCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 16 }]}>
          <Text style={[styles.tierEyebrow, { color: colors.accent }]}>Weekly</Text>
          <Text style={[styles.tierPrice, { color: colors.text }]}>$7.99<Text style={styles.tierPeriod}> / week</Text></Text>
          <View style={styles.tierBenefits}>
            {[
              '100 credits per week',
              '~50 min Voice Mode or 100 min Reader',
              'Credits are mix-and-match across features',
              'Unused credits roll over',
              'Cancel anytime'
            ].map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Text style={[styles.bulletMark, { color: colors.text }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.mutedText }]}>{item}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.text }]}
            onPress={() => handleWebUpgrade('weekly')}
            activeOpacity={0.85}
          >
            <Text style={[styles.upgradeButtonText, { color: colors.surface }]}>Upgrade</Text>
          </TouchableOpacity>
        </View>

        {/* Monthly tier */}
        <View style={[styles.tierCard, { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 2 }]}>
          <Text style={[styles.tierEyebrow, { color: colors.accent }]}>Monthly · Best value</Text>
          <Text style={[styles.tierPrice, { color: colors.text }]}>$19.99<Text style={styles.tierPeriod}> / month</Text></Text>
          <View style={styles.tierBenefits}>
            {[
              '500 credits per month',
              '~250 min Voice Mode or 500 min Reader',
              'Credits are mix-and-match across features',
              'Unused credits roll over',
              'Cancel anytime'
            ].map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Text style={[styles.bulletMark, { color: colors.text }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.mutedText }]}>{item}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.text }]}
            onPress={() => handleWebUpgrade('monthly')}
            activeOpacity={0.85}
          >
            <Text style={[styles.upgradeButtonText, { color: colors.surface }]}>Upgrade</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => Linking.openURL('https://oov.digital/account')}>
          <Text style={[styles.manageLink, { color: colors.accent, marginTop: 8 }]}>
            Manage subscription →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Apple IAP — one-off credit purchase for compliance */}
      <View style={styles.section}>
        <View style={[styles.usageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.usageTitle, { color: colors.text }]}>Need more credits?</Text>
          <Text style={[styles.helperText, { color: colors.mutedText, marginBottom: 12 }]}>
            One-time credit purchase via App Store.
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 }, (purchaseLoading || !offeringPackage) && styles.buttonDisabled]}
            onPress={handleIapPurchase}
            disabled={purchaseLoading || !offeringPackage}
            activeOpacity={0.85}
          >
            <Text style={[styles.upgradeButtonText, { color: colors.text }]}>
              {purchaseLoading ? 'Processing...' : offeringPackage ? `Purchase 100 credits — ${offeringPackage?.product?.priceString || '$9.99'}` : 'Purchase 100 credits — unavailable in dev'}
            </Text>
          </TouchableOpacity>
          {!offeringPackage && (
            <Text style={[styles.helperText, { color: colors.mutedText, marginTop: 8, textAlign: 'center', fontSize: 12 }]}>
              IAP requires a preview or production build — your credits will be available on App Store / Play Store builds.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.usageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.usageTitle, { color: colors.text }]}>Credit rates</Text>
          <View style={styles.creditRow}>
            <Text style={[styles.creditMode, { color: colors.text }]}>Voice Mode</Text>
            <Text style={[styles.creditRate, { color: colors.accent }]}>2 credits/min</Text>
          </View>
          <View style={styles.creditRow}>
            <Text style={[styles.creditMode, { color: colors.text }]}>Reader — Natural Voice</Text>
            <Text style={[styles.creditRate, { color: colors.accent }]}>1 credit/min</Text>
          </View>
          <View style={styles.creditRow}>
            <Text style={[styles.creditMode, { color: colors.text }]}>Listen Mode</Text>
            <Text style={[styles.creditRate, { color: colors.accent }]}>1 credit/min</Text>
          </View>
          <View style={styles.creditRow}>
            <Text style={[styles.creditMode, { color: colors.text }]}>Reader — Basic</Text>
            <Text style={[styles.creditRate, { color: colors.mutedText }]}>Free</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.usageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.usageTitle, { color: colors.text }]}>Your available credits</Text>
          <View style={styles.usageRow}>
            <View style={styles.usageItem}>
              <Text style={[styles.usageValue, { color: colors.text }]}>
                {credits ? credits.creditBalance : '...'}
              </Text>
              <Text style={[styles.usageLabel, { color: colors.mutedText }]}>Available</Text>
            </View>
          </View>
        </View>
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
    paddingHorizontal: designTokens.chrome.listHeaderHorizontalPadding,
    paddingTop: designTokens.chrome.listHeaderVerticalPadding,
    paddingBottom: designTokens.chrome.listHeaderVerticalPadding,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  pageTitle: {
    fontSize: designTokens.typography.pageTitle,
    fontWeight: '700',
    color: '#212529'
  },
  section: {
    padding: designTokens.spacing.lg,
    gap: designTokens.spacing.md
  },
  usageCard: {
    borderWidth: 1,
    borderRadius: designTokens.radius.md,
    padding: designTokens.spacing.lg,
    gap: designTokens.spacing.md
  },
  usageTitle: {
    fontSize: designTokens.typography.label,
    fontWeight: '700'
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0
  },
  usageItem: {
    flex: 1,
    alignItems: 'center'
  },
  usageValue: {
    fontSize: 28,
    fontWeight: '700'
  },
  usageLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 4
  },
  usageDivider: {
    width: 1,
    height: 32
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 10
  },
  modeChip: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  modeValue: {
    fontSize: 24,
    fontWeight: '700'
  },
  modeHint: {
    fontSize: 11
  },
  creditTable: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8
  },
  creditRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  creditHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  creditCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600'
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: designTokens.radius.md,
    padding: designTokens.spacing.lg,
    gap: designTokens.spacing.md
  },
  heroEyebrow: {
    fontSize: designTokens.typography.label,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700'
  },
  tierCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24
  },
  tierEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  tierPrice: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16
  },
  tierPeriod: {
    fontSize: 16,
    fontWeight: '400'
  },
  tierBenefits: {
    marginBottom: 16
  },
  manageLink: {
    fontSize: 13,
    textAlign: 'center'
  },
  heroDescription: {
    fontSize: designTokens.typography.body,
    lineHeight: 21
  },
  inlineBenefitsBlock: {
    gap: designTokens.spacing.sm,
    marginTop: designTokens.spacing.xs
  },
  upgradeButton: {
    minHeight: 54,
    borderRadius: designTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: designTokens.spacing.lg
  },
  buttonDisabled: {
    opacity: 0.55
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  helperText: {
    fontSize: designTokens.typography.bodySmall,
    lineHeight: 18
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start'
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: designTokens.typography.title,
    fontWeight: '600'
  },
  sectionDescription: {
    fontSize: designTokens.typography.body,
    lineHeight: 20
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: designTokens.radius.md,
    paddingHorizontal: designTokens.spacing.lg,
    paddingVertical: 14,
    gap: designTokens.spacing.xs
  },
  statusLabel: {
    fontSize: designTokens.typography.body,
    fontWeight: '600'
  },
  statusValue: {
    fontSize: 28,
    fontWeight: '700'
  },
  statusFootnote: {
    fontSize: designTokens.typography.bodySmall,
    lineHeight: 18
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: designTokens.spacing.sm
  },
  bulletMark: {
    fontSize: 18,
    lineHeight: 20
  },
  bulletText: {
    flex: 1,
    fontSize: designTokens.typography.body,
    lineHeight: 20
  },
  subscriptionDetails: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 6
  },
  subscriptionDetail: {
    fontSize: 13,
    lineHeight: 19
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  legalLink: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  legalSeparator: {
    fontSize: 14
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6
  },
  creditMode: {
    fontSize: 14,
    fontWeight: '500'
  },
  creditRate: {
    fontSize: 14,
    fontWeight: '700'
  }
});

export default UpgradeScreen;