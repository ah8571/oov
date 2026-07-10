import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getBillingStatus } from '../services/api.js';
import {
  getRevenueCatCustomerInfo,
  getRevenueCatDisplayMessage,
  getRevenueCatOfferings,
  getRevenueCatSetupMessage,
  initializeRevenueCat,
  isProEntitlementActive,
  isRevenueCatEnabled,
  isRevenueCatUserCancelled,
  purchaseRevenueCatPackage
} from '../services/revenueCatService.js';
import { getUser } from '../utils/secureStorage.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';

const LIVE_CALLS_ENABLED = false;

const UpgradeScreen = () => {
  const { colors } = useAppTheme();
  const isLiveCallAvailable = LIVE_CALLS_ENABLED;
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offeringPackage, setOfferingPackage] = useState(null);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [revenueCatMessage, setRevenueCatMessage] = useState(null);
  const [isProActive, setIsProActive] = useState(false);

  useEffect(() => {
    const loadBilling = async () => {
      const response = await getBillingStatus();

      if (response.success) {
        setBilling(response.billing || null);
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

        setIsProActive(Boolean(initResponse.isProActive));

        const offerings = await getRevenueCatOfferings();
        const currentOffering = offerings?.current || null;
        const defaultPackage = currentOffering?.monthly || currentOffering?.availablePackages?.[0] || null;

        setOfferingPackage(defaultPackage);
        setRevenueCatMessage(defaultPackage ? null : 'Subscriptions are not available in this build yet. The App Store products still need to be attached to the active RevenueCat offering.');
      } catch (error) {
        setRevenueCatMessage(getRevenueCatDisplayMessage(error?.message));
      } finally {
        setOfferingsLoading(false);
      }
    };

    loadRevenueCat();
  }, []);

  const refreshCustomerInfo = async () => {
    const customerInfo = await getRevenueCatCustomerInfo();
    setIsProActive(isProEntitlementActive(customerInfo));
  };

  const handleUpgradePress = async () => {
    if (!offeringPackage) {
      Alert.alert('Subscription unavailable', revenueCatMessage || 'No subscription package is ready in this build yet.');
      return;
    }

    setPurchaseLoading(true);

    try {
      const result = await purchaseRevenueCatPackage(offeringPackage);
      const proActive = isProEntitlementActive(result?.customerInfo);
      setIsProActive(proActive);
      Alert.alert(
        proActive ? 'Subscription active' : 'Purchase complete',
        proActive
          ? 'Your Emmaline Pro subscription is active on this account.'
          : 'The purchase completed, but the pro entitlement is not active yet. Check the RevenueCat product and entitlement mapping.'
      );
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
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.heroEyebrow, { color: colors.accent }]}>Emmaline Pro</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {offeringPackage?.product?.priceString || '$9.99'} per month after your first 5 free minutes
          </Text>
          <Text style={[styles.heroDescription, { color: colors.mutedText }]}>
            Start with 5 free minutes to try the assistant, then continue with a monthly subscription.
          </Text>

          {revenueCatMessage ? (
            <Text style={[styles.helperText, { color: colors.mutedText }]}>{revenueCatMessage}</Text>
          ) : null}

          <View style={[styles.statusBadge, { backgroundColor: isProActive ? colors.chipSelectedBg : colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={[styles.statusBadgeText, { color: isProActive ? colors.chipSelectedText : colors.mutedText }]}>
              {isProActive ? 'Pro active on this account' : offeringsLoading ? 'Loading subscription details...' : 'Upgrade available'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.text }, (purchaseLoading || offeringsLoading || !offeringPackage) && styles.buttonDisabled]}
            onPress={handleUpgradePress}
            disabled={purchaseLoading || offeringsLoading || !offeringPackage}
            activeOpacity={0.85}
          >
            <Text style={[styles.upgradeButtonText, { color: colors.surface }]}>
              {purchaseLoading ? 'Processing purchase...' : isProActive ? 'Manage Pro access in store account' : 'Upgrade to Pro'}
            </Text>
          </TouchableOpacity>

          <View style={styles.inlineBenefitsBlock}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>What Pro unlocks</Text>

            {[
              'Continue using Emmaline after the free 5-minute trial is used.',
              isLiveCallAvailable
                ? 'Use live calls and Listen Mode with one simple monthly plan.'
                : 'Use Listen Mode and ongoing voice features with one simple monthly plan.',
              'Keep access to ongoing voice features without juggling one-off top-ups.'
            ].map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Text style={[styles.bulletMark, { color: colors.text }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.mutedText }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Current access</Text>

        <View style={[styles.statusCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[styles.statusLabel, { color: colors.mutedText }]}>Available minutes</Text>
          <Text style={[styles.statusValue, { color: colors.text }]}>
            {loading ? '...' : billing?.voiceAccessSource === 'subscription' ? 'Pro active' : billing ? billing.availableVoiceMinutes.toFixed(2) : 'Unavailable'}
          </Text>
          {billing?.voiceAccessSource === 'subscription' ? (
            <Text style={[styles.statusFootnote, { color: colors.mutedText }]}>Your subscription is currently unlocking voice access.</Text>
          ) : null}
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
  }
});

export default UpgradeScreen;