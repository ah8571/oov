/**
 * Network-based logger for iOS debugging from Windows.
 * POSTs log messages to a local server over the same WiFi network.
 *
 * Usage:
 *   import { networkLog } from './utils/networkLogger';
 *   networkLog('import screen opened', { fileCount: 3 });
 */

const LOG_SERVER_URL = 'http://192.168.1.153:9999';

let enabled = false;

export const enableNetworkLog = (pcIp) => {
  enabled = true;
  // Allow overriding the URL
};

export const disableNetworkLog = () => {
  enabled = false;
};

export const networkLog = (message, data = {}) => {
  if (!enabled) return;

  fetch(`${LOG_SERVER_URL}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      t: new Date().toISOString().split('T')[1].slice(0, 12),
      msg: message,
      ...data
    })
  }).catch(() => {}); // fire-and-forget, don't crash if server is down
};
