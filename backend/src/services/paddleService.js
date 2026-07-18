import crypto from 'crypto';

const PADDLE_API_KEY = process.env.PADDLE_API_KEY || '';
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || '';
const PADDLE_ENV = process.env.PADDLE_ENV || 'sandbox'; // 'sandbox' or 'production'
const PADDLE_API_BASE = PADDLE_ENV === 'sandbox'
  ? 'https://sandbox-api.paddle.com'
  : 'https://api.paddle.com';

// Tier configuration — matches what we create in Paddle dashboard
export const PADDLE_TIERS = {
  ali_weekly: {
    priceId: process.env.PADDLE_PRICE_WEEKLY || '',
    label: 'Ali Weekly',
    credits: 100,
    period: 'week'
  },
  ali_monthly: {
    priceId: process.env.PADDLE_PRICE_MONTHLY || '',
    label: 'Ali Monthly',
    credits: 500,
    period: 'month'
  }
};

const paddleRequest = async (path, options = {}) => {
  const url = `${PADDLE_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paddle API error (${response.status}): ${text}`);
  }

  return response.json();
};

// Verify Paddle webhook signature
export const verifyPaddleWebhook = (rawBody, signatureHeader) => {
  if (!PADDLE_WEBHOOK_SECRET) {
    console.warn('[Paddle] Webhook secret not configured — skipping signature verification');
    return true;
  }

  const ts = signatureHeader?.match(/ts=(\d+)/)?.[1];
  const h1 = signatureHeader?.match(/h1=([a-f0-9]+)/)?.[1];

  if (!ts || !h1) {
    return false;
  }

  // Prevent replay attacks: reject if timestamp is older than 5 minutes
  const nowTs = Math.floor(Date.now() / 1000);
  if (Math.abs(nowTs - parseInt(ts, 10)) > 300) {
    return false;
  }

  const payload = `${ts}:${rawBody}`;
  const computed = crypto.createHmac('sha256', PADDLE_WEBHOOK_SECRET).update(payload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(h1));
};

// Create a checkout session for a given tier
export const createPaddleCheckout = async (userId, email, tierKey) => {
  const tier = PADDLE_TIERS[tierKey];
  if (!tier || !tier.priceId) {
    throw new Error(`Unknown tier: ${tierKey}`);
  }

  const response = await paddleRequest('/checkout', {
    method: 'POST',
    body: JSON.stringify({
      items: [{
        priceId: tier.priceId,
        quantity: 1
      }],
      customer: {
        email,
        customData: { userId }
      },
      customData: { userId, tier: tierKey },
      settings: {
        allowDiscountRemoval: false,
        locale: 'en'
      }
    })
  });

  return {
    checkoutUrl: response?.data?.url || null,
    checkoutId: response?.data?.id || null
  };
};

// Fetch subscription details from Paddle
export const getPaddleSubscription = async (subscriptionId) => {
  const response = await paddleRequest(`/subscriptions/${subscriptionId}`);
  return response?.data || null;
};

// Cancel a Paddle subscription
export const cancelPaddleSubscription = async (subscriptionId) => {
  await paddleRequest(`/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ effectiveFrom: 'next_billing_period' })
  });
  return { success: true };
};

export default {
  PADDLE_TIERS,
  verifyPaddleWebhook,
  createPaddleCheckout,
  getPaddleSubscription,
  cancelPaddleSubscription
};
