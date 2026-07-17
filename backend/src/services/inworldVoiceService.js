import crypto from 'crypto';

const INWORLD_API_KEY = process.env.INWORLD_API_KEY || '';
const INWORLD_HOST = process.env.INWORLD_HOST || 'api.inworld.ai';
const INWORLD_ENGINE_HOST = process.env.INWORLD_ENGINE_HOST || 'api-engine.inworld.ai';
const INWORLD_WS_BASE = `wss://${INWORLD_HOST}/api/v1/realtime/session`;

const resolveApiKey = () => {
  const basic = String(INWORLD_API_KEY).trim();
  if (!basic) {
    throw new Error('INWORLD_API_KEY is not configured.');
  }

  // INWORLD_API_KEY is the Base64-encoded "key:secret" from the Inworld Portal
  const decoded = Buffer.from(basic, 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  const key = idx > 0 ? decoded.slice(0, idx) : '';
  const secret = idx > 0 ? decoded.slice(idx + 1) : '';

  if (!key || !secret) {
    throw new Error('INWORLD_API_KEY must be Base64 of "<key>:<secret>". Copy the Base64 credential from the Inworld Portal API Keys page.');
  }

  return { key, secret };
};

const getDateTime = () => {
  const parts = new Date().toISOString().split('T');
  const date = parts[0].replace(/-/g, '');
  const time = parts[1].replace(/:/g, '').substring(0, 6);
  return `${date}${time}`;
};

const getSignatureKey = (secret, params) => {
  // Match crypto-js HmacSHA256: intermediate values are binary (WordArray),
  // not hex strings. Only the final call gets .toString().
  let signature = Buffer.from(`IW1${secret}`, 'utf8');

  for (const param of params) {
    signature = crypto.createHmac('sha256', signature).update(param).digest();
  }

  return crypto.createHmac('sha256', signature).update('iw1_request').digest('hex');
};

const generateAuthHeader = () => {
  const { key, secret } = resolveApiKey();
  const host = String(INWORLD_HOST).trim();
  const engineHost = String(INWORLD_ENGINE_HOST).trim().replace(':443', '');

  const path = '/ai.inworld.engine.WorldEngine/GenerateToken';
  const datetime = getDateTime();
  const nonce = crypto.randomBytes(16).toString('hex').slice(1, 12);
  const method = path.substring(1);

  const signature = getSignatureKey(secret, [
    datetime,
    engineHost,
    method,
    nonce
  ]);

  return `IW1-HMAC-SHA256 ApiKey=${key},DateTime=${datetime},Nonce=${nonce},Signature=${signature}`;
};

export const createInworldSession = async (options = {}) => {
  const { key } = resolveApiKey();
  const host = String(INWORLD_HOST).trim();
  const authHeader = generateAuthHeader();

  const tokenResponse = await fetch(`https://${host}/auth/v1/tokens/token:generate`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key,
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
