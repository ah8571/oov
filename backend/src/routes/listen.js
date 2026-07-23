import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.js';
import { summarizeTranscript } from '../services/aiService.js';
import { saveCall, saveCallCosts, saveSummary, saveTranscript } from '../services/databaseService.js';
import { transcribeWithOpenRouter } from '../services/speechToTextService.js';
import { consumeCredits } from '../services/creditService.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

const getIsoString = (value, fallback) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : fallback;
};

router.post('/sessions', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio recording was uploaded' });
    }

    const durationMs = Math.max(0, Number(req.body?.durationMs || 0));
    const endedAt = getIsoString(req.body?.endedAt, new Date().toISOString());
    const startedAt = getIsoString(
      req.body?.startedAt,
      new Date(new Date(endedAt).getTime() - durationMs).toISOString()
    );
    const languagePreference = String(req.body?.languagePreference || 'en');
    const transcriptText = await transcribeWithOpenRouter(req.file.buffer, {
      language: languagePreference,
      format: req.file.mimetype?.includes('wav') ? 'wav' : 'mp3',
    });

    if (!transcriptText) {
      return res.status(400).json({ error: 'The recording did not produce any transcript text' });
    }

    const callRecord = await saveCall(req.user.userId, {
      phoneNumber: 'listen-mode',
      duration: Math.round(durationMs / 1000),
      startedAt,
      endedAt,
      status: 'completed',
      callMode: 'listen_mode'
    });

    const listenDurationSeconds = Math.round(durationMs / 1000);
    await saveCallCosts(callRecord.id, req.user.userId, [
      {
        pricingTier: 'tier1',
        provider: 'openrouter',
        service: 'speech_to_text',
        quantity: Number((listenDurationSeconds / 60).toFixed(2)),
        unit: 'minutes',
        vendorCostUsd: Number(((listenDurationSeconds / 60) * 0.0015).toFixed(6)),
        billableCostUsd: Number(((listenDurationSeconds / 60) * 0.0015).toFixed(6)),
        measurementSource: 'estimated',
        costSource: 'rate_card',
        metadata: { language: languagePreference }
      },
      {
        pricingTier: 'tier1',
        provider: 'listen_mode',
        service: 'listen_mode_session',
        quantity: listenDurationSeconds,
        unit: 'seconds',
        vendorCostUsd: Number(((listenDurationSeconds / 60) * 0.016).toFixed(6)),
        billableCostUsd: Number(((listenDurationSeconds / 60) * 0.016).toFixed(6)),
        measurementSource: 'stream_measured',
        costSource: 'rate_card',
        metadata: { language: languagePreference }
      }
    ]);

    await saveTranscript(callRecord.id, req.user.userId, transcriptText);

    // Deduct credits for listen mode (1 credit/min)
    let creditResult = null;
    try {
      creditResult = await consumeCredits(req.user.userId, 'listen_mode', listenDurationSeconds, {
        language: languagePreference,
        callId: callRecord.id
      });
    } catch (creditError) {
      console.error('Credit deduction failed for listen session:', creditError.message);
    }

    const summary = await summarizeTranscript(transcriptText, {
      languagePreference
    });

    await saveSummary(callRecord.id, req.user.userId, {
      text: summary.summary,
      keyPoints: summary.keyPoints,
      sentiment: summary.sentiment,
      actionItems: summary.actionItems
    });

    return res.status(201).json({
      success: true,
      callId: callRecord.id,
      transcript: transcriptText,
      summary: summary.summary,
      keyPoints: summary.keyPoints || [],
      actionItems: summary.actionItems || [],
      callMode: 'listen_mode'
    });
  } catch (error) {
    console.error('Listen Mode upload failed:', error.message);
    return res.status(500).json({ error: error.message || 'Unable to process Listen Mode recording' });
  }
});

router.use((error, req, res, next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Recording is too large. Keep Listen Mode sessions under 25 MB.' });
  }

  return next(error);
});

export default router;