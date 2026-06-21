/**
 * Routes for newsletter and waitlist management
 */

import express from 'express';
import {
  addNewsletterSubscriber,
  getNewsletterStats,
  sendLaunchAnnouncement,
  sendWelcomeEmail,
  isResendConfigured
} from '../services/newsletterService.js';

const router = express.Router();

const isAdminAuthorized = (req) => {
  const configuredKey = process.env.NEWSLETTER_ADMIN_KEY;
  if (!configuredKey) {
    return false;
  }

  const providedKey = req.headers['x-admin-key'];
  return providedKey === configuredKey;
};

/**
 * POST /api/newsletter
 * Subscribe email to newsletter/waitlist
 */
router.post('/', async (req, res) => {
  try {
    const {
      email,
      source,
      marketingConsent = false,
      consentSource,
      policyVersion,
      consentTimestamp,
      userAgent
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const subscriber = await addNewsletterSubscriber({
      email,
      source,
      marketingConsent: Boolean(marketingConsent),
      consentSource: consentSource || source || 'landing-page',
      policyVersion: policyVersion || '2026-06-21',
      consentTimestamp,
      userAgent
    });

    let welcomeEmail = { sent: false, reason: 'Skipped' };
    if (isResendConfigured()) {
      try {
        welcomeEmail = await sendWelcomeEmail(subscriber.email);
      } catch (emailError) {
        console.error('Welcome email failed:', emailError.message);
        welcomeEmail = { sent: false, reason: emailError.message };
      }
    }

    console.log(`Waitlist signup: ${subscriber.email} (source: ${source || 'unknown'})`);

    return res.status(201).json({
      message: 'Successfully joined the waitlist',
      email: subscriber.email,
      created: subscriber.created,
      persisted: subscriber.persisted,
      welcomeEmail
    });
  } catch (error) {
    console.error('Waitlist signup error:', error);
    return res.status(500).json({ error: 'Failed to subscribe' });
  }
});

/**
 * GET /api/newsletter/stats
 * Get waitlist statistics (admin only)
 */
router.get('/stats', async (req, res) => {
  try {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await getNewsletterStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching newsletter stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * POST /api/newsletter/notify-launch
 * Send launch notification to all active subscribers (admin only)
 */
router.post('/notify-launch', async (req, res) => {
  try {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subject, html, text } = req.body;

    if (!subject || !html) {
      return res.status(400).json({ error: 'subject and html are required' });
    }

    const result = await sendLaunchAnnouncement({ subject, html, text });
    return res.status(200).json({
      message: 'Launch email sent',
      ...result
    });
  } catch (error) {
    console.error('Error sending launch notification:', error);
    return res.status(500).json({ error: 'Failed to send launch notification' });
  }
});

export default router;
