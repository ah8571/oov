import { createInworldSession } from '../services/inworldVoiceService.js';
import WebSocket from 'ws';

let proxyCounter = 0;

export const handleInworldWebSocket = async (clientWs, _req) => {
  const proxyId = ++proxyCounter;
  let inworldWs = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    try { inworldWs?.close(); } catch {}
    try { clientWs.close(); } catch {}
  };

  try {
    console.log(`[InworldProxy:${proxyId}] Minting JWT...`);
    const session = await createInworldSession();
    const { wsUrl, jwt } = session;

    console.log(`[InworldProxy:${proxyId}] Connecting to Inworld...`);
    inworldWs = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    });

    inworldWs.on('open', () => {
      console.log(`[InworldProxy:${proxyId}] Inworld WebSocket connected`);
    });

    inworldWs.on('message', (data) => {
      if (closed) return;
      try {
        clientWs.send(typeof data === 'string' ? data : data.toString());
      } catch {}
    });

    inworldWs.on('close', (code, reason) => {
      console.log(`[InworldProxy:${proxyId}] Inworld closed: ${code} ${reason}`);
      cleanup();
    });

    inworldWs.on('error', (err) => {
      console.error(`[InworldProxy:${proxyId}] Inworld error:`, err.message);
      cleanup();
    });

    clientWs.on('message', (data) => {
      if (closed || !inworldWs || inworldWs.readyState !== WebSocket.OPEN) return;
      try {
        inworldWs.send(typeof data === 'string' ? data : data.toString());
      } catch {}
    });

    clientWs.on('close', () => {
      console.log(`[InworldProxy:${proxyId}] Client disconnected`);
      cleanup();
    });

    clientWs.on('error', (err) => {
      console.error(`[InworldProxy:${proxyId}] Client error:`, err.message);
      cleanup();
    });

  } catch (err) {
    console.error(`[InworldProxy:${proxyId}] Setup failed:`, err.message);
    cleanup();
  }
};
