import fetch from 'node-fetch';
const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

let token = null;
let expires = 0;

async function auth() {
  if (Date.now() < expires) return token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + Buffer.from(
      `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  token = data.access_token;
  expires = Date.now() + data.expires_in * 1000 - 5000;
  return token;
}

export async function getPlaylistTracks(id, limit = 300) {
  let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
  const tracks = [];
  const headers = () => ({ Authorization: `Bearer ${token}` });

  while (url && tracks.length < limit) {
    const res = await fetch(url, { headers: await auth().then(() => headers()) });
    const data = await res.json();
    tracks.push(...data.items.map(i => ({
      name: i.track.name,
      artist: i.track.artists.map(a => a.name).join(', '),
      preview: i.track.preview_url // puede venir null
    })));
    url = data.next;
  }
  return tracks;
}