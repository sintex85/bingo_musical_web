const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');
const socket = io();
socket.emit('join', { sessionId });

socket.on('card', card => {
  const board = document.getElementById('board');
  board.innerHTML = '';
  card.forEach((track, idx) => {
    const div = document.createElement('div');
    div.className = 'cell';
    div.textContent = track.name + ' - ' + track.artist;
    div.addEventListener('click', () => {
      div.classList.toggle('mark');
      socket.emit('mark', { sessionId, index: idx });
    });
    board.appendChild(div);
  });
});

socket.on('play', data => {
  // can show track index etc
});
