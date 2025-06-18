/* admin.js  – versión estática sin back‑end ni WebSocket
--------------------------------------------------------- */
const playlistInput = document.getElementById('playlist');
const createBtn     = document.getElementById('create');
const linkBox       = document.getElementById('link');

createBtn.addEventListener('click', () => {
  const playlist = playlistInput.value.trim();

  if (!playlist.includes('spotify.com/playlist/')) {
    alert('URL de playlist no válida');
    return;
  }

  // Genera URL para jugadores (solo con parámetro ?playlist=)
  const joinURL = `${location.origin}/player.html?playlist=${encodeURIComponent(playlist)}`;

  linkBox.innerHTML = `<a href="${joinURL}" target="_blank">${joinURL}</a>`;
});
