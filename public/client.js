import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as spotify from '../spotify.js';
import crypto from 'node:crypto';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/* ---- Memoria volátil (prod => Redis) ---- */
const sessions = new Map();

/* Crear sesión */
app.post('/api/session', async (req, res) => {
  const { playlistUrl } = req.body;
  const playlistId = playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/)?.[1];
  if (!playlistId) return res.status(400).json({ error: 'URL de playlist inválida' });

  const tracks = await spotify.getPlaylistTracks(playlistId);
  const id = crypto.randomBytes(3).toString('hex'); // p.e. "a3f9c1"
  sessions.set(id, { tracks, state: { current: 0, playing: false }, players: {} });
  res.json({ id });
});

/* Unirse como jugador */
app.get('/api/session/:id/board', (req, res) => {
  const { id } = req.params;
  const session = sessions.get(id);
  if (!session) return res.status(404).end();
  const board = shuffle(session.tracks).slice(0, 25);
  res.json({ board });
});

/* --- WebSockets --- */
io.on('connection', socket => {
  socket.on('join', ({ sessionId, role }) => {
    socket.join(sessionId);
    socket.data.role = role;
    socket.data.sessionId = sessionId;
  });

  socket.on('admin:play', () => broadcastState(socket, 'play'));
  socket.on('admin:pause', () => broadcastState(socket, 'pause'));
  socket.on('admin:next', () => broadcastState(socket, 'next'));

  socket.on('player:mark', ({ index }) => {
    socket.to(socket.data.sessionId).emit('player:mark', { player: socket.id, index });
  });
});

function broadcastState(socket, action) {
  const { sessionId } = socket.data;
  io.to(sessionId).emit('state', { action, ts: Date.now() });
}

function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Bingo Musical escuchando en :${PORT}`));