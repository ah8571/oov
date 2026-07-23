import {
  getUserBillingProfile,
  getSupabaseClient
} from './databaseService.js';
import { getUserCreditStatus } from './creditService.js';

export const getStripeProStatus = async (userId) => {
  if (!userId) return { isProActive: false };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_billing_entitlements')
    .select('stripe_status, stripe_tier, is_pro_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return { isProActive: false };

  return {
    isProActive: data.stripe_status === 'active' && data.is_pro_active === true,
    tier: data.stripe_tier || null
  };
};

export const getPaddleProStatus = async (userId) => {
  if (!userId) return { isProActive: false };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_billing_entitlements')
    .select('paddle_status, paddle_tier, is_pro_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return { isProActive: false };

  return {
    isProActive: data.paddle_status === 'active' && data.is_pro_active === true,
    tier: data.paddle_tier || null
  };
};

export const getUserVoiceBillingStatus = async (userId) => {
  const [billingProfile, creditStatus, stripeStatus] = await Promise.all([
    getUserBillingProfile(userId).catch(() => ({})),
    getUserCreditStatus(userId).catch(() => ({})),
    getStripeProStatus(userId).catch(() => ({}))
  ]);

  const hasStripeProAccess = Boolean(stripeStatus?.isProActive);
  const hasCredits = (creditStatus.creditBalance || 0) > 0;
  const hasVoiceAccess = hasStripeProAccess || hasCredits;

  const billingState = hasStripeProAccess
    ? 'pro_stripe'
    : billingProfile?.billing_state || 'trial';

  const voiceAccessSource = hasStripeProAccess
    ? 'stripe'
    : hasCredits
      ? 'credits'
      : 'none';

  return {
    billingState,
    hasVoiceAccess,
    voiceAccessSource,
    paywallTriggered: !hasVoiceAccess,
    paywallReason: hasVoiceAccess ? null : 'out_of_credits',
    creditBalance: creditStatus.creditBalance || 0,
    freeCreditsGranted: creditStatus.freeCreditsGranted || 0,
    monthlyCreditAllocation: creditStatus.monthlyCreditAllocation || 0,
    stripe: {
      active: hasStripeProAccess,
      tier: stripeStatus?.tier || null
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
    .from('user_billing_entitlements')
    .select('credit_balance')
    .eq('user_id', userId)
    .maybeSingle();

  const currentBalance = Number(current?.data?.credit_balance || 0);
  const newBalance = currentBalance + Math.max(0, Math.round(Number(creditsToAdd || 0)));

  await supabase
    .from('user_billing_entitlements')
    .update({
      credit_balance: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

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