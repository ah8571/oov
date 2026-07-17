import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';

// Load environment variables
dotenv.config();

// Import routes
import callRoutes from './routes/calls.js';
import noteRoutes from './routes/notes.js';
import authRoutes from './routes/auth.js';
import billingRoutes from './routes/billing.js';
import listenRoutes from './routes/listen.js';
import newsletterRoutes from './routes/newsletter.js';
import readerRoutes from './routes/reader.js';
import supportRoutes from './routes/support.js';
import voiceRoutes from './routes/voice.js';
import grokVoiceRoutes from './routes/grokVoice.js';
import geminiVoiceRoutes from './routes/geminiVoice.js';
import inworldVoiceRoutes from './routes/inworldVoice.js';

// Import middleware
import { errorHandler, requestLogger } from './middleware/index.js';

// Import WebSocket handler
import { handleEchoWebSocket } from './websocket/echoHandler.js';
import { handleInworldWebSocket } from './websocket/inworldProxyHandler.js';
import { getGoogleCloudConfigStatus } from './services/googleCloudAuth.js';
import { getSupabaseDebugInfo } from './services/databaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Create WebSocket servers for media streams and a minimal echo endpoint.
const websocketRoutes = [
  {
    path: '/ws/echo',
    handler: handleEchoWebSocket
  },
  {
    path: '/api/ws/echo',
    handler: handleEchoWebSocket
  },
  {
    path: '/ws/inworld',
    handler: handleInworldWebSocket
  },
  {
    path: '/api/ws/inworld',
    handler: handleInworldWebSocket
  }
];
const websocketServers = new Map(
  websocketRoutes.map(({ path, handler }) => {
    const wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate: false
    });

    wss.on('connection', handler);

    return [path, wss];
  })
);

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  const wss = websocketServers.get(pathname);

  if (!wss) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
// Keep both prefixed and unprefixed mounts so deployments that already route
// /api/* to this service don't require clients to use /api/api/*.
app.use('/api/calls', callRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/listen', listenRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/reader', readerRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/voice/grok', grokVoiceRoutes);
app.use('/api/voice/gemini', geminiVoiceRoutes);
app.use('/api/voice/inworld', inworldVoiceRoutes);

app.use('/calls', callRoutes);
app.use('/notes', noteRoutes);
app.use('/auth', authRoutes);
app.use('/billing', billingRoutes);
app.use('/listen', listenRoutes);
app.use('/newsletter', newsletterRoutes);
app.use('/reader', readerRoutes);
app.use('/support', supportRoutes);
app.use('/voice', voiceRoutes);
app.use('/voice/grok', grokVoiceRoutes);
app.use('/voice/gemini', geminiVoiceRoutes);
app.use('/voice/inworld', inworldVoiceRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  const forwardedProto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const forwardedHost = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
  const websocketProtocol = forwardedProto === 'https' ? 'wss' : 'ws';

  res.status(200).json({
    message: 'Emmaline AI Phone Call Buddy - Backend API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      calls: '/api/calls',
      notes: '/api/notes',
      auth: '/api/auth',
      billing: '/api/billing',
      listen: '/api/listen',
      reader: '/api/reader',
      support: '/api/support',
      voice: '/api/voice',
      websocketEcho: `${websocketProtocol}://${forwardedHost}/ws/echo`
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  const googleCloudStatus = getGoogleCloudConfigStatus();
  const supabaseDebug = getSupabaseDebugInfo();

  console.log(`🚀 Emmaline backend running on port ${PORT}`);
  websocketRoutes.forEach(({ path }) => {
    console.log(`📡 WebSocket server listening at wss://localhost:${PORT}${path}`);
  });
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Twilio account configured: ${process.env.TWILIO_ACCOUNT_SID ? '✓' : '✗'}`);
  console.log(`Supabase DB client configured: ${supabaseDebug.configured ? '✓' : '✗'}`);
  console.log(`Supabase auth client configured: ${supabaseDebug.authConfigured ? '✓' : '✗'}`);
  console.log(`OpenAI configured: ${process.env.OPENAI_API_KEY ? '✓' : '✗'}`);
  console.log(`Google Cloud project configured: ${googleCloudStatus.hasProjectId ? '✓' : '✗'}`);
  console.log(`Google Cloud credentials configured: ${googleCloudStatus.hasCredentials ? '✓' : '✗'}`);
});

export default app;

