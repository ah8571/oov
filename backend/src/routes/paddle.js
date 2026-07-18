import express from 'express';
import { verifyPaddleWebhook, createPaddleCheckout, cancelPaddleSubscription, PADDLE_TIERS } from '../services/paddleService.js';
import { ensureCreditEntitlement, getSupabaseClient } from '../services/databaseService.js';

const router = express.Router();

// Paddle webhook — receives raw body for signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body.toString('utf8');
    const signature = req.headers['paddle-signature'] || '';

    if (!verifyPaddleWebhook(rawBody, signature)) {
      console.warn('[Paddle] Webhook signature verification failed');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.event_type;
    const customData = event?.data?.custom_data || {};
    const userId = customData?.userId || event?.data?.customer?.custom_data?.userId;
    const subscriptionId = event?.data?.id;

    console.log('[Paddle] Webhook received:', eventType, { userId, subscriptionId });

    const supabase = getSupabaseClient();

    switch (eventType) {
      case 'subscription.created':
      case 'subscription.updated': {
        const tier = customData?.tier || '';
        const tierConfig = PADDLE_TIERS[tier];
        const credits = tierConfig?.credits || 0;

        if (userId) {
          await supabase.from('user_billing_entitlements').upsert({
            user_id: userId,
            paddle_subscription_id: subscriptionId,
            paddle_tier: tier,
            paddle_status: event?.data?.status || 'active',
            is_pro_active: true,
            paddle_updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

          if (credits > 0) {
            await ensureCreditEntitlement(userId, credits, `paddle_${tier}`);
          }
        }
        break;
      }

      case 'subscription.canceled':
      case 'subscription.past_due': {
        if (userId) {
          await supabase.from('user_billing_entitlements').upsert({
            user_id: userId,
            paddle_subscription_id: subscriptionId,
            paddle_status: event?.data?.status || 'inactive',
            is_pro_active: false,
            paddle_updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        }
        break;
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('[Paddle] Webhook error:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Create checkout session for authenticated users
router.post('/checkout', async (req, res) => {
  try {
    const { userId } = req;
    const { tier, email } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!tier || !PADDLE_TIERS[tier]) {
      return res.status(400).json({ error: `Invalid tier: ${tier}. Available: ${Object.keys(PADDLE_TIERS).join(', ')}` });
    }

    const result = await createPaddleCheckout(userId, email, tier);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Paddle] Checkout error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const { userId } = req;
    const { subscriptionId } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await cancelPaddleSubscription(subscriptionId);
    return res.json({ success: true });
  } catch (error) {
    console.error('[Paddle] Cancel error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Public tier list
router.get('/tiers', (_req, res) => {
  return res.json({
    success: true,
    tiers: Object.entries(PADDLE_TIERS).map(([key, config]) => ({
      key,
      label: config.label,
      credits: config.credits,
      period: config.period,
      active: Boolean(config.priceId)
    }))
  });
});

export default router;
