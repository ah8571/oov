// iPhone log listener — run on your Windows PC to see iOS logs in real-time.
//
// Usage:
//   1. Find your PC's IP:  ipconfig | findstr "IPv4"
//   2. Update LOG_SERVER_URL in mobile/src/utils/networkLogger.js with that IP
//   3. Run:  node scripts/ios-log-listener.mjs
//   4. Open the dev build on your iPhone (same WiFi network)

import http from 'http';

const PORT = 9999;

const pad = (n) => String(n).padStart(2, '0');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const time = data.t || '';
        const msg = data.msg || '';
        // eslint-disable-next-line no-unused-vars
        const { t, msg: _, ...rest } = data;
        const extra = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
        console.log(`[iOS ${time}] ${msg}${extra}`);
      } catch {
        console.log('[iOS]', body);
      }
      res.writeHead(200);
      res.end('ok');
    });
  } else {
    res.writeHead(200);
    res.end('iOS log listener running');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📱 iOS log listener on port ${PORT}`);
  console.log('   Waiting for connections...\n');
});
