import { getSupabaseClient } from './databaseService.js';
import { ensureCreditEntitlement } from './databaseService.js';

export const validatePromoCode = async (code) => {
  if (!code) return { valid: false, error: 'No code provided.' };

  const supabase = getSupabaseClient();
  const cleanedCode = String(code).trim().toUpperCase();

  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', cleanedCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, error: 'Invalid promo code.' };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'This promo code has expired.' };
  }

  if (data.max_uses !== null && data.current_uses >= data.max_uses) {
    return { valid: false, error: 'This promo code has reached its usage limit.' };
  }

  return {
    valid: true,
    promo: {
      id: data.id,
      code: data.code,
      credits: data.credits,
      label: data.label,
      commissionRate: data.commission_rate || 0,
      influencerLabel: data.influencer_label || null
    }
  };
};

export const redeemPromoCode = async (userId, code) => {
  const validation = await validatePromoCode(code);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const supabase = getSupabaseClient();
  const { promo } = validation;

  // Check if user already redeemed this code (stored on users table)
  const { data: userRecord } = await supabase
    .from('users')
    .select('last_promo_code, signup_promo_code')
    .eq('id', userId)
    .maybeSingle();

  if (userRecord?.last_promo_code === promo.code) {
    return { success: false, error: 'You have already redeemed this promo code.' };
  }

  // Record redemption on users table.
  // signup_promo_code is first-touch — only set if currently null.
  const now = new Date().toISOString();
  const userUpdate = {
    last_promo_code: promo.code,
    last_promo_credits: promo.credits,
    last_promo_redeemed_at: now,
    updated_at: now
  };

  if (!userRecord?.signup_promo_code) {
    userUpdate.signup_promo_code = promo.code;
    userUpdate.signup_promo_redeemed_at = now;
  }

  const { error: redeemError } = await supabase
    .from('users')
    .update(userUpdate)
    .eq('id', userId);

  if (redeemError) {
    console.error('[Promo] User update error:', redeemError.message);
    return { success: false, error: 'Failed to redeem code.' };
  }

  // Increment usage count
  await supabase.rpc('increment_promo_uses', { promo_id: promo.id }).catch(() => {
    // Fallback: update directly
    supabase
      .from('promo_codes')
      .update({ current_uses: (promo.current_uses || 0) + 1 })
      .eq('id', promo.id)
      .then(() => {});
  });

  // Grant credits
  await ensureCreditEntitlement(userId, promo.credits, `promo_${promo.code}`);

  console.log(`[Promo] ${userId} redeemed ${promo.code} for ${promo.credits} credits`);
  return {
    success: true,
    creditsGranted: promo.credits,
    label: promo.label
  };
};
