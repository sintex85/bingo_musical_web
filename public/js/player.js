const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
const cardDiv = document.getElementById('card');
const statusDiv = document.getElementById('status');
let ws;
let marked = [];

function renderCard(songs) {
  cardDiv.innerHTML = '';
  songs.forEach((s, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.textContent = `${s.name} - ${s.artist}`;
    cell.addEventListener('click', () => {
      if (cell.classList.toggle('marked')) {
        marked.push(i);
      } else {
        marked = marked.filter(m => m !== i);
      }
      ws.send(JSON.stringify({ type: 'mark', marked }));
      checkLines();
    });
    cardDiv.appendChild(cell);
  });
}

function checkLines() {
  const cells = Array.from(cardDiv.children);
  for (let r = 0; r < 5; r++) {
    const row = cells.slice(r * 5, r * 5 + 5);
    if (row.every(c => c.classList.contains('marked'))) {
      statusDiv.textContent = '¡Línea!';
      return;
    }
  }
  statusDiv.textContent = '';
}

ws = new WebSocket(`ws://${location.host}`);
ws.onopen = () => ws.send(JSON.stringify({ type: 'join', sessionId, role: 'player' }));
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'card') {
    renderCard(msg.card);
  } else if (msg.type === 'play') {
    statusDiv.textContent = 'Sonando: #' + (msg.index + 1);
  }
};
