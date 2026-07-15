import {
  getUserBillingProfile
} from './databaseService.js';
import { getRevenueCatProStatus } from './revenueCatService.js';
import { getUserCreditStatus } from './creditService.js';

// Weekly prepaid tiers (granted on purchase via RevenueCat)
const WEEKLY_TIER_CONFIG = {
  'emmaline_pro_weekly_30min': { seconds: 1800, label: '30 min / week' },
  'emmaline_pro_weekly_60min': { seconds: 3600, label: '60 min / week' }
};

export const getWeeklyTierForProduct = (productId) => {
  return WEEKLY_TIER_CONFIG[productId] || null;
};

export const getUserVoiceBillingStatus = async (userId) => {
  const [billingProfile, revenueCatStatus, creditStatus] = await Promise.all([
    getUserBillingProfile(userId).catch(() => ({})),
    getRevenueCatProStatus(userId).catch(() => ({})),
    getUserCreditStatus(userId).catch(() => ({}))
  ]);

  const hasRevenueCatProAccess = Boolean(revenueCatStatus?.isProActive);
  const hasCredits = (creditStatus.creditBalance || 0) > 0;
  const hasVoiceAccess = hasRevenueCatProAccess || hasCredits;

  return {
    billingState: hasRevenueCatProAccess ? 'pro' : billingProfile?.billing_state || 'trial',
    hasVoiceAccess,
    voiceAccessSource: hasRevenueCatProAccess ? 'subscription' : hasCredits ? 'credits' : 'none',
    paywallTriggered: !hasVoiceAccess,
    paywallReason: hasVoiceAccess ? null : 'out_of_credits',
    creditBalance: creditStatus.creditBalance || 0,
    freeCreditsGranted: creditStatus.freeCreditsGranted || 0,
    monthlyCreditAllocation: creditStatus.monthlyCreditAllocation || 0,
    revenueCat: {
      configured: Boolean(revenueCatStatus?.configured),
      status: revenueCatStatus?.status || 'not_configured',
      source: revenueCatStatus?.source || null,
      isProActive: hasRevenueCatProAccess,
      expiresAt: revenueCatStatus?.expiresAt || null,
      error: revenueCatStatus?.error || null
    }
  };
};

export const assertUserCanStartVoiceSession = async (userId) => {
  const billingStatus = await getUserVoiceBillingStatus(userId);

  if (!billingStatus.hasVoiceAccess) {
    const error = new Error('Voice access requires credits or an active subscription');
    error.code = 'VOICE_PAYWALL_REQUIRED';
    error.statusCode = 402;
    error.billingStatus = billingStatus;
    throw error;
  }

  return billingStatus;
};

export const grantUserCredits = async (userId, creditsToAdd) => {
  // Use the credit service to add credits directly
  const { getSupabaseClient } = await import('./databaseService.js');
  const supabase = getSupabaseClient();
  const current = await supabase
    .from('users')
    .select('credit_balance')
    .eq('id', userId)
    .single();

  const currentBalance = Number(current?.data?.credit_balance || 0);
  const newBalance = currentBalance + Math.max(0, Math.round(Number(creditsToAdd || 0)));

  await supabase
    .from('users')
    .update({
      credit_balance: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  // Record the transaction
  await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type: 'purchase',
      credits: Math.round(Number(creditsToAdd || 0)),
      balance_after: newBalance,
      source: 'purchase',
      metadata: { reason: 'revenuecat_purchase_grant' },
      created_at: new Date().toISOString()
    });

  return {
    updatedBalance: newBalance,
    billingStatus: await getUserVoiceBillingStatus(userId)
  };
};

export default {
  getUserVoiceBillingStatus,
  assertUserCanStartVoiceSession,
  grantUserCredits
};