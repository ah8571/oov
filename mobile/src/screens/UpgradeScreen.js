import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getBillingStatus } from '../services/api.js';
import { useAppTheme } from '../theme/appTheme.js';
import { designTokens } from '../theme/designSystem.js';

const UpgradeScreen = () => {
  const { colors } = useAppTheme();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleUpgradePress = () => {
    Alert.alert(
      'Billing not live yet',
      'Subscriptions are not enabled in this build yet. The next implementation step is wiring App Store and Google Play subscriptions through RevenueCat and adding restore purchases.'
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Upgrade</Text>
      </View>

      <View style={styles.section}>
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.heroEyebrow, { color: colors.accent }]}>Emmaline Pro</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>$10 / month after your first 5 free minutes</Text>
          <Text style={[styles.heroDescription, { color: colors.mutedText }]}>
            Start with 5 free minutes to try the assistant. Subscription billing will be finalized through the mobile app stores, with RevenueCat planned as the entitlement layer.
          </Text>

          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.text }]}
            onPress={handleUpgradePress}
            activeOpacity={0.85}
          >
            <Text style={[styles.upgradeButtonText, { color: colors.surface }]}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Current access</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>Your current voice allowance based on the backend billing ledger.</Text>

        <View style={[styles.statusCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[styles.statusLabel, { color: colors.mutedText }]}>Available minutes</Text>
          <Text style={[styles.statusValue, { color: colors.text }]}>
            {loading ? '...' : billing ? billing.availableVoiceMinutes.toFixed(2) : 'Unavailable'}
          </Text>
          <Text style={[styles.statusFootnote, { color: colors.mutedText }]}>Trial minutes remaining: {loading ? '...' : billing ? Math.ceil((billing.remainingFreeTrialSeconds || 0) / 60) : 'Unavailable'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>What Pro unlocks</Text>
        <Text style={[styles.sectionDescription, { color: colors.mutedText }]}>Restore purchases and subscription management language will be added alongside the store billing rollout.</Text>

        {[
          'Keep talking after the free 5-minute trial is used.',
          'Simple monthly access instead of manual minute tracking.',
          'A cleaner path to future auto-recharge or usage add-ons.'
        ].map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={[styles.bulletMark, { color: colors.text }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.mutedText }]}>{item}</Text>
          </View>
        ))}
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
  upgradeButton: {
    minHeight: 54,
    borderRadius: designTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: designTokens.spacing.lg
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700'
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