import crypto from 'crypto';
import { HmacSHA256 } from 'crypto-js';

const INWORLD_API_KEY = process.env.INWORLD_API_KEY || '';
const INWORLD_HOST = process.env.INWORLD_HOST || 'api.inworld.ai';
const INWORLD_ENGINE_HOST = process.env.INWORLD_ENGINE_HOST || 'api-engine.inworld.ai';
const INWORLD_WS_BASE = `wss://${INWORLD_HOST}/api/v1/realtime/session`;

const resolveApiKey = () => {
  const basic = String(INWORLD_API_KEY).trim();
  if (!basic) {
    throw new Error('INWORLD_API_KEY is not configured.');
  }

  // INWORLD_API_KEY is the Base64-encoded "key:secret" from the Inworld Studio API Keys panel
  const decoded = Buffer.from(basic, 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  const key = idx > 0 ? decoded.slice(0, idx) : '';
  const secret = idx > 0 ? decoded.slice(idx + 1) : '';

  if (!key || !secret) {
    throw new Error('INWORLD_API_KEY must be Base64 of "<key>:<secret>". Copy the Base64 credential from the Inworld Studio API Keys page.');
  }

  return { key, secret };
};

const getDateTime = () => {
  const parts = new Date().toISOString().split('T');
  const date = parts[0].replace(/-/g, '');
  const time = parts[1].replace(/:/g, '').substring(0, 6);
  return `${date}${time}`;
};

// Exact copy of the official Inworld JWT sample: getSignatureKey
// Uses crypto-js HmacSHA256 where intermediate values are WordArray objects
const getSignatureKey = (secret, params) => {
  let signature = `IW1${secret}`;

  for (const param of params) {
    signature = HmacSHA256(param, signature);
  }

  return HmacSHA256('iw1_request', signature).toString();
};

const generateAuthHeader = () => {
  const { key, secret } = resolveApiKey();
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
