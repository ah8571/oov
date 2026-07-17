import express from 'express';
import { createGeminiVoiceSession, buildGeminiRealtimeConfig } from '../services/geminiVoiceService.js';

const router = express.Router();

router.post('/session', async (req, res) => {
  try {
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
