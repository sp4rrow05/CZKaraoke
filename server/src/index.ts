import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types.ts';
import { RoomError, RoomStore } from './rooms.ts';
import { RateLimiter } from './security.ts';
import { registerSocketHandlers } from './socket.ts';
import { SearchError, searchVideos } from './youtube.ts';

const PORT = Number(process.env.PORT ?? 3001);

/**
 * Sites allowed to call this server from another origin (e.g. the Vercel-hosted pages).
 * Comma-separated; "*" works as a wildcard, e.g. "https://czkaraoke.vercel.app,https://czkaraoke-*.vercel.app".
 */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean)
  // "*" matches within one hostname label, so "https://app-*.vercel.app" can't match "evil.com/…".
  .map((o) => new RegExp('^' + o.split('*').map(escapeRegExp).join('[a-z0-9-]*') + '$', 'i'));
const isAllowedOrigin = (origin: string | undefined) => !!origin && allowedOrigins.some((re) => re.test(origin));

const store = new RoomStore();
const joinLimiter = new RateLimiter(5, 10 * 60 * 1000);

const app = express();
// Behind a hosting proxy (Render, Railway…) set TRUST_PROXY=1 so rate limits see each visitor's real IP.
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy ? (/^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy) : 'loopback');
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin!);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-room, x-member, x-token');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(isAllowedOrigin(origin) ? 204 : 403);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/rooms', (_req, res) => {
  res.json({ rooms: store.listActive().slice(0, 50) });
});

app.post('/api/rooms', (req, res) => {
  try {
    const { room, member } = store.create(req.body?.nickname, req.body?.password);
    res.json({ code: room.code, memberId: member.id, token: member.token, nickname: member.nickname });
  } catch (err) {
    if (err instanceof RoomError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

app.post('/api/rooms/:code/join', (req, res) => {
  const code = req.params.code.toUpperCase();
  const limitKey = `${req.ip}:${code}`;
  if (joinLimiter.isBlocked(limitKey)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in a few minutes.' });
  }
  try {
    const result = store.join(code, req.body?.nickname, req.body?.password);
    if (!result) {
      joinLimiter.fail(limitKey);
      return res.status(401).json({ error: 'Wrong room code or password.' });
    }
    joinLimiter.reset(limitKey);
    const { room, member } = result;
    res.json({ code: room.code, memberId: member.id, token: member.token, nickname: member.nickname });
  } catch (err) {
    if (err instanceof RoomError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

app.get('/api/search', async (req, res) => {
  const auth = store.authenticate(req.header('x-room'), req.header('x-member'), req.header('x-token'));
  if (!auth) return res.status(401).json({ error: 'Not a member of this room.' });

  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  if (!q) return res.json({ results: [] });
  try {
    const results = await searchVideos(q, req.query.karaoke !== '0');
    res.json({ results });
  } catch (err) {
    if (err instanceof SearchError) return res.status(502).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// In production, serve the built client.
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile('index.html', { root: clientDist }));
}

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin)) },
});
registerSocketHandlers(io, store);

httpServer.listen(PORT, () => {
  console.log(`Karaoke server on http://localhost:${PORT}`);
  if (allowedOrigins.length) console.log(`Accepting requests from: ${process.env.CLIENT_ORIGIN}`);
  if (!process.env.YOUTUBE_API_KEY) console.warn('Warning: YOUTUBE_API_KEY is not set; search will not work.');
});
