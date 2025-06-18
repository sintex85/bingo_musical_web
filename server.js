const express = require('express');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let sessions = {}; // sessionId -> { playlist: [...tracks], players: {...} }

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  return data.access_token;
}

async function fetchPlaylistTracks(playlistId) {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(name,artists(name),preview_url))&limit=100`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  return data.items.map(item => ({
    name: item.track.name,
    artist: item.track.artists.map(a => a.name).join(', '),
    preview_url: item.track.preview_url
  }));
}

app.post('/create-session', async (req, res) => {
  const { playlistUrl } = req.body;
  const match = playlistUrl.match(/playlist\/(.*?)(\?|$)/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid playlist URL' });
  }
  const playlistId = match[1];
  try {
    const tracks = await fetchPlaylistTracks(playlistId);
    const sessionId = uuidv4();
    sessions[sessionId] = { playlist: tracks, players: {} };
    res.json({ sessionId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

app.get('/playlist.json', (req, res) => {
  const { sessionId } = req.query;
  const session = sessions[sessionId];
  if (!session) return res.status(404).end();
  res.json(session.playlist);
});

io.on('connection', socket => {
  socket.on('join', ({ sessionId }) => {
    const session = sessions[sessionId];
    if (!session) return;
    socket.join(sessionId);
    // Assign random card
    const tracks = session.playlist.slice();
    shuffle(tracks);
    const card = tracks.slice(0, 25);
    session.players[socket.id] = { card, marks: Array(25).fill(false) };
    socket.emit('card', card);
  });

  socket.on('mark', ({ sessionId, index }) => {
    const session = sessions[sessionId];
    if (!session) return;
    const player = session.players[socket.id];
    if (player) player.marks[index] = true;
  });

  socket.on('playTrack', ({ sessionId, trackIndex }) => {
    io.to(sessionId).emit('play', { track: sessions[sessionId].playlist[trackIndex], index: trackIndex });
  });

  socket.on('disconnect', () => {
    for (const sessionId in sessions) {
      delete sessions[sessionId].players[socket.id];
    }
  });
});

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

server.listen(PORT, () => console.log(`Server on ${PORT}`));
