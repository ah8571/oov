import { Resend } from 'resend';

import { getSupabaseClient } from './databaseService.js';

let resendClient = null;

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

const getSupabaseIfAvailable = () => {
  try {
    return getSupabaseClient();
  } catch {
    return null;
  }
};

export const isSupportEmailConfigured = () => {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.SUPPORT_EMAIL_TO);
};

export const isSupportConfirmationConfigured = () => {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
};

export const createSupportRequest = async ({
  userId = null,
  accountEmail = null,
  name = '',
  email,
  subject,
  message,
  source = 'support_page',
  category = 'general',
  userAgent = 'unknown'
}) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const trimmedSubject = String(subject || '').trim();
  const trimmedMessage = String(message || '').trim();
  const trimmedName = String(name || '').trim();
  const supabase = getSupabaseIfAvailable();

  if (!normalizedEmail || !trimmedSubject || !trimmedMessage) {
    throw new Error('Email, subject, and message are required');
  }

  if (!supabase) {
    return {
      id: null,
      email: normalizedEmail,
      subject: trimmedSubject,
      persisted: false,
      delivered: false
    };
  }

  const { data, error } = await supabase
    .from('support_requests')
    .insert({
      user_id: userId,
      account_email: accountEmail,
      name: trimmedName || null,
      email: normalizedEmail,
      subject: trimmedSubject,
      message: trimmedMessage,
      source,
      category,
      user_agent: userAgent,
      status: 'open'
    })
    .select('id, email, subject, status, created_at')
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    persisted: true,
    delivered: false
  };
};

export const sendSupportRequestEmail = async ({
  requestId,
  name = '',
  email,
  subject,
  message,
  source,
  category,
  accountEmail = null,
  userId = null
}) => {
  if (!isSupportEmailConfigured()) {
    return { sent: false, reason: 'Support email not configured' };
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.SUPPORT_EMAIL_TO;

  const response = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject: `[Emmaline Support] ${subject}`,
    text: [
      `Request ID: ${requestId || 'n/a'}`,
      `Name: ${name || 'Not provided'}`,
      `Email: ${email}`,
      `Account email: ${accountEmail || 'Not provided'}`,
      `User ID: ${userId || 'Not provided'}`,
      `Source: ${source}`,
      `Category: ${category}`,
      '',
      message
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2>Emmaline support request</h2>
        <p><strong>Request ID:</strong> ${requestId || 'n/a'}</p>
        <p><strong>Name:</strong> ${name || 'Not provided'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Account email:</strong> ${accountEmail || 'Not provided'}</p>
        <p><strong>User ID:</strong> ${userId || 'Not provided'}</p>
        <p><strong>Source:</strong> ${source}</p>
        <p><strong>Category:</strong> ${category}</p>
        <hr />
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
    `
  });

  return {
    sent: true,
    id: response?.data?.id || null
  };
};

export const sendSupportConfirmationEmail = async ({
  requestId,
  name = '',
  email,
  subject
}) => {
  if (!isSupportConfirmationConfigured()) {
    return { sent: false, reason: 'Support confirmation email not configured' };
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL;
  const displayName = String(name || '').trim() || 'there';

  const response = await resend.emails.send({
    from,
    to: email,
    subject: 'Support request submitted for Emmaline',
    text: [
      `Hi ${displayName},`,
      '',
      'Your support request was submitted successfully.',
      `Subject: ${subject}`,
      `Request ID: ${requestId || 'n/a'}`,
      '',
      'We will reply by email with updates.',
      '',
      'Emmaline Support'
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
        <h2 style="margin-bottom: 16px;">Support request submitted</h2>
        <p>Hi ${displayName},</p>
        <p>Your support request was submitted successfully.</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Request ID:</strong> ${requestId || 'n/a'}</p>
        <p>We will reply by email with updates.</p>
        <p style="margin-top: 24px;">Emmaline Support</p>
      </div>
    `
  });

  return {
    sent: true,
    id: response?.data?.id || null
  };
};

export const logAccountDeletionRequest = async ({
  userId,
  email,
  reason = '',
  source = 'mobile_settings',
  userAgent = 'unknown'
}) => {
  const supabase = getSupabaseIfAvailable();

  if (!supabase) {
    return { persisted: false };
  }

  const { data, error } = await supabase
    .from('account_deletion_requests')
    .insert({
      user_id: userId,
      email,
      reason: String(reason || '').trim() || null,
      source,
      user_agent: userAgent,
      requested_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: 'completed'
    })
    .select('id, email, requested_at, completed_at, status')
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    persisted: true
  };
};

export const deleteUserAccount = async ({ userId }) => {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) {
    throw error;
  }

  return { success: true };
};

export default {
  createSupportRequest,
  sendSupportRequestEmail,
  sendSupportConfirmationEmail,
  logAccountDeletionRequest,
  deleteUserAccount,
  isSupportEmailConfigured,
  isSupportConfirmationConfigured
};