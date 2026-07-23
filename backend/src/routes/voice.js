/**
 * Routes for provider-neutral in-app Voice Mode sessions.
 */

import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.js';
import { createOpenAIRealtimeCallAnswer, createOpenAIRealtimeClientSecret } from '../services/openaiRealtimeService.js';
import { generateResponse } from '../services/aiService.js';
import { assertUserCanStartVoiceSession, getUserVoiceBillingStatus } from '../services/billingService.js';
import { consumeCredits } from '../services/creditService.js';
import { transcribeUploadedAudio } from '../services/speechToTextService.js';
import { textToAudio } from '../services/textToSpeechService.js';
import { saveCall, saveCallCosts } from '../services/databaseService.js';

const router = express.Router();
const OPENAI_REALTIME_PROVIDER = 'openai_realtime';
const SUPPORTED_REALTIME_VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

const getDetailedErrorText = (error) => {
  return [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const isBillingSchemaInitializationError = (error) => {
  const detailText = getDetailedErrorText(error);

  if (!detailText) {
    return false;
  }

  return /(free_trial_seconds_granted|prepaid_seconds_balance|billing_state|auto_recharge_enabled|auto_recharge_threshold_seconds|auto_recharge_amount_seconds)/i.test(detailText)
    && /(column|schema|select|users)/i.test(detailText);
};

const normalizeVoiceModeProvider = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, '_');
};

const getConfiguredVoiceModeProvider = () => {
  const explicitProvider = normalizeVoiceModeProvider(process.env.VOICE_MODE_PROVIDER);

  if (explicitProvider) {
    return explicitProvider;
  }

  return OPENAI_REALTIME_PROVIDER;
};

const normalizeRealtimeVoice = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return SUPPORTED_REALTIME_VOICES.has(normalized) ? normalized : null;
};

const parseConversationHistory = (value) => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(String(value));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => ['user', 'assistant'].includes(String(entry?.role || '').toLowerCase()))
      .map((entry) => ({
        role: String(entry.role).toLowerCase(),
        content: String(entry.content || '').trim()
      }))
      .filter((entry) => entry.content)
      .slice(-12);
  } catch {
    return [];
  }
};

const createVoiceSessionResponse = async ({ userId, billingStatus }) => {
  const provider = getConfiguredVoiceModeProvider();

  if (provider === OPENAI_REALTIME_PROVIDER) {
    const session = await createOpenAIRealtimeClientSecret({ userId });

    return {
      success: true,
      provider: session.provider,
      transport: session.transport,
      session,
      billing: billingStatus
    };
  }

  const unsupportedProviderError = new Error(`Unsupported voice mode provider: ${provider}`);
  unsupportedProviderError.code = 'VOICE_PROVIDER_NOT_SUPPORTED';
  throw unsupportedProviderError;
};

const handleCreateVoiceCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    await assertUserCanStartVoiceSession(userId);

    const offerSdp = typeof req.body === 'string' ? req.body : '';
    const requestedVoice = normalizeRealtimeVoice(req.headers['x-oov-voice']);

    if (!offerSdp.trim()) {
      return res.status(400).json({
        error: 'Voice call offer SDP is required',
        code: 'VOICE_CALL_SDP_REQUIRED'
      });
    }

    const answerSdp = await createOpenAIRealtimeCallAnswer({
      userId,
      offerSdp,
      voice: requestedVoice || undefined
    });

    return res
      .status(200)
      .type('application/sdp')
      .send(answerSdp);
  } catch (error) {
    const detailText = getDetailedErrorText(error);
    console.error('Error creating voice call:', detailText || error.message);

    if (error.code === 'VOICE_PAYWALL_REQUIRED') {
      return res.status(error.statusCode || 402).json({
        error: error.message,
        code: error.code,
        billing: error.billingStatus
      });
    }

    if (String(error.message || '').includes('OpenAI realtime call setup failed')) {
      return res.status(502).json({
        error: error.message,
        code: 'VOICE_OPENAI_CALL_FAILED',
        details: detailText || null
      });
    }

    return res.status(500).json({
      error: 'Failed to create voice call',
      code: 'VOICE_CALL_SETUP_FAILED'
    });
  }
};

const handleCompleteRealtimeCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    const durationSeconds = Math.max(0, Math.round(Number(req.body?.durationSeconds || 0)));
    const voice = String(req.body?.voice || 'marin').trim() || 'marin';
    const model = String(req.body?.model || 'gpt-realtime-1.5').trim() || 'gpt-realtime-1.5';

    if (durationSeconds <= 0) {
      return res.status(400).json({ error: 'Call duration must be greater than 0 seconds.' });
    }

    const minutes = durationSeconds / 60;
    const inputMinutes = Number((minutes * 0.4).toFixed(2));
    const outputMinutes = Number((minutes * 0.6).toFixed(2));
    // gpt-4o-mini-realtime-preview pricing: $0.006/min input, $0.024/min output
    const audioInputCostUsd = Number((inputMinutes * 0.006).toFixed(6));
    const audioOutputCostUsd = Number((outputMinutes * 0.024).toFixed(6));
    const totalVendorCostUsd = Number((audioInputCostUsd + audioOutputCostUsd).toFixed(6));

    const call = process.env.SAVE_VOICE_CALLS === 'true'
      ? await saveCall(userId, {
          type: 'voice_realtime',
          status: 'completed',
          duration: durationSeconds,
          startedAt: new Date(Date.now() - durationSeconds * 1000).toISOString(),
          endedAt: new Date().toISOString(),
          metadata: { voice, model, provider: 'openai-realtime' }
        })
      : null;

    if (call) {
      if (call) {
      await saveCallCosts(call.id, userId, [
      {
        pricingTier: 'tier1',
        provider: 'openai',
        service: 'realtime_audio_input',
        quantity: Number(inputMinutes.toFixed(4)),
        unit: 'minutes',
        vendorCostUsd: audioInputCostUsd,
        billableCostUsd: audioInputCostUsd,
        measurementSource: 'estimated',
        costSource: 'rate_card',
        metadata: { voice, model }
      },
      {
        pricingTier: 'tier1',
        provider: 'openai',
        service: 'realtime_audio_output',
        quantity: Number(outputMinutes.toFixed(4)),
        unit: 'minutes',
        vendorCostUsd: audioOutputCostUsd,
        billableCostUsd: audioOutputCostUsd,
        measurementSource: 'estimated',
        costSource: 'rate_card',
        metadata: { voice, model }
      },
      {
        pricingTier: 'tier1',
        provider: 'openai',
        service: 'voice_realtime',
        quantity: durationSeconds,
        unit: 'seconds',
        vendorCostUsd: totalVendorCostUsd,
        billableCostUsd: totalVendorCostUsd,
        measurementSource: 'stream_measured',
        costSource: 'rate_card',
        metadata: { voice, model }
      }
    ]);
    }

    const billingStatus = await getUserVoiceBillingStatus(userId);

    // Deduct credits for voice mode usage (5 credits/min)
    let creditResult = null;
    try {
      creditResult = await consumeCredits(userId, 'voice_mode', durationSeconds, {
        voice,
        model,
        callId: call?.id || null
      });
    } catch (creditError) {
      // Credit deduction is non-fatal — the call already happened.
      console.error('Credit deduction failed for voice call:', creditError.message);
    }

    return res.status(200).json({
      success: true,
      callId: call?.id || null,
      durationSeconds,
      estimatedCostUsd: Number(totalVendorCostUsd.toFixed(4)),
      billing: billingStatus,
      credits: creditResult
        ? {
            consumed: creditResult.consumed,
            balanceAfter: creditResult.balanceAfter,
            balanceBefore: creditResult.balanceBefore
          }
        : null
    });
  } catch (error) {
    console.error('Error completing realtime call:', error.message, error.stack?.split('\n')[1]);
    return res.status(500).json({ error: error.message || 'Failed to record call completion.' });
  }
};

const handleCreateVoiceSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const billingStatus = await assertUserCanStartVoiceSession(userId);
    const response = await createVoiceSessionResponse({ userId, billingStatus });

    return res.status(200).json(response);
  } catch (error) {
    const detailText = getDetailedErrorText(error);
    console.error('Error generating voice session:', detailText || error.message);

    if (error.code === 'VOICE_PAYWALL_REQUIRED') {
      return res.status(error.statusCode || 402).json({
        error: error.message,
        code: error.code,
        billing: error.billingStatus
      });
    }

    if (isBillingSchemaInitializationError(error)) {
      return res.status(500).json({
        error: 'Billing schema is not initialized on the backend',
        code: 'VOICE_BILLING_NOT_INITIALIZED'
      });
    }
    if (String(error.message || '').includes('OPENAI_API_KEY is not configured for voice mode')) {
      return res.status(500).json({
        error: error.message,
        code: 'VOICE_OPENAI_NOT_CONFIGURED'
      });
    }

    if (String(error.message || '').includes('OpenAI realtime session request failed')) {
      return res.status(502).json({
        error: 'OpenAI realtime session request failed',
        code: 'VOICE_OPENAI_SESSION_FAILED'
      });
    }

    if (error.code === 'VOICE_PROVIDER_NOT_SUPPORTED') {
      return res.status(500).json({
        error: error.message,
        code: error.code
      });
    }

    return res.status(500).json({
      error: 'Failed to generate voice session',
      code: 'VOICE_SESSION_GENERATION_FAILED'
    });
  }
};

const handleVoiceTurn = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio recording was uploaded' });
    }

    const userId = req.user.userId;
    const billingStatus = await assertUserCanStartVoiceSession(userId);
    const languagePreference = String(req.body?.languagePreference || 'en');
    const conversationHistory = parseConversationHistory(req.body?.conversationHistory);
    const transcript = await transcribeUploadedAudio(req.file, { languagePreference });

    if (!transcript) {
      return res.status(400).json({ error: 'The recording did not produce any transcript text' });
    }

    const nextConversationHistory = [
      ...conversationHistory,
      { role: 'user', content: transcript }
    ];
    const assistantResponse = await generateResponse(nextConversationHistory, { languagePreference });

    if (!assistantResponse.text) {
      throw new Error('AI response was empty');
    }

    const audioBuffer = await textToAudio(assistantResponse.text, {
      provider: 'openai'
    });

    return res.status(200).json({
      success: true,
      billing: billingStatus,
      transcript,
      assistantText: assistantResponse.text,
      conversationHistory: [
        ...nextConversationHistory,
        { role: 'assistant', content: assistantResponse.text }
      ],
      audioBase64: audioBuffer.toString('base64'),
      audioMimeType: 'audio/mpeg'
    });
  } catch (error) {
    const detailText = getDetailedErrorText(error);
    console.error('Voice turn failed:', detailText || error.message);

    if (error.code === 'VOICE_PAYWALL_REQUIRED') {
      return res.status(error.statusCode || 402).json({
        error: error.message,
        code: error.code,
        billing: error.billingStatus
      });
    }

    return res.status(500).json({
      error: error.message || 'Unable to process the Voice Mode turn',
      code: 'VOICE_TURN_FAILED'
    });
  }
};

/**
 * POST /api/voice/session
 * Mint a provider-specific in-app voice mode session for the authenticated user.
 */
router.post('/session', authMiddleware, handleCreateVoiceSession);
router.post('/call', authMiddleware, express.text({ type: ['application/sdp', 'text/plain'], limit: '2mb' }), handleCreateVoiceCall);
router.post('/call/complete', authMiddleware, handleCompleteRealtimeCall);
router.post('/turn', authMiddleware, upload.single('audio'), handleVoiceTurn);

router.use((error, req, res, next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Recording is too large. Keep Voice Mode turns under 25 MB.' });
  }

  return next(error);
});

export default router;
