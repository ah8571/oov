import { Resend } from 'resend';
import { getSupabaseClient } from './databaseService.js';

let resendClient = null;
const WAITLIST_TABLE = 'waitlist_subscribers';

const getResendClient = () => {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Resend client not initialized. Missing RESEND_API_KEY');
  }

  resendClient = new Resend(apiKey);
  return resendClient;
};

export const isResendConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

const getSupabaseIfAvailable = () => {
  try {
    return getSupabaseClient();
  } catch (error) {
    return null;
  }
};

export const addNewsletterSubscriber = async ({
  email,
  source = 'landing-page',
  marketingConsent = false,
  consentSource = 'landing-page',
  policyVersion = '2026-06-21',
  consentTimestamp,
  userAgent = 'unknown'
}) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const resolvedConsentTimestamp = consentTimestamp || new Date().toISOString();
  const supabase = getSupabaseIfAvailable();

  if (!supabase) {
    return {
      email: normalizedEmail,
      source,
      marketing_opt_in: Boolean(marketingConsent),
      consent_source: consentSource,
      consent_timestamp: resolvedConsentTimestamp,
      policy_version: policyVersion,
      persisted: false,
      created: true
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from(WAITLIST_TABLE)
    .select('id, email, is_active')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { data: reactivated, error: updateError } = await supabase
      .from(WAITLIST_TABLE)
      .update({
        is_active: true,
        source,
        marketing_opt_in: Boolean(marketingConsent),
        consent_source: consentSource,
        consent_timestamp: resolvedConsentTimestamp,
        policy_version: policyVersion,
        consent_user_agent: userAgent,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select('id, email, is_active, created_at, updated_at, marketing_opt_in, consent_source, consent_timestamp, policy_version')
      .single();

    if (updateError) {
      throw updateError;
    }

    return {
      ...reactivated,
      persisted: true,
      created: false
    };
  }

  const { data: created, error: createError } = await supabase
    .from(WAITLIST_TABLE)
    .insert({
      email: normalizedEmail,
      source,
      is_active: true,
      marketing_opt_in: Boolean(marketingConsent),
      consent_source: consentSource,
      consent_timestamp: resolvedConsentTimestamp,
      policy_version: policyVersion,
      consent_user_agent: userAgent
    })
    .select('id, email, is_active, created_at, updated_at, marketing_opt_in, consent_source, consent_timestamp, policy_version')
    .single();

  if (createError) {
    throw createError;
  }

  return {
    ...created,
    persisted: true,
    created: true
  };
};

export const listActiveSubscribers = async () => {
  const supabase = getSupabaseIfAvailable();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(WAITLIST_TABLE)
    .select('email')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map((entry) => entry.email);
};

export const getNewsletterStats = async () => {
  const supabase = getSupabaseIfAvailable();

  if (!supabase) {
    return {
      waitlistSize: 0,
      signupsThisWeek: 0,
      persisted: false
    };
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [{ count: totalCount, error: totalError }, { count: weeklyCount, error: weeklyError }] = await Promise.all([
    supabase
      .from(WAITLIST_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from(WAITLIST_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('created_at', oneWeekAgo.toISOString())
  ]);

  if (totalError) {
    throw totalError;
  }

  if (weeklyError) {
    throw weeklyError;
  }

  return {
    waitlistSize: totalCount || 0,
    signupsThisWeek: weeklyCount || 0,
    persisted: true
  };
};

export const sendWelcomeEmail = async (email) => {
  if (!isResendConfigured()) {
    return { sent: false, reason: 'Resend not configured' };
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL;

  const subject = 'You are on the Emmaline waitlist ✨';
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color:#111;">You’re in.</h1>
      <p>Thanks for joining the Emmaline waitlist.</p>
      <p>We’ll email you as soon as the MVP is live and ready to download.</p>
      <p style="color:#666; font-size: 14px;">If you did not request this, you can ignore this message.</p>
    </div>
  `;

  const response = await resend.emails.send({
    from,
    to: email,
    subject,
    html
  });

  return {
    sent: true,
    id: response?.data?.id || null
  };
};

export const sendLaunchAnnouncement = async ({ subject, html, text }) => {
  if (!isResendConfigured()) {
    throw new Error('Resend not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL');
  }

  const subscribers = await listActiveSubscribers();
  if (!subscribers.length) {
    return { sentCount: 0, subscriberCount: 0 };
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL;

  const response = await resend.emails.send({
    from,
    to: subscribers,
    subject,
    html,
    text
  });

  return {
    sentCount: subscribers.length,
    subscriberCount: subscribers.length,
    id: response?.data?.id || null
  };
};

export default {
  addNewsletterSubscriber,
  listActiveSubscribers,
  getNewsletterStats,
  sendWelcomeEmail,
  sendLaunchAnnouncement,
  isResendConfigured
};
