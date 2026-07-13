import crypto from 'crypto';

const OPENAI_REALTIME_ENDPOINT = 'https://api.openai.com/v1/realtime/client_secrets';
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1';
const OPENAI_REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'marin';
const OPENAI_REALTIME_INSTRUCTIONS = process.env.OPENAI_REALTIME_INSTRUCTIONS
  || 'You are Emmaline, a calm and helpful voice assistant. Keep responses concise, natural, and easy to follow when spoken aloud.';

const getOpenAIRealtimeApiKey = () => {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured for voice mode.');
  }

  return apiKey;
};

const createSafetyIdentifier = (userId) => {
  return crypto
    .createHash('sha256')
    .update(`voice-mode:${userId}`)
    .digest('hex');
};

export const createOpenAIRealtimeClientSecret = async ({ userId }) => {
  const apiKey = getOpenAIRealtimeApiKey();
  const response = await fetch(OPENAI_REALTIME_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createSafetyIdentifier(userId)
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: OPENAI_REALTIME_MODEL,
        instructions: OPENAI_REALTIME_INSTRUCTIONS,
        audio: {
          output: {
            voice: OPENAI_REALTIME_VOICE
          }
        }
      }
    })
  });

  if (!response.ok) {
    const detailText = await response.text();
    throw new Error(`OpenAI realtime session request failed (${response.status}): ${detailText}`);
  }

  const data = await response.json();
  const clientSecret = data?.value || data?.client_secret?.value || null;

  if (!clientSecret) {
    throw new Error('OpenAI realtime session response did not include a client secret.');
  }

  return {
    provider: 'openai-realtime',
    transport: 'webrtc-ephemeral-key',
    clientSecret,
    expiresAt: data?.expires_at || data?.client_secret?.expires_at || null,
    model: data?.session?.model || OPENAI_REALTIME_MODEL,
    voice: data?.session?.audio?.output?.voice || OPENAI_REALTIME_VOICE,
    sessionId: data?.session?.id || null
  };
};