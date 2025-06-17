const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const SpotifyWebApi = require('spotify-web-api-node');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function getPlaylistTracks(playlistUrl) {
  const match = playlistUrl.match(/playlist\/(.+?)(\?|$)/);
  if (!match) throw new Error('Invalid playlist URL');
  const playlistId = match[1];
  const { body } = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(body.access_token);
  let tracks = [];
  let response = await spotifyApi.getPlaylistTracks(playlistId, { limit: 100 });
  tracks = tracks.concat(response.body.items);
  while (response.body.next) {
    const offset = tracks.length;
    response = await spotifyApi.getPlaylistTracks(playlistId, { limit: 100, offset });
    tracks = tracks.concat(response.body.items);
  }
  return tracks.map(t => ({
    name: t.track.name,
    artist: t.track.artists.map(a => a.name).join(', '),
    preview: t.track.preview_url,
  }));
}

app.post('/create', async (req, res) => {
  try {
    const { playlistUrl } = req.body;
    const songs = await getPlaylistTracks(playlistUrl);
    const id = crypto.randomBytes(4).toString('hex');
    sessions.set(id, { songs, players: new Map(), admin: null, current: -1 });
    res.json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const server = app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'join') {
        const session = sessions.get(msg.sessionId);
        if (!session) return ws.close();
        if (msg.role === 'admin') session.admin = ws;
        else {
          const card = shuffle(session.songs).slice(0, 25);
          session.players.set(ws, { card, marked: [] });
          ws.send(JSON.stringify({ type: 'card', card }));
        }
        ws.sessionId = msg.sessionId;
        ws.role = msg.role;
      } else if (msg.type === 'mark' && ws.role === 'player') {
        const session = sessions.get(ws.sessionId);
        const player = session.players.get(ws);
        player.marked = msg.marked;
        if (player.marked.length >= 20 && !player.reported) {
          player.reported = true;
          session.admin && session.admin.send(JSON.stringify({ type: 'bingo', player: Array.from(session.players.keys()).indexOf(ws) + 1 }));
        }
      } else if (msg.type === 'next' && ws.role === 'admin') {
        const session = sessions.get(ws.sessionId);
        session.current++;
        const song = session.songs[session.current];
        session.players.forEach((_, pws) => {
          pws.send(JSON.stringify({ type: 'play', index: session.current, song }));
        });
      }
    } catch (e) {
      console.error('ws error', e);
    }
  });

  ws.on('close', () => {
    if (ws.sessionId) {
      const session = sessions.get(ws.sessionId);
      if (!session) return;
      if (ws.role === 'admin') session.admin = null;
      else session.players.delete(ws);
    }
  });
});

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
