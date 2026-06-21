import express from 'express';

import authMiddleware, { optionalAuth } from '../middleware/auth.js';
import {
  createSupportRequest,
  deleteUserAccount,
  isSupportEmailConfigured,
  logAccountDeletionRequest,
  sendSupportRequestEmail
} from '../services/supportService.js';

const router = express.Router();

router.post('/requests', optionalAuth, async (req, res) => {
  try {
    const {
      name = '',
      email,
      subject,
      message,
      source = 'support_page',
      category = 'general'
    } = req.body;

    if (!email || !subject || !message) {
      return res.status(400).json({ error: 'Email, subject, and message are required' });
    }

    const supportRequest = await createSupportRequest({
      userId: req.user?.userId || null,
      accountEmail: req.user?.email || null,
      name,
      email,
      subject,
      message,
      source,
      category,
      userAgent: req.get('user-agent') || 'unknown'
    });

    let emailDelivery = { sent: false, reason: 'Support email not configured' };

    if (isSupportEmailConfigured()) {
      emailDelivery = await sendSupportRequestEmail({
        requestId: supportRequest.id,
        userId: req.user?.userId || null,
        accountEmail: req.user?.email || null,
        name,
        email,
        subject,
        message,
        source,
        category
      });
    }

    return res.status(201).json({
      message: 'Support request submitted',
      supportRequest,
      emailDelivery
    });
  } catch (error) {
    console.error('Support request error:', error.message);
    return res.status(500).json({ error: 'Failed to submit support request' });
  }
});

router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { reason = '', source = 'mobile_settings' } = req.body || {};

    await logAccountDeletionRequest({
      userId: req.user.userId,
      email: req.user.email,
      reason,
      source,
      userAgent: req.get('user-agent') || 'unknown'
    });

    await deleteUserAccount({ userId: req.user.userId });

    return res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error.message);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;