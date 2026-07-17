import crypto from 'crypto';

const INWORLD_API_KEY = process.env.INWORLD_API_KEY || '';
const INWORLD_HOST = process.env.INWORLD_HOST || 'api.inworld.ai';
const INWORLD_WS_BASE = `wss://${INWORLD_HOST}/api/v1/realtime/session`;

const getInworldApiKey = () => {
  const key = String(INWORLD_API_KEY).trim();
  if (!key) {
    throw new Error('INWORLD_API_KEY is not configured. Set INWORLD_API_KEY in the backend environment.');
  }
  return key;
};

const generateSignature = (apiKey, dateTime, host, nonce) => {
  let signature = `IW1${apiKey}`;

  const params = [dateTime, host, 'ai.inworld.engine.WorldEngine/GenerateToken', nonce];

  // HmacSHA256(param, signature) — param is the message, signature is the key
  for (const param of params) {
    signature = crypto.createHmac('sha256', signature).update(param).digest('hex');
  }

  return crypto.createHmac('sha256', signature).update('iw1_request').digest('hex');
};

export const createInworldSession = async (options = {}) => {
  const apiKey = getInworldApiKey();
  const host = String(INWORLD_HOST).trim();
  const now = new Date();
  const dateTime = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0')
  ].join('');

  const nonce = crypto.randomBytes(16).toString('hex');

  const signature = generateSignature(apiKey, dateTime, host, nonce);

  const authHeader = `IW1-HMAC-SHA256 ApiKey=${apiKey},DateTime=${dateTime},Nonce=${nonce},Signature=${signature}`;

  // Mint a JWT via the token endpoint
  const tokenResponse = await fetch(`https://${host}/auth/v1/tokens/token:generate`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: apiKey,
      resources: []
    })
  });

  if (!tokenResponse.ok) {
    const detailText = await tokenResponse.text();
    throw new Error(`Inworld JWT request failed (${tokenResponse.status}): ${detailText}`);
  }

  const data = await tokenResponse.json();
  const jwt = data?.token || null;

  if (!jwt) {
    throw new Error('Inworld token response did not include a JWT.');
  }

  const sessionId = data?.sessionId || `emmaline-${Date.now()}`;

  return {
    provider: 'inworld-voice',
    transport: 'websocket',
    jwt,
    wsUrl: `${INWORLD_WS_BASE}?key=${encodeURIComponent(sessionId)}&protocol=realtime`,
    sessionId,
    expiresAt: data?.expirationTime || null
  };
};

export const buildInworldRealtimeConfig = () => ({
  provider: 'inworld-voice',
  transport: 'websocket'
});

export default {
  createInworldSession,
  buildInworldRealtimeConfig
};
