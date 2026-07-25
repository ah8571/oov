import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { verifyStripeWebhook, createStripeCheckout, cancelStripeSubscription, STRIPE_TIERS } from '../services/stripeService.js';
import { ensureCreditEntitlement, getSupabaseClient } from '../services/databaseService.js';
import { validatePromoCode, redeemPromoCode } from '../services/promoService.js';

const router = express.Router();

// Stripe webhook — raw body required for signature verification.
// Exported separately so it can be mounted before bodyParser.json().
export const stripeWebhookHandler = [express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'] || '';
    console.log('[Stripe] Webhook received, sig present:', !!sig, 'body length:', (req.body || '').length);

    const event = verifyStripeWebhook(req.body, sig);

    if (!event) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const eventType = event.type;
    const session = event.data.object;
    const metadata = session?.metadata || {};
    let userId = metadata?.userId || session?.client_reference_id;
    const tier = metadata?.tier || '';
    const subscriptionId = session?.subscription || session?.id;
    const customerEmail = session?.customer_details?.email || session?.customer_email || '';

    console.log('[Stripe] Webhook:', eventType, 'userId:', userId, 'tier:', tier, 'subId:', subscriptionId, 'email:', customerEmail);

    const supabase = getSupabaseClient();

    // Website flow uses a synthetic ID — resolve to real user via email
    if (userId && (String(userId).startsWith('web_') || String(userId).startsWith('anon_'))) {
      if (customerEmail) {
        const { data: user } = await supabase.from('users').select('id').eq('email', customerEmail).maybeSingle();
        if (user?.id) {
          console.log('[Stripe] Resolved web checkout to user:', user.id, 'via email:', customerEmail);
          userId = user.id;
        }
      }
      if (!userId || String(userId).startsWith('web_')) {
        console.log('[Stripe] Cannot resolve web checkout — no matching email:', customerEmail);
        return res.json({ received: true, skipped: 'no_user_match' });
      }
    }

    switch (eventType) {
      case 'checkout.session.completed': {
        console.log('[Stripe] checkout.session.completed — mode:', session.mode, 'userId:', userId);
        if (session.mode === 'subscription' && userId) {
          const tierConfig = STRIPE_TIERS[tier];
          const credits = tierConfig?.credits || 0;
          console.log('[Stripe] Tier config:', tier, '→', credits, 'credits');

          // Snapshot old values before updating
          const { data: oldUser } = await supabase
            .from('users')
            .select('last_credit_allocation_date, stripe_tier')
            .eq('id', userId)
            .maybeSingle();

          // Update users with Stripe subscription data
          const billingState = tier ? `pro_stripe:${tier}` : 'pro_stripe';
          await supabase.from('users').update({
            billing_state: billingState,
            is_pro_active: true,
            stripe_subscription_id: subscriptionId,
            stripe_tier: tier,
            stripe_status: 'active',
            stripe_updated_at: new Date().toISOString(),
            monthly_credit_allocation: credits,
            last_credit_allocation_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', userId);

          console.log('[Stripe] User updated for', userId, 'tier:', tier);

          if (credits > 0) {
            const oldTier = oldUser?.stripe_tier;
            const lastAllocation = oldUser?.last_credit_allocation_date;
            const tierChanged = oldTier && oldTier !== tier;

            const periodDays = oldTier === 'monthly' ? 30 : oldTier === 'weekly' ? 7 : 0;
            const periodExpired = !lastAllocation || tierChanged
              || (Date.now() - new Date(lastAllocation).getTime()) > (periodDays * 24 * 60 * 60 * 1000);

            if (periodExpired) {
              console.log('[Stripe] Granting', credits, 'credits to', userId,
                tierChanged ? `(upgraded from ${oldTier})` : '(period expired)');
              await ensureCreditEntitlement(userId, credits, `stripe_${tier}`);
            } else {
              console.log('[Stripe] Skipping credit grant for', userId, '(same tier, within period)');
            }
          }
              console.log('[Stripe] Skipping credit grant for', userId, '(same tier, within period)');
            }
          }

          // Grant bonus credits if a promo code was used at checkout
          const couponCode = session?.discounts?.[0]?.coupon?.name
            || session?.total_details?.discounts?.[0]?.coupon?.name;

          if (couponCode) {
            const promoResult = await redeemPromoCode(userId, couponCode).catch(() => null);
            if (promoResult?.success) {
              console.log(`[Stripe] Bonus ${promoResult.creditsGranted} credits from promo: ${couponCode}`);
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subStatus = session?.status;
        if (userId) {
          await supabase.from('users').update({
            is_pro_active: subStatus === 'active',
            stripe_status: subStatus === 'active' ? 'active' : 'inactive',
            stripe_updated_at: new Date().toISOString(),
            billing_state: subStatus === 'active' ? `pro_stripe:${tier || 'unknown'}` : 'trial',
            monthly_credit_allocation: subStatus === 'active' ? (STRIPE_TIERS[tier]?.credits || 0) : 0,
            last_credit_allocation_date: subStatus === 'active' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          }).eq('id', userId);
        }
        break;
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('[Stripe] Webhook error:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}];

// Website subscribe redirect — GET for browser redirect flow
router.get('/subscribe', async (req, res) => {
  try {
    const { tier, code, email } = req.query || {};
    console.log('[Stripe] Subscribe redirect:', { tier, code: code ? '***' : null, email });

    if (!tier || !STRIPE_TIERS[tier]) {
      console.log('[Stripe] Invalid tier:', tier, 'Available:', Object.keys(STRIPE_TIERS));
      return res.redirect('https://oov.digital/subscribe?error=invalid_tier');
    }

    const result = await createStripeCheckout(
      `web_${Date.now()}`,
      email || null,
      tier,
      'https://oov.digital/subscribe/success',
      'https://oov.digital/subscribe',
      code || null
    );

    if (result.checkoutUrl) {
      console.log('[Stripe] Redirecting to checkout:', result.checkoutId);
      return res.redirect(result.checkoutUrl);
    }

    console.log('[Stripe] No checkout URL returned');
    return res.redirect('https://oov.digital/subscribe?error=checkout_failed');
  } catch (error) {
    console.error('[Stripe] Subscribe redirect error:', error.message, error.stack?.split('\n')[1]);
    const errMsg = encodeURIComponent(error.message || 'unavailable');
    return res.redirect(`https://oov.digital/subscribe?error=${errMsg}`);
  }
});

// Create checkout session
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { tier, email, successUrl, cancelUrl } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!tier || !STRIPE_TIERS[tier]) {
      return res.status(400).json({ error: `Invalid tier. Available: ${Object.keys(STRIPE_TIERS).join(', ')}` });
    }

    const result = await createStripeCheckout(userId, email, tier, successUrl, cancelUrl);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Stripe] Checkout error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Cancel subscription
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    console.log('[Stripe] Cancel requested by user:', userId);

    // Look up the Stripe subscription ID from users table
    const supabase = getSupabaseClient();
    const { data: userRecord } = await supabase
      .from('users')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .maybeSingle();

    const subscriptionId = userRecord?.stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(404).json({ error: 'No active Stripe subscription found' });
    }

    await cancelStripeSubscription(subscriptionId);

    // Mark as canceled on users table
    await supabase.from('users').update({
      is_pro_active: false,
      stripe_status: 'canceled',
      stripe_updated_at: new Date().toISOString(),
      billing_state: 'trial',
      monthly_credit_allocation: 0,
      last_credit_allocation_date: null,
      updated_at: new Date().toISOString()
    }).eq('id', userId);

    return res.json({ success: true });
  } catch (error) {
    console.error('[Stripe] Cancel error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Tiers list
router.get('/tiers', (_req, res) => {
  return res.json({
    success: true,
    tiers: Object.entries(STRIPE_TIERS).map(([key, config]) => ({
      key,
      label: config.label,
      credits: config.credits,
      period: config.period,
      active: Boolean(config.priceId)
    }))
  });
});

export default router;
