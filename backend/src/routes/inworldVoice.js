import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { assertUserCanStartVoiceSession } from '../services/billingService.js';
import { createInworldSession, buildInworldRealtimeConfig } from '../services/inworldVoiceService.js';
import { inworldRtcConfigHandler } from '../controllers/inworldRtcController.js';

const router = express.Router();

router.get('/rtc-config', inworldRtcConfigHandler);

router.post('/session', authMiddleware, async (req, res) => {
  try {
    await assertUserCanStartVoiceSession(req.user?.userId);
    const sessionResponse = await createInworldSession(req.body || {});
    return res.json({
      success: true,
      ...sessionResponse
    });
  } catch (error) {
    console.error('Inworld voice session error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Unable to start Inworld voice session.' });
  }
});

router.get('/config', (_req, res) => {
  res.json({
    success: true,
    config: buildInworldRealtimeConfig()
  });
});

export default router;
