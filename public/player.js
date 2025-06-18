/*  player.js  —  versión 100 % estática, sin WebSocket ni back‑end
    ---------------------------------------------------------------
    1. Lee los parámetros de la URL:
       - playlist   → URL de playlist de Spotify
    2. Descarga hasta 25 canciones (preview) usando un micro‑servicio
       gratuito que expone la API pública de Spotify.
    3. Construye un cartón de bingo (5×5) que cada jugador marca
       localmente. No hay sincronización entre jugadores.
*/

/* --- leer parámetros de la URL --- */
const params   = new URLSearchParams(location.search);
const playlist = params.get('playlist');

if (!playlist) {
  document.body.innerHTML = '<h2>ERROR: falta el parámetro "playlist"</h2>';
  throw new Error('Playlist URL missing');
}

/* --- descargar canciones de la playlist --- */
const statusEl = document.getElementById('status');
statusEl.textContent = 'Cargando playlist…';

fetch(`https://spotify-playlist-api.fly.dev/api/tracks?url=${encodeURIComponent(playlist)}`)
  .then(r => r.json())
  .then(data => {
    const tracks = (data.tracks || []).sort(() => Math.random() - 0.5).slice(0, 25);
    if (tracks.length < 25) throw new Error('Playlist demasiado corta');

    /* --- pintar cartón --- */
    const board = document.getElementById('board');
    board.innerHTML = '';
    tracks.forEach(t => {
      const div       = document.createElement('div');
      div.className   = 'cell';
      div.textContent = `${t.name} – ${t.artist}`;
      div.onclick     = () => div.classList.toggle('marked');
      board.appendChild(div);
    });

    statusEl.textContent = '¡Cartón listo! Marca las canciones cuando suenen.';
  })
  .catch(err => {
    console.error(err);
    statusEl.textContent = 'Error al cargar la playlist.';
  });
