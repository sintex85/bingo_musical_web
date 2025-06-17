const playlistInput = document.getElementById('playlist');
const createBtn = document.getElementById('create');
const sessionDiv = document.getElementById('session');
const joinLink = document.getElementById('join-link');
const nextBtn = document.getElementById('next');
const qrCanvas = document.getElementById('qr');
const bingoMsg = document.getElementById('bingo-msg');
let ws;
let sessionId;

createBtn.addEventListener('click', async () => {
  const playlistUrl = playlistInput.value.trim();
  if (!playlistUrl) return;

  const res = await fetch('/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playlistUrl })
  });
  const data = await res.json();
  sessionId = data.id;

  joinLink.value = location.origin + '/player.html?session=' + sessionId;
  sessionDiv.classList.remove('hidden');

  // ⚠️ Limpiar QR anterior
  qrCanvas.innerHTML = '';
  new QRCode(qrCanvas, joinLink.value);

  // 🛑 Cerrar WebSocket anterior si existe
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close();
  }

  ws = new WebSocket(`ws://${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', sessionId, role: 'admin' }));

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'bingo') {
      bingoMsg.textContent = `Jugador ${msg.player} ha cantado BINGO!`;
    }
  };
});
