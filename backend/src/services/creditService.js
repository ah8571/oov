import { getSupabaseClient } from './databaseService.js';

// Rate card — credits consumed per minute of usage
const CREDIT_RATES = {
  voice_mode: 2,
  listen_mode: 1,
  reader_natural: 1,
  reader_basic: 0
};

const FREE_CREDITS_GRANT = 20;
const PRO_MONTHLY_CREDITS = 100;
const MAX_ROLLOVER_CREDITS = 100; // cap rollover at 1x monthly allocation

const roundUpCredits = (durationSeconds, ratePerMinute) => {
  // Always round up to the nearest credit so partial minutes cost at least 1 credit
  const minutes = Math.max(0, Number(durationSeconds || 0)) / 60;
  return Math.ceil(minutes * ratePerMinute);
};

const getCreditBalance = async (userId) => {
  const { data, error } = await getSupabaseClient()
    .from('user_billing_entitlements')
    .select('credit_balance, free_credits_granted, monthly_credit_allocation, last_credit_allocation_date, rollover_credits')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to fetch credit balance: ${error.message}`);
  }

  // Return defaults if no row exists yet (new user)
  return data || {
    credit_balance: 0,
    free_credits_granted: 0,
    monthly_credit_allocation: 0,
    last_credit_allocation_date: null,
    rollover_credits: 0
  };
};

const recordCreditTransaction = async ({
  userId,
  type,
  credits,
  balanceAfter,
  source = null,
  usageDurationSeconds = null,
  metadata = {}
}) => {
  const { error } = await getSupabaseClient()
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type,
      credits,
      balance_after: balanceAfter,
      source,
      usage_duration_seconds: usageDurationSeconds,
      metadata,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error recording credit transaction:', error);
  }
};

export const grantFreeCredits = async (userId) => {
  const profile = await getCreditBalance(userId);

  // Only grant once — if they already have free credits, skip
  if (profile.free_credits_granted > 0) {
    return { granted: false, balance: profile.credit_balance };
  }

  const { error } = await getSupabaseClient()
    .from('user_billing_entitlements')
    .update({
      credit_balance: FREE_CREDITS_GRANT,
      free_credits_granted: FREE_CREDITS_GRANT,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Unable to grant free credits: ${error.message}`);
  }

  await recordCreditTransaction({
    userId,
    type: 'free_grant',
    credits: FREE_CREDITS_GRANT,
    balanceAfter: FREE_CREDITS_GRANT,
    source: 'system',
    metadata: { reason: 'initial_free_credit_grant' }
  });

  return { granted: true, balance: FREE_CREDITS_GRANT };
};

