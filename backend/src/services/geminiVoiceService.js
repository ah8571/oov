const GEMINI_MODEL = process.env.GEMINI_VOICE_MODEL || 'gemini-3.1-flash-live-preview';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const getGeminiApiKey = () => {
  const key = String(GEMINI_API_KEY).trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured. Set GEMINI_API_KEY in the backend environment.');
  }
  return key;
};

export const createGeminiVoiceSession = async () => {
  const apiKey = getGeminiApiKey();

  // Gemini BidiGenerateContent uses the API key directly as a query parameter.
  // No ephemeral token exchange needed — WebSocket auth via ?key=.
  return {
    provider: 'gemini-voice',
    transport: 'websocket',
    wsUrl: `${GEMINI_WS_BASE}?key=${encodeURIComponent(apiKey)}`,
    model: GEMINI_MODEL
  };
};

export const buildGeminiRealtimeConfig = () => ({
  provider: 'gemini-voice',
  transport: 'websocket',
  model: GEMINI_MODEL
});

export default {
  createGeminiVoiceSession,
  buildGeminiRealtimeConfig
};
