/**
 * Routes for provider-neutral in-app Voice Mode sessions.
 */

import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { createOpenAIRealtimeClientSecret } from '../services/openaiRealtimeService.js';
import { assertUserCanStartVoiceSession } from '../services/billingService.js';

const router = express.Router();
const OPENAI_REALTIME_PROVIDER = 'openai_realtime';

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

/**
 * POST /api/voice/session
 * Mint a provider-specific in-app voice mode session for the authenticated user.
 */
router.post('/session', authMiddleware, handleCreateVoiceSession);

export default router;