export const grantMonthlyCredits = async (userId) => {
  const profile = await getCreditBalance(userId);

  if (profile.monthly_credit_allocation <= 0) {
    return { renewed: false, balance: profile.credit_balance, reason: 'no_monthly_allocation' };
  }

  const now = new Date();
  const lastAllocation = profile.last_credit_allocation_date
    ? new Date(profile.last_credit_allocation_date)
    : null;

  // Only renew if it's been at least 25 days since last allocation (grace window)
  if (lastAllocation) {
    const daysSinceLast = (now.getTime() - lastAllocation.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLast < 25) {
      return { renewed: false, balance: profile.credit_balance, reason: 'too_soon' };
    }
  }

  // Calculate rollover: min(previous balance, MAX_ROLLOVER)
  const rollover = Math.min(profile.credit_balance, MAX_ROLLOVER_CREDITS);
  const newBalance = PRO_MONTHLY_CREDITS + rollover;

  const { error } = await getSupabaseClient()
    .from('user_billing_entitlements')
    .update({
      credit_balance: newBalance,
      last_credit_allocation_date: now.toISOString(),
      rollover_credits: rollover,
      updated_at: now.toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Unable to grant monthly credits: ${error.message}`);
  }

  await recordCreditTransaction({
    userId,
    type: 'monthly_renewal',
    credits: PRO_MONTHLY_CREDITS,
    balanceAfter: newBalance,
    source: 'system',
    metadata: { monthlyAllocation: PRO_MONTHLY_CREDITS, rollover }
  });

  return { renewed: true, balance: newBalance, rollover, monthlyAllocation: PRO_MONTHLY_CREDITS };
};

export const assertUserCanConsumeCredits = async (userId, mode, durationSeconds) => {
  const rate = CREDIT_RATES[mode];
  if (rate === undefined) {
    throw new Error(`Unknown credit mode: ${mode}`);
  }

  if (rate === 0) {
    return { allowed: true, creditsNeeded: 0, balance: null, mode };
  }

  const creditsNeeded = roundUpCredits(durationSeconds, rate);
  const profile = await getCreditBalance(userId);
  const currentBalance = Number(profile.credit_balance || 0);

  if (currentBalance < creditsNeeded) {
    const error = new Error(`Insufficient credits: need ${creditsNeeded}, have ${currentBalance}`);
    error.code = 'INSUFFICIENT_CREDITS';
    error.statusCode = 402;
    error.creditsNeeded = creditsNeeded;
    error.creditBalance = currentBalance;
    throw error;
  }

  return {
    allowed: true,
    creditsNeeded,
    balance: currentBalance,
    mode,
    rate
  };
};

export const consumeCredits = async (userId, mode, durationSeconds, metadata = {}) => {
  const rate = CREDIT_RATES[mode];
  if (rate === undefined) {
    throw new Error(`Unknown credit mode: ${mode}`);
  }

  if (rate === 0) {
    return { consumed: 0, balanceAfter: null, mode };
  }

  const creditsToDeduct = roundUpCredits(durationSeconds, rate);
  const profile = await getCreditBalance(userId);
  const currentBalance = Number(profile.credit_balance || 0);
  const newBalance = Math.max(0, currentBalance - creditsToDeduct);

  const { error } = await getSupabaseClient()
    .from('user_billing_entitlements')
    .update({
      credit_balance: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Unable to deduct credits: ${error.message}`);
  }

  await recordCreditTransaction({
    userId,
    type: 'usage',
    credits: -creditsToDeduct,
    balanceAfter: newBalance,
    source: mode,
    usageDurationSeconds: Math.round(durationSeconds),
    metadata: {
      ratePerMinute: rate,
      ...metadata
    }
  });

  return {
    consumed: creditsToDeduct,
    balanceAfter: newBalance,
    balanceBefore: currentBalance,
    mode,
    durationSeconds: Math.round(durationSeconds)
  };
};

export const setMonthlyCreditAllocation = async (userId, monthlyCredits) => {
  const { error } = await getSupabaseClient()
    .from('user_billing_entitlements')
    .update({
      monthly_credit_allocation: monthlyCredits,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Unable to set monthly allocation: ${error.message}`);
  }

  // If they just got a pro subscription, trigger an immediate monthly grant
  if (monthlyCredits > 0) {
    return grantMonthlyCredits(userId);
  }

  return { updated: true, monthlyCredits };
};

export const getUserCreditStatus = async (userId) => {
  const profile = await getCreditBalance(userId);

  return {
    creditBalance: Number(profile.credit_balance || 0),
    freeCreditsGranted: Number(profile.free_credits_granted || 0),
    monthlyCreditAllocation: Number(profile.monthly_credit_allocation || 0),
    lastCreditAllocationDate: profile.last_credit_allocation_date || null,
    rolloverCredits: Number(profile.rollover_credits || 0),
    rateCard: CREDIT_RATES
  };
};

export default {
  CREDIT_RATES,
  grantFreeCredits,
  grantMonthlyCredits,
  assertUserCanConsumeCredits,
  consumeCredits,
  setMonthlyCreditAllocation,
  getUserCreditStatus
};
