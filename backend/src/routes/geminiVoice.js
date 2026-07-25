import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { assertUserCanStartVoiceSession } from '../services/billingService.js';
import { createGeminiVoiceSession, buildGeminiRealtimeConfig } from '../services/geminiVoiceService.js';

const router = express.Router();

router.post('/session', authMiddleware, async (req, res) => {
  try {
    await assertUserCanStartVoiceSession(req.user?.userId);
    const tokenResponse = await createGeminiVoiceSession();
    return res.json({
      success: true,
      ...tokenResponse
    });
  } catch (error) {
    console.error('Gemini voice session error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Unable to start Gemini voice session.' });
  }
});

router.get('/config', (_req, res) => {
  res.json({
    success: true,
    config: buildGeminiRealtimeConfig()
  });
});

export default router;
