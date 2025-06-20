const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})
const db = admin.firestore()

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const sessions = {}

io.on('connection', socket => {
  socket.on('createSession', async ({ playlistUrl }) => {
    try {
      const sessionId = Math.random().toString(36).substring(2, 8)
      const allSongs = [{ title: 'Canción 1', artist: 'Artista 1' }, { title: 'Canción 2', artist: 'Artista 2' }]
      sessions[sessionId] = { playlistUrl, songs: allSongs, players: {} }
      const joinUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}?sid=${sessionId}`

      await db.collection('sessions').doc(sessionId).set({
        playlistUrl,
        songs: allSongs,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })

      socket.emit('sessionCreated', { sessionId, joinUrl })
    } catch (err) {
      console.error('Error guardando sesión en Firestore:', err)
      socket.emit('sessionError', 'No se pudo guardar la sesión en Firebase')
    }
  })

  socket.on('joinSession', async ({ sessionId, userId }) => {
    if (!sessions[sessionId]) return socket.emit('sessionError', 'Sesión no encontrada')
    // Simula un cartón de bingo (deberías reemplazar esto por tu lógica real)
    const bingoCard = sessions[sessionId].songs.slice(0, 20)
    sessions[sessionId].players[userId] = { bingoCard }

    // Guarda el jugador en Firestore
    await db
      .collection('sessions').doc(sessionId)
      .collection('players').doc(userId)
      .set({
        bingoCard,
        markedSongs: [],
        linesCompleted: 0,
        isBingo: false,
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      })

    socket.emit('sessionJoined', { sessionId, bingoCard })
    socket.join(sessionId)
  })
})

server.listen(3000, () => {
  console.log('Servidor escuchando en puerto 3000')
})

function updatePlayerStats() {
  const cells = bingoCardDiv.querySelectorAll(".bingo-cell");
  const totalCells = cells.length; // number of songs in the card
  // Count marked cells
  const totalMarked = Array.from(cells).filter(cell => cell.classList.contains("marked")).length;
  // Update marked count display
  markedCountSpan.textContent = `${totalMarked} / ${totalCells}`;

  // Compute number of complete rows (each row has 'cols' songs)
  const cols = 5;
  const rows = Math.ceil(totalCells / cols);
  let lines = 0;
  for (let r = 0; r < rows; r++) {
    let markedInRow = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx < totalCells && cells[idx].classList.contains("marked")) {
        markedInRow++;
      }
    }
    if (markedInRow === cols) lines++;
  }
  linesCountSpan.textContent = lines;

  // Show line or bingo message
  if (totalMarked === totalCells) {
    // Full bingo
    winMessageDiv.textContent = "¡BINGO!";
    winMessageDiv.classList.remove("hidden");
    showMessage("¡BINGO! Has completado todas las canciones.", "success");
  } else if (lines > 0) {
    // At least one completed line
    winMessageDiv.textContent = "¡LÍNEA!";
    winMessageDiv.classList.remove("hidden");
    showMessage(`¡LÍNEA! Has completado ${lines} línea${lines > 1 ? "s" : ""}.`, "info");
  } else {
    // No line or bingo
    winMessageDiv.classList.add("hidden");
  }
}