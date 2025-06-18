const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');
const socket = io();

let playlist = [];

fetch(`/playlist.json?sessionId=${sessionId}`)
  .then(r => r.json())
  .then(data => {
    playlist = data;
    renderTracks();
  });

function renderTracks() {
  const container = document.getElementById('tracks');
  playlist.forEach((t, idx) => {
    const btn = document.createElement('button');
    btn.textContent = t.name;
    btn.addEventListener('click', () => {
      socket.emit('playTrack', { sessionId, trackIndex: idx });
      if (t.preview_url) {
        const audio = document.getElementById('audio');
        audio.src = t.preview_url;
        audio.play();
      }
    });
    container.appendChild(btn);
  });
}

socket.on('play', ({ track, index }) => {
  // maybe update UI
});
