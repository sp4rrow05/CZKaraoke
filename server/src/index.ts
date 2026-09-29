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
const store = new RoomStore();
const joinLimiter = new RateLimiter(5, 10 * 60 * 1000);

const app = express();
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '10kb' }));

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
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
registerSocketHandlers(io, store);

httpServer.listen(PORT, () => {
  console.log(`Karaoke server on http://localhost:${PORT}`);
  if (!process.env.YOUTUBE_API_KEY) console.warn('Warning: YOUTUBE_API_KEY is not set; search will not work.');
});
