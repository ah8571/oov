import express from 'express';
import { validatePromoCode, redeemPromoCode } from '../services/promoService.js';
import { getSupabaseClient } from '../services/databaseService.js';
import { notifyAffiliateApplication } from '../utils/email.js';

const router = express.Router();

// Validate a promo code (public — used during signup or checkout)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body || {};
    const result = await validatePromoCode(code);
    return res.json(result);
  } catch (error) {
    console.error('[Promo] Validate error:', error.message);
    return res.status(500).json({ valid: false, error: 'Validation failed.' });
  }
});

// Redeem a promo code (requires auth)
router.post('/redeem', async (req, res) => {
  try {
    const { userId } = req;
    const { code } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    if (!code) return res.status(400).json({ error: 'No promo code provided.' });

    const result = await redeemPromoCode(userId, code);
    return res.json(result);
  } catch (error) {
    console.error('[Promo] Redeem error:', error.message);
    return res.status(500).json({ success: false, error: 'Redemption failed.' });
  }
});

// Apply to become an affiliate (public — creates pending promo code)
router.post('/apply', async (req, res) => {
  try {
    const { code, name, email } = req.body || {};
    const cleanedCode = String(code || '').trim().toUpperCase();

    if (!cleanedCode) return res.status(400).json({ error: 'Please enter a promo code.' });
    if (!name?.trim()) return res.status(400).json({ error: 'Please enter your name.' });
    if (!email?.trim()) return res.status(400).json({ error: 'Please enter your email for Wise payments.' });

    const supabase = getSupabaseClient();

    // Check if code is already taken
    const { data: existing } = await supabase
      .from('promo_codes')
      .select('code')
      .eq('code', cleanedCode)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'That promo code is already taken. Please choose another.' });
    }

    const { error } = await supabase.from('promo_codes').insert({
      code: cleanedCode,
      label: name.trim(),
      influencer_label: name.trim(),
      payout_email: email.trim(),
      credits: 0,
      commission_rate: 0.20,
      is_active: false,
      created_by: 'affiliate_apply'
    });

    if (error) {
      console.error('[Promo] Apply error:', error.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }

    console.log('[Promo] Affiliate application:', cleanedCode, name, email);

    // Notify admin (email if SMTP configured, otherwise console log)
    notifyAffiliateApplication({ code: cleanedCode, name: name.trim(), email: email.trim() }).catch(() => {});

    return res.json({
      success: true,
      message: `Promo code "${cleanedCode}" submitted for review. We'll notify you at ${email} when it's active.`
    });
  } catch (error) {
    console.error('[Promo] Apply error:', error.message);
    return res.status(500).json({ error: 'Application failed.' });
  }
});

export default router;
