import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' })
  : null;

// Tier configuration — matches Stripe price IDs
export const STRIPE_TIERS = {
  weekly: {
    priceId: process.env.STRIPE_PRICE_WEEKLY || '',
    label: 'oov Weekly',
    credits: 100,
    period: 'week'
  },
  monthly: {
    priceId: process.env.STRIPE_PRICE_MONTHLY || '',
    label: 'oov Monthly',
    credits: 500,
    period: 'month'
  }
};

export const verifyStripeWebhook = (rawBody, signature) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.warn('[Stripe] Not configured — skipping webhook verification');
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return null;
  }
};

export const createStripeCheckout = async (userId, email, tierKey, successUrl, cancelUrl, promoCode = null) => {
  if (!stripe) throw new Error('Stripe is not configured.');

  const tier = STRIPE_TIERS[tierKey];
  if (!tier || !tier.priceId) {
    throw new Error(`Unknown tier: ${tierKey}`);
  }

  const sessionConfig = {
    mode: 'subscription',
    line_items: [{ price: tier.priceId, quantity: 1 }],
    client_reference_id: userId,
    metadata: { userId, tier: tierKey, promoCode: promoCode || '' },
    success_url: successUrl || 'https://oov.digital/subscribe/success',
    cancel_url: cancelUrl || 'https://oov.digital/subscribe',
    allow_promotion_codes: true
  };

  // Only include customer_email if a valid email is provided
  if (email && typeof email === 'string' && email.includes('@')) {
    sessionConfig.customer_email = email;
  }

  // Preserve promo code in metadata so webhook can grant bonus credits
  // The actual discount is handled by Stripe's own promotion code input on the checkout page

  const session = await stripe.checkout.sessions.create(sessionConfig);

  return { checkoutUrl: session.url, checkoutId: session.id };
};

export const cancelStripeSubscription = async (subscriptionId) => {
  if (!stripe) throw new Error('Stripe is not configured.');
  await stripe.subscriptions.cancel(subscriptionId);
  return { success: true };
};

export const getStripeSubscription = async (subscriptionId) => {
  if (!stripe) return null;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return sub;
};

export default {
  STRIPE_TIERS,
  verifyStripeWebhook,
  createStripeCheckout,
  cancelStripeSubscription,
  getStripeSubscription
};
